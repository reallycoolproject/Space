import express from 'express';
import mongoose from 'mongoose';
import requireAuth from '../middleware/auth';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { GroupChat } from '../models/GroupChat';
import { Conversation } from '../models/Conversation';
import { emitMessageNotifications } from '../utils/messageNotifications';
import { canAccessSpaceRoom, getSpaceChannel, getSpaceMember, hasSpacePermission, parseSpaceRoomId } from '../utils/spacePermissions';
import { randomUUID } from 'crypto';
import { Space, SPACE_PERMISSIONS, SpacePermission } from '../models/Space';
import { SpaceThread } from '../models/SpaceThread';
import { NikoConfig, INikoEmbed } from '../models/NikoBot';
import { NikoMemberXP } from '../models/NikoMemberXP';
import { lastDeletedMessages, getRequiredXpForLevel, sendNikoBotMessage } from './niko';

const canAccessRoom = async (userId: string, roomId: string, permission: SpacePermission = 'VIEW_CHANNEL') => {
  if (parseSpaceRoomId(roomId)) return canAccessSpaceRoom(userId, roomId, permission);
  if (roomId.length === 24 && /^[0-9a-fA-F]{24}$/.test(roomId)) {
    const group = await GroupChat.findById(roomId).select('members.userId');
    return Boolean(group?.members.some(member => member.userId === userId));
  }
  const participantIds = roomId.split('_');
  if (participantIds.length !== 2 || !participantIds.includes(userId)) return false;
  const otherUserId = participantIds.find(id => id !== userId);
  if (!otherUserId) return participantIds.every(id => id === userId);
  const user = await User.findOne({ userId }).select('contacts blockedUsers oneTimeMessageAcceptedUsers');
  return Boolean(user && !user.blockedUsers.includes(otherUserId) && (
    user.contacts.includes(otherUserId) || user.oneTimeMessageAcceptedUsers?.includes(otherUserId)
  ));
};

const getDirectRoomParticipants = (userId: string, roomId: string) => {
  const participantIds = roomId.split('_');
  if (participantIds.length !== 2 || !participantIds.includes(userId)) return null;
  return participantIds;
};

const getBlockingUser = async (userId: string, otherUserId: string) => {
  const [currentUser, otherUser] = await Promise.all([
    User.findOne({ userId }).select('blockedUsers'),
    User.findOne({ userId: otherUserId }).select('blockedUsers')
  ]);
  if (currentUser?.blockedUsers.includes(otherUserId)) return userId;
  if (otherUser?.blockedUsers.includes(userId)) return otherUserId;
  return null;
};

const serializeMessage = (message: any) => ({
  id: message._id,
  roomId: message.roomId,
  senderId: message.senderId,
  senderName: message.senderName,
  content: message.content,
  timestamp: message.createdAt,
  clientMsgId: message.clientMsgId,
  replyTo: message.replyTo,
  reactions: message.reactions,
  mentions: message.mentions || [],
  edited: message.edited,
  editedAt: message.editedAt,
  deliveredTo: message.deliveredTo,
  readBy: message.readBy,
  isSystemMessage: message.isSystemMessage,
  systemType: message.systemType,
  systemTargetUserId: message.systemTargetUserId,
  callMeta: message.callMeta
});

const isEncryptedEnvelope = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2ee === true || parsed?.v === 2 || parsed?.v === 3 || parsed?.isBot === true || parsed?.embeds !== undefined || parsed?.components !== undefined;
  } catch {
    return false;
  }
};

const router = express.Router();

// POST /api/messages
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const { roomId, content, clientMsgId, replyTo } = req.body as { roomId?: string; content?: string; clientMsgId?: string; replyTo?: string };
    if (!roomId || !content) return res.status(400).json({ ok: false, message: 'roomId and content required' });
    const participants = getDirectRoomParticipants(req.user.userId, roomId);
    if (participants) {
      const otherUserId = participants.find(id => id !== req.user.userId);
      if (otherUserId) {
        const blockingUserId = await getBlockingUser(req.user.userId, otherUserId);
        if (blockingUserId) {
          const blocker = await User.findOne({ userId: blockingUserId }).select('username displayName');
          const systemMessage = await Message.create({
            roomId,
            senderId: 'system',
            senderName: 'Space',
            content: blockingUserId === req.user.userId
              ? `Your message couldn't be sent. You blocked ${blocker?.displayName || blocker?.username || 'this user'}. Unblock them to message again.`
              : `Your message couldn't be sent. ${blocker?.displayName || blocker?.username || 'This user'} has blocked you.`,
            isSystemMessage: true,
            systemType: blockingUserId === req.user.userId ? 'blocked-send-own' : 'blocked-send',
            systemTargetUserId: blockingUserId === req.user.userId ? otherUserId : blockingUserId
          });
          const payload = serializeMessage(systemMessage);
          (req.app.get('io') as any)?.to(req.user.userId).emit('message:receive', payload);
          return res.status(403).json({ ok: false, message: 'Message could not be sent because this conversation is blocked.', systemMessage: payload });
        }
      }
    }
    if (!isEncryptedEnvelope(content)) return res.status(400).json({ ok: false, message: 'Messages must be end-to-end encrypted' });
    if (replyTo !== undefined) {
      if (typeof replyTo !== 'string' || !mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({ ok: false, message: 'Invalid message reply reference.' });
      }
      const repliedMessage = await Message.findOne({ _id: replyTo, roomId }).select('_id');
      if (!repliedMessage) return res.status(404).json({ ok: false, message: 'The message you are replying to is not in this conversation.' });
    }
    const parsedSpaceRoom = parseSpaceRoomId(roomId);
    const isSpaceChannel = Boolean(parsedSpaceRoom);
    const sendPermission = parsedSpaceRoom?.threadId ? 'SEND_MESSAGES_IN_THREADS' : 'SEND_MESSAGES';
    if (!(await canAccessRoom(req.user.userId, roomId, isSpaceChannel ? sendPermission : 'VIEW_CHANNEL'))) return res.status(403).json({ ok: false, message: 'You do not have permission to send messages in this channel.' });
    let mentions: string[] = [];
    if (isSpaceChannel) {
      const parsed = parsedSpaceRoom!;
      const space = await Space.findById(parsed.spaceId);
      const channel = space && getSpaceChannel(space, parsed.channelId);
      if (!space || !channel || !getSpaceMember(space, req.user.userId)) return res.status(403).json({ ok: false, message: 'You do not have access to this channel.' });
      const canMentionEveryone = hasSpacePermission(space, req.user.userId, 'MENTION_EVERYONE', channel);
      if ((req.body.mentionEveryone || req.body.mentionHere) && !canMentionEveryone) return res.status(403).json({ ok: false, message: 'You cannot mention everyone or here in this channel.' });
      if (Array.isArray(req.body.mentions)) {
        const validMentions = req.body.mentions.filter((id: unknown): id is string =>
          typeof id === 'string' && Boolean(getSpaceMember(space, id))
        );
        mentions = Array.from(new Set<string>(validMentions)).slice(0, 100);
      }
      if (req.body.mentionEveryone) mentions.push(...space.members.map(member => member.userId));
      if (req.body.mentionHere) {
        const activeUsers = await User.find({ userId: { $in: space.members.map(member => member.userId) }, status: 'active' }).select('userId');
        mentions.push(...activeUsers.map(activeUser => activeUser.userId));
      }
      if (req.body.roleMentions !== undefined) {
        if (!Array.isArray(req.body.roleMentions) || req.body.roleMentions.length > 20 ||
          req.body.roleMentions.some((id: unknown) => typeof id !== 'string')) {
          return res.status(400).json({ ok: false, message: 'Invalid role mentions.' });
        }
        const roleIds = Array.from(new Set<string>(req.body.roleMentions));
        const roles = roleIds.map(id => space.roles.find(role => role.id === id));
        if (roles.some(role => !role || (!role.mentionable && !canMentionEveryone))) {
          return res.status(403).json({ ok: false, message: 'One or more roles cannot be mentioned by you.' });
        }
        mentions.push(...space.members
          .filter(member => member.roleIds.some(roleId => roleIds.includes(roleId)))
          .map(member => member.userId));
      }
      mentions = Array.from(new Set(mentions)).slice(0, 100);
      if (parsed.threadId && !await SpaceThread.exists({ _id: parsed.threadId, spaceId: space._id, channelId: channel.id })) {
        return res.status(404).json({ ok: false, message: 'Thread not found.' });
      }
      if (channel.slowmodeSeconds > 0) {
        const threads = await SpaceThread.find({ spaceId: space._id, channelId: channel.id }).select('_id');
        const roomIds = [`space:${space.id}:${channel.id}`, ...threads.map(thread => `space:${space.id}:${channel.id}:${thread.id}`)];
        const previousMessage = await Message.findOne({ roomId: { $in: roomIds }, senderId: req.user.userId })
          .sort({ createdAt: -1 }).select('createdAt').lean();
        if (previousMessage) {
          const retryAfterSeconds = Math.ceil((previousMessage.createdAt.getTime() + channel.slowmodeSeconds * 1000 - Date.now()) / 1000);
          if (retryAfterSeconds > 0) {
            res.setHeader('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ ok: false, message: `Slowmode is on. Wait ${retryAfterSeconds} seconds before sending another message.`, retryAfterSeconds });
          }
        }
      }
    }

    console.log('Saving message to roomId:', roomId, 'from user:', req.user.userId, 'content length:', content.length);
    const m = await Message.create({ roomId, senderId: req.user.userId, senderName: req.user.username, content, clientMsgId, replyTo, mentions, deliveredTo: [req.user.userId] });
    if (parsedSpaceRoom?.threadId) await SpaceThread.updateOne(
      { _id: parsedSpaceRoom.threadId, spaceId: parsedSpaceRoom.spaceId, channelId: parsedSpaceRoom.channelId, archived: false, locked: false },
      { $set: { lastActivityAt: m.createdAt } }
    );
    console.log('Message saved to database:', m._id);

    if (isSpaceChannel && parsedSpaceRoom) {
      // Async XP awarding & AutoMod handling
      (async () => {
        try {
          const niko = await NikoConfig.findOne({ spaceId: parsedSpaceRoom.spaceId });
          if (niko && niko.enabled) {
            // Leveling XP
            if (niko.levelingConfig?.enabled) {
              // Check if channel is excluded from gaining XP
              if (niko.levelingConfig.noXpChannelIds?.includes(parsedSpaceRoom.channelId)) {
                return;
              }

              const now = new Date();
              const cooldown = (niko.levelingConfig.cooldownSeconds || 60) * 1000;
              let userXP = await NikoMemberXP.findOne({ spaceId: parsedSpaceRoom.spaceId, userId: req.user.userId });
              if (!userXP) {
                userXP = await NikoMemberXP.create({
                  spaceId: parsedSpaceRoom.spaceId,
                  userId: req.user.userId,
                  username: req.user.username,
                  avatar: req.user.avatar || '',
                  xp: 0,
                  level: 0,
                  messagesCount: 0,
                  lastMessageAt: new Date(0)
                });
              }

              if (now.getTime() - new Date(userXP.lastMessageAt).getTime() >= cooldown) {
                const min = niko.levelingConfig.minXp || 15;
                const max = niko.levelingConfig.maxXp || 25;
                let earned = Math.floor(Math.random() * (max - min + 1)) + min;

                // Check for Double XP roles
                if (niko.levelingConfig.doubleXpRoleIds?.length) {
                  const spaceForBoost = await Space.findById(parsedSpaceRoom.spaceId).select('members');
                  const mem = spaceForBoost?.members.find(m => m.userId === req.user.userId);
                  if (mem && mem.roleIds.some(r => niko.levelingConfig.doubleXpRoleIds?.includes(r))) {
                    earned *= 2;
                  }
                }

                userXP.xp += earned;
                userXP.messagesCount += 1;
                userXP.lastMessageAt = now;

                const nextReq = getRequiredXpForLevel(userXP.level);
                if (userXP.xp >= nextReq) {
                  userXP.level += 1;
                  const spaceDoc = await Space.findById(parsedSpaceRoom.spaceId);
                  let roleRewardText = '';

                  // Milestone role rewards
                  const reward = niko.levelingConfig.roleRewards?.find(r => r.level === userXP.level);
                  if (reward && spaceDoc) {
                    const spaceMem = spaceDoc.members.find(mem => mem.userId === req.user.userId);
                    if (spaceMem) {
                      if (!niko.levelingConfig.stackRoles) {
                        const allRewardRoleIds = (niko.levelingConfig.roleRewards || []).map(r => r.roleId);
                        spaceMem.roleIds = spaceMem.roleIds.filter(id => !allRewardRoleIds.includes(id));
                      }
                      if (!spaceMem.roleIds.includes(reward.roleId)) {
                        spaceMem.roleIds.push(reward.roleId);
                        await spaceDoc.save();
                      }
                      const rewardedRole = spaceDoc.roles.find(r => r.id === reward.roleId);
                      roleRewardText = rewardedRole ? ` and unlocked the **@${rewardedRole.name}** role!` : '!';
                    }
                  }

                  // Announcement
                  if (niko.levelingConfig.alertType !== 'disabled' && spaceDoc) {
                    const alertChan = (niko.levelingConfig.alertType === 'channel' && niko.levelingConfig.announcementChannelId)
                      ? niko.levelingConfig.announcementChannelId
                      : parsedSpaceRoom.channelId;

                    const templateMsg = niko.levelingConfig.levelUpMessage || '🎉 GG {user.mention}! You just reached **Level {level}**{role}!';
                    const processedMsg = templateMsg
                      .replace(/\{user\}/gi, req.user.displayName || req.user.username)
                      .replace(/\{user\.mention\}/gi, `<@${req.user.userId}>`)
                      .replace(/\{level\}/gi, String(userXP.level))
                      .replace(/\{xp\}/gi, String(userXP.xp))
                      .replace(/\{role\}/gi, roleRewardText);

                    const levelUpEmbed: INikoEmbed = {
                      id: randomUUID(),
                      color: niko.accentColor || '#FEE75C',
                      title: `⭐ Level Up! Reached Level ${userXP.level}`,
                      description: processedMsg,
                      thumbnailUrl: req.user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Niko',
                      footer: { text: `Niko Leveling System · ${spaceDoc.name}`, timestamp: true }
                    };

                    await sendNikoBotMessage(req, spaceDoc, alertChan, {
                      text: processedMsg,
                      embeds: niko.levelingConfig.sendEmbed !== false ? [levelUpEmbed] : []
                    });

                    const ioApp = req.app?.get('io');
                    if (ioApp && alertChan) {
                      ioApp.to(`space:${parsedSpaceRoom.spaceId}:${alertChan}`).emit('niko:level-up', {
                        userId: req.user.userId,
                        username: req.user.username,
                        newLevel: userXP.level,
                        channelId: alertChan
                      });
                    }
                  }
                }
                await userXP.save();
              }
            }
          }
        } catch (e) {
          console.warn('Niko background XP hook error:', e);
        }
      })();
    }

    await Conversation.updateOne({ roomId }, { $set: { updatedAt: m.createdAt } });

    // Broadcast via socket.io if available
    try {
      const io = (req.app.get('io')) as any;
      if (io) {
        console.log('Broadcasting message to room:', roomId);
        io.to(roomId).emit('message:receive', { id: m._id, roomId: m.roomId, senderId: m.senderId, senderName: m.senderName, content: m.content, timestamp: m.createdAt, clientMsgId: m.clientMsgId, replyTo: m.replyTo, mentions: m.mentions, reactions: m.reactions, edited: m.edited, deliveredTo: m.deliveredTo, readBy: m.readBy });
        if (!(roomId.length === 24 && /^[0-9a-fA-F]{24}$/.test(roomId))) {
          roomId.split('_').forEach(participantId => {
            io.to(participantId).emit('conversation:message', { roomId, timestamp: m.createdAt });
          });
        }
        await emitMessageNotifications(io, roomId, req.user.userId, req.user.username, mentions, String(m._id));
      }
    } catch (e) {
      console.warn('broadcast failed', e);
    }

    return res.status(201).json({ ok: true, message: serializeMessage(m) });
  } catch (err) {
    console.error('save message failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to save message' });
  }
});
// GET /api/messages/:roomId
router.get('/:roomId', requireAuth, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const parsedSpaceRoom = parseSpaceRoomId(roomId);
    const isSpaceChannel = Boolean(parsedSpaceRoom);
    if (!(await canAccessRoom(req.user.userId, roomId, isSpaceChannel ? 'READ_MESSAGE_HISTORY' : 'VIEW_CHANNEL'))) {
      const participants = getDirectRoomParticipants(req.user.userId, roomId);
      const otherUserId = participants?.find(id => id !== req.user.userId);
      if (!otherUserId || !(await getBlockingUser(req.user.userId, otherUserId))) {
        return res.status(403).json({ ok: false, message: 'You do not have access to this conversation' });
      }
      const systemMessages = await Message.find({ roomId, isSystemMessage: true }).sort({ createdAt: 1 }).limit(30);
      return res.status(200).json({ ok: true, messages: systemMessages.map(serializeMessage), blocked: true });
    }
    console.log('Fetching messages for roomId:', roomId);
    const messageQuery: Record<string, unknown> = { roomId };
    const aroundId = req.query.around ? String(req.query.around) : '';
    if (parsedSpaceRoom) {
      const space = await Space.findById(parsedSpaceRoom.spaceId).select('members shareHistoryWithNewMembers');
      const member = space && getSpaceMember(space, req.user.userId);
      if (!space || !member) return res.status(403).json({ ok: false, message: 'You are not a member of this Space.' });
      if (!space.shareHistoryWithNewMembers && member.joinedAt) messageQuery.createdAt = { $gte: member.joinedAt };
    }
    if (aroundId) {
      if (!mongoose.isValidObjectId(aroundId)) return res.status(400).json({ ok: false, message: 'Invalid message anchor.' });
      const anchor = await Message.findOne({ _id: aroundId, roomId }).select('createdAt');
      if (!anchor) return res.status(404).json({ ok: false, message: 'The referenced message is not available in this channel.' });
      const historyConstraint = messageQuery.createdAt as Record<string, Date> | undefined;
      const beforeAnchor = { $lte: anchor.createdAt };
      messageQuery.createdAt = historyConstraint ? { ...historyConstraint, ...beforeAnchor } : beforeAnchor;
    }
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    if (req.query.before && (!before || !Number.isFinite(before.getTime()))) return res.status(400).json({ ok: false, message: 'Invalid message history cursor.' });
    if (before) messageQuery.createdAt = { ...(messageQuery.createdAt as Record<string, Date> || {}), $lt: before };
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
    const messages = await Message.find(messageQuery)
      .sort(before || aroundId ? { createdAt: -1, _id: -1 } : { createdAt: 1, _id: 1 })
      .limit(limit);
    if (aroundId) messages.reverse();
    console.log('Found messages:', messages.length);
    return res.status(200).json({ ok: true, messages: messages.map(serializeMessage) });
  } catch (err) {
    console.error('get messages failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch messages' });
  }
});

// PUT /api/messages/:id (Edit)
router.put('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const m = await Message.findById(id);
    if (!m) return res.status(404).json({ ok: false, message: 'Message not found' });
    const parsedSpaceRoom = parseSpaceRoomId(m.roomId);
    const editPermission = parsedSpaceRoom?.threadId ? 'SEND_MESSAGES_IN_THREADS' : 'SEND_MESSAGES';
    if (parsedSpaceRoom && !(await canAccessSpaceRoom(req.user.userId, m.roomId, editPermission))) return res.status(403).json({ ok: false, message: 'You cannot edit messages in this channel.' });
    if (m.senderId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Unauthorized' });

    m.content = content;
    m.edited = true;
    m.editedAt = new Date();
    await m.save();

    const io = (req.app.get('io')) as any;
    if (io) io.to(m.roomId).emit('message:edited', { id: m._id, content: m.content, edited: m.edited, editedAt: m.editedAt });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Failed to edit message' });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const m = await Message.findById(id);
    if (!m) return res.status(404).json({ ok: false, message: 'Message not found' });
    if (parseSpaceRoomId(m.roomId)) {
      const parsed = parseSpaceRoomId(m.roomId)!;
      const space = await Space.findById(parsed.spaceId);
      const channel = space && getSpaceChannel(space, parsed.channelId);
      if (!space || !channel || !hasSpacePermission(space, req.user.userId, 'VIEW_CHANNEL', channel)) return res.status(403).json({ ok: false, message: 'You cannot manage messages in this channel.' });
      if (m.senderId !== req.user.userId && !hasSpacePermission(space, req.user.userId, 'MANAGE_MESSAGES', channel)) return res.status(403).json({ ok: false, message: 'You can only delete your own messages.' });
    } else if (m.senderId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Unauthorized' });

    if (parseSpaceRoomId(m.roomId)) {
      const parsed = parseSpaceRoomId(m.roomId)!;
      try {
        let plainText = m.content;
        try {
          const parsedContent = JSON.parse(m.content);
          if (parsedContent.text) plainText = parsedContent.text;
        } catch {}
        lastDeletedMessages.set(parsed.channelId, {
          senderName: m.senderName,
          senderId: m.senderId,
          text: plainText,
          timestamp: m.createdAt,
          deletedAt: new Date()
        });
      } catch (e) {
        console.warn('Failed to cache deleted message for snipe:', e);
      }
    }

    await Message.deleteOne({ _id: id });

    const io = (req.app.get('io')) as any;
    if (io) io.to(m.roomId).emit('message:deleted', { id });
    const parsedSpaceRoom = parseSpaceRoomId(m.roomId);
    if (parsedSpaceRoom && !parsedSpaceRoom.threadId) {
      const threads = await SpaceThread.find({ spaceId: parsedSpaceRoom.spaceId, channelId: parsedSpaceRoom.channelId, starterMessageId: id }).select('_id');
      if (threads.length) {
        const roomIds = threads.map(thread => `space:${parsedSpaceRoom.spaceId}:${parsedSpaceRoom.channelId}:${thread.id}`);
        await Promise.all([
          SpaceThread.deleteMany({ _id: { $in: threads.map(thread => thread._id) } }),
          Message.deleteMany({ roomId: { $in: roomIds } })
        ]);
        if (io) {
          for (const roomId of roomIds) {
            io.to(roomId).emit('space:thread-deleted', { threadId: roomId.split(':').pop() });
            io.in(roomId).socketsLeave(roomId);
          }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Failed to delete message' });
  }
});

// POST /api/messages/translate
const supportedTranslationLanguages = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
]);

router.post('/translate', requireAuth, async (req: any, res: any) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const targetLang = typeof req.body?.targetLang === 'string' ? req.body.targetLang : 'en';
  if (!text) return res.status(400).json({ ok: false, message: 'Enter a message to translate.' });
  if (text.length > 5000) return res.status(413).json({ ok: false, message: 'Messages must be 5,000 characters or shorter to translate.' });
  if (!supportedTranslationLanguages.has(targetLang)) {
    return res.status(400).json({ ok: false, message: 'Choose a supported translation language.' });
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 450) {
    let splitAt = remaining.lastIndexOf(' ', 450);
    if (splitAt < 1) splitAt = 450;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);

  const decodeEntities = (value: string) => value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  try {
    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', chunk);
      url.searchParams.set('langpair', `Autodetect|${targetLang}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return res.status(502).json({ ok: false, message: 'The translation service is unavailable. Try again shortly.' });
      }
      const data = await response.json() as {
        responseStatus?: number;
        responseData?: { translatedText?: string };
      };
      const translated = data.responseData?.translatedText;
      if (data.responseStatus !== 200 || typeof translated !== 'string' || !translated.trim()) {
        return res.status(502).json({ ok: false, message: 'The translation service could not translate this message.' });
      }
      translatedChunks.push(decodeEntities(translated));
    }

    return res.status(200).json({ ok: true, translatedText: translatedChunks.join(' ') });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Translation took too long. Try again.'
      : 'Could not reach the translation service. Try again shortly.';
    return res.status(502).json({ ok: false, message });
  }
});

// POST /api/messages/:id/react
router.post('/:id/react', requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ ok: false, message: 'Emoji required' });

    const m = await Message.findById(id);
    if (!m) return res.status(404).json({ ok: false, message: 'Message not found' });
    if (parseSpaceRoomId(m.roomId) && !(await canAccessSpaceRoom(req.user.userId, m.roomId, 'ADD_REACTIONS'))) return res.status(403).json({ ok: false, message: 'You cannot react in this channel.' });

    // Check if user already reacted with this emoji
    const existingReactionIndex = m.reactions.findIndex(r => r.emoji === emoji && r.userId === req.user.userId);
    if (existingReactionIndex !== -1) {
      // Remove reaction (toggle off)
      m.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction
      m.reactions.push({ emoji, userId: req.user.userId, username: req.user.username });
    }

    await m.save();

    const io = (req.app.get('io')) as any;
    if (io) io.to(m.roomId).emit('message:reacted', { messageId: id, reactions: m.reactions });

    return res.status(200).json({ ok: true, reactions: m.reactions });
  } catch (err) {
    console.error('react to message failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to react to message' });
  }
});

// POST /api/messages/:id/delivered
router.post('/:id/delivered', requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const m = await Message.findById(id);
    if (!m) return res.status(404).json({ ok: false, message: 'Message not found' });
    if (parseSpaceRoomId(m.roomId) && !(await canAccessSpaceRoom(req.user.userId, m.roomId, 'READ_MESSAGE_HISTORY'))) return res.status(403).json({ ok: false, message: 'You cannot access this channel.' });

    if (!m.deliveredTo || !m.deliveredTo.includes(req.user.userId)) {
      if (!m.deliveredTo) m.deliveredTo = [];
      m.deliveredTo.push(req.user.userId);
      await m.save();

      const io = (req.app.get('io')) as any;
      if (io) io.to(m.roomId).emit('message:delivered', { messageId: id, deliveredTo: m.deliveredTo });
    }

    return res.status(200).json({ ok: true, deliveredTo: m.deliveredTo || [] });
  } catch (err) {
    console.error('mark delivered failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to mark as delivered' });
  }
});

// POST /api/messages/:id/read
router.post('/:id/read', requireAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const m = await Message.findById(id);
    if (!m) return res.status(404).json({ ok: false, message: 'Message not found' });
    if (parseSpaceRoomId(m.roomId) && !(await canAccessSpaceRoom(req.user.userId, m.roomId, 'READ_MESSAGE_HISTORY'))) return res.status(403).json({ ok: false, message: 'You cannot access this channel.' });

    if (!m.readBy || !m.readBy.includes(req.user.userId)) {
      if (!m.readBy) m.readBy = [];
      m.readBy.push(req.user.userId);
      await m.save();

      const io = (req.app.get('io')) as any;
      if (io) io.to(m.roomId).emit('message:read', { messageId: id, roomId: m.roomId, readBy: m.readBy });
    }

    return res.status(200).json({ ok: true, readBy: m.readBy || [] });
  } catch (err) {
    console.error('mark read failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to mark as read' });
  }
});

export default router;

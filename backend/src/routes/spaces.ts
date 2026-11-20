import express from 'express';
import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ISpace, ISpaceChannel, ISpaceRole, SPACE_PERMISSIONS, Space, SpaceChannelType, SpacePermission } from '../models/Space';
import { SpaceEvent } from '../models/SpaceEvent';
import { SpaceThread } from '../models/SpaceThread';
import { canAccessSpaceRoom, canReadSpaceChannel, getCategoryAncestors, getSpaceChannel, getSpaceMember, getSpacePermissions, hasSpacePermission, syncSpaceChannelRooms } from '../utils/spacePermissions';
import { SpaceAuditLog } from '../models/SpaceAuditLog';
import { SpaceWebhook } from '../models/SpaceWebhook';
import { handleNikoMemberJoin } from './niko';

const router = express.Router();
const permissionMask = Object.values(SPACE_PERMISSIONS).reduce((all, bit) => all | bit, 0);
const discoveryCategories = ['Gaming', 'Music', 'Education', 'Science', 'Entertainment', 'Technology', 'Art & Design', 'Other'];
const makeInviteCode = () => randomBytes(9).toString('base64url');
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
}).single('file');
const EMOJI_FILE_LIMIT = 256 * 1024;
const STICKER_FILE_LIMIT = 512 * 1024;
const MAX_SPACE_EMOJIS_PER_ANIMATION = 100;
const MAX_SPACE_STICKERS = 50;
const validName = (value: unknown, max = 100): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const parsePermissionBits = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0 && (Number(value) & ~permissionMask) === 0;
const serializeSpace = (space: any) => {
  const data = space.toObject ? space.toObject() : space;
  const safeData = { ...data };
  delete safeData.inviteCode;
  delete safeData.invites;
  delete safeData.bannedUserIds;
  delete safeData.bans;
  return { ...safeData, members: data.members.map((member: any) => ({ userId: member.userId, roleIds: member.roleIds, temporaryRoleAssignments: member.temporaryRoleAssignments || [], nickname: member.nickname, joinedAt: member.joinedAt, mutedUntil: member.mutedUntil })) };
};
const findSpace = (id: string) => mongoose.isValidObjectId(id) ? Space.findById(id) : null;
const removePermissionOverwrites = (space: ISpace, targetId: string) => {
  for (const channel of space.channels) {
    channel.permissionOverwrites = channel.permissionOverwrites.filter(overwrite => overwrite.roleId !== targetId);
  }
  for (const category of space.categories) {
    category.permissionOverwrites = category.permissionOverwrites.filter(overwrite => overwrite.roleId !== targetId);
  }
};
const writeSpaceAudit = async (spaceId: string, actorId: string, action: string, targetId = '', details: Record<string, unknown> = {}) => {
  await SpaceAuditLog.create({ spaceId, actorId, action, targetId, details });
};
const allowedUploadedImage = (buffer: Buffer) => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
};
const isAnimatedImage = (buffer: Buffer, extension: string) =>
  extension === 'gif' || (extension === 'png' && buffer.includes(Buffer.from('acTL')));
const imageDimensions = (buffer: Buffer, extension: string): { width: number; height: number } | null => {
  if (extension === 'png' && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (extension === 'gif' && buffer.length >= 10) return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  if (extension === 'webp' && buffer.length >= 30) {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === 'VP8L' && buffer[20] === 0x2f) {
      return {
        width: 1 + ((buffer[22] & 0x3f) << 8) + buffer[21],
        height: 1 + ((buffer[24] & 0x0f) << 10) + (buffer[23] << 2) + (buffer[22] >> 6)
      };
    }
    if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
  }
  if (extension === 'jpg' && buffer.length >= 4) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      offset += segmentLength;
    }
  }
  return null;
};
const countSpaceEmojis = (space: ISpace, animated: boolean) =>
  space.emojis.filter(asset => Boolean(asset.animated) === animated).length;
const verificationAccountAge = (level: ISpace['verificationLevel']) =>
  level === 'high' ? 7 * 24 * 60 * 60 * 1000
    : level === 'medium' ? 24 * 60 * 60 * 1000
      : level === 'low' ? 60 * 60 * 1000
        : 0;
const meetsVerificationLevel = (user: { createdAt?: Date } | null, level: ISpace['verificationLevel']) => {
  const requiredAge = verificationAccountAge(level);
  if (!requiredAge) return true;
  const createdAt = user?.createdAt ? new Date(user.createdAt).getTime() : NaN;
  return Number.isFinite(createdAt) && Date.now() - createdAt >= requiredAge;
};
const verificationAgeLabel = (level: ISpace['verificationLevel']) =>
  level === 'high' ? '7 days' : level === 'medium' ? '1 day' : '1 hour';
const removeUploadedAssetFile = async (spaceId: string, url: string) => {
  const prefix = `/uploads/spaces/${spaceId}/`;
  if (!url.startsWith(prefix)) return;
  const fileName = url.slice(prefix.length);
  if (!fileName || fileName !== path.basename(fileName)) return;
  await fs.unlink(path.join(__dirname, '../../uploads/spaces', spaceId, fileName)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
};
const canManageRole = (space: any, userId: string, targetRole: ISpaceRole) => {
  if (space.ownerId === userId) return true;
  if (!hasSpacePermission(space, userId, 'MANAGE_ROLES')) return false;
  const member = getSpaceMember(space, userId);
  const topRolePosition = Math.max(0, ...space.roles.filter((role: ISpaceRole) => member?.roleIds.includes(role.id)).map((role: ISpaceRole) => role.position));
  return targetRole.id !== 'everyone' && targetRole.position < topRolePosition;
};

router.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    const spaces = await Space.find({ 'members.userId': req.user.userId }).select('name description icon banner ownerId members roles categories channels isPublic discoveryCategory discoveryTags createdAt');
    return res.json({ ok: true, spaces: spaces.map(space => serializeSpace(space)) });
  } catch (error) {
    console.error('Failed to fetch Spaces', error);
    return res.status(500).json({ ok: false, message: 'Failed to load Spaces' });
  }
});

router.get('/assets/available', requireAuth, async (req: any, res: any) => {
  try {
    const spaces = await Space.find({ 'members.userId': req.user.userId }).select('name icon isPublic inviteCode emojis stickers');
    const emojis = spaces.flatMap(space => space.emojis.map(asset => ({
      id: asset.id,
      name: asset.name,
      url: asset.url,
      animated: Boolean(asset.animated),
      spaceId: String(space._id || space.id),
      spaceName: space.name,
      spaceIcon: space.icon || '',
      spaceIsPublic: Boolean(space.isPublic),
      spaceInviteCode: space.inviteCode || ''
    })));
    const stickers = spaces.flatMap(space => space.stickers.map(asset => ({
      id: asset.id,
      name: asset.name,
      url: asset.url,
      animated: Boolean(asset.animated),
      associatedEmoji: asset.associatedEmoji || '',
      spaceId: String(space._id || space.id),
      spaceName: space.name,
      spaceIcon: space.icon || '',
      spaceIsPublic: Boolean(space.isPublic),
      spaceInviteCode: space.inviteCode || ''
    })));
    return res.json({ ok: true, emojis, stickers });
  } catch (error) {
    console.error('Failed to fetch available Space assets', error);
    return res.status(500).json({ ok: false, message: 'Failed to load available Space assets.' });
  }
});

router.get('/asset-info', requireAuth, async (req: any, res: any) => {
  try {
    const spaceId = typeof req.query.spaceId === 'string' ? req.query.spaceId : '';
    const name = typeof req.query.name === 'string' ? req.query.name.toLowerCase() : '';
    const kind = typeof req.query.type === 'string' ? req.query.type : 'emoji';
    if (!spaceId) return res.status(400).json({ ok: false, message: 'spaceId is required' });

    const space = await findSpace(spaceId);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    let asset: any = null;
    if (kind === 'sticker') {
      asset = space.stickers.find(s => s.name.toLowerCase() === name || s.id === name || (req.query.url && s.url === req.query.url));
      if (!asset && req.query.url) {
        asset = space.stickers.find(s => s.url === req.query.url);
      }
    } else {
      asset = space.emojis.find(e => e.name.toLowerCase() === name || e.id === name);
      if (!asset && req.query.url) {
        asset = space.emojis.find(e => e.url === req.query.url);
      }
    }

    const isMember = Boolean(space.members.some(m => m.userId === req.user.userId));

    return res.json({
      ok: true,
      asset: asset ? {
        id: asset.id,
        name: asset.name,
        url: asset.url,
        animated: Boolean(asset.animated),
        associatedEmoji: asset.associatedEmoji || '',
        kind: kind === 'sticker' ? 'sticker' : 'emoji'
      } : {
        name: name || 'Custom',
        url: typeof req.query.url === 'string' ? req.query.url : '',
        kind: kind === 'sticker' ? 'sticker' : 'emoji'
      },
      space: {
        id: String(space._id || space.id),
        name: space.name,
        icon: space.icon || '',
        description: space.description || '',
        isPublic: Boolean(space.isPublic),
        isMember,
        memberCount: space.members.length,
        inviteCode: space.isPublic ? (space.inviteCode || '') : ''
      }
    });
  } catch (error) {
    console.error('Failed to get asset info', error);
    return res.status(500).json({ ok: false, message: 'Failed to retrieve asset details' });
  }
});

router.patch('/:id/invites/pause', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (space.ownerId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the Space owner can pause invites.' });
    if (typeof req.body?.paused !== 'boolean') return res.status(400).json({ ok: false, message: 'Choose whether invites should be paused.' });
    space.invitesPaused = req.body.paused;
    await space.save();
    return res.json({ ok: true, invitesPaused: space.invitesPaused });
  } catch (error) {
    console.error('Failed to update Space invite pause state', error);
    return res.status(500).json({ ok: false, message: 'Could not update invite settings.' });
  }
});

router.get('/explore', requireAuth, async (req: any, res: any) => {
  try {
    const filter: Record<string, unknown> = { isPublic: true };
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (category && !discoveryCategories.includes(category)) {
      return res.status(400).json({ ok: false, message: 'Choose a valid discovery category.' });
    }
    if (category && discoveryCategories.includes(category)) filter.discoveryCategory = category;
    if (query) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escapedQuery, 'i');
      filter.$or = [{ name: search }, { description: search }, { discoveryTags: search }];
    }
    const spaces = await Space.find(filter)
      .select('name description icon banner members.userId channels.id discoveryCategory discoveryTags createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      ok: true,
      spaces: spaces.map(space => ({
        id: String(space._id),
        name: space.name,
        description: space.description,
        icon: space.icon,
        banner: space.banner,
        category: space.discoveryCategory || 'Other',
        tags: space.discoveryTags || [],
        memberCount: space.members.length,
        channelCount: space.channels.length,
        createdAt: space.createdAt
      }))
    });
  } catch (error) {
    console.error('Failed to explore public Spaces', error);
    return res.status(500).json({ ok: false, message: 'Could not load public Spaces.' });
  }
});

router.get('/explore/:id', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space || !space.isPublic) return res.status(404).json({ ok: false, message: 'Public Space not found.' });
    const everyoneRole = space.roles.find(role => role.id === 'everyone');
    const channels = space.channels.flatMap(channel => {
      const category = space.categories.find(item => item.id === channel.categoryId);
      const overwrites = [
        ...(category?.permissionOverwrites || []),
        ...channel.permissionOverwrites.filter(overwrite =>
          !category?.permissionOverwrites?.some(item => item.roleId === overwrite.roleId)
        )
      ];
      const everyoneOverwrite = overwrites.find(overwrite => overwrite.roleId === 'everyone');
      let permissions = everyoneRole?.permissions || 0;
      if (everyoneOverwrite) permissions = (permissions & ~everyoneOverwrite.deny) | everyoneOverwrite.allow;
      if (!(permissions & SPACE_PERMISSIONS.VIEW_CHANNEL)) return [];
      return [{
        id: channel.id,
        name: channel.name,
        type: channel.type,
        topic: channel.topic,
        category: category?.name || ''
      }];
    });
    return res.json({
      ok: true,
      space: {
        id: String(space._id),
        name: space.name,
        description: space.description,
        icon: space.icon,
        banner: space.banner,
        category: space.discoveryCategory || 'Other',
        tags: space.discoveryTags || [],
        memberCount: space.members.length,
        channels
      }
    });
  } catch (error) {
    console.error('Failed to preview public Space', error);
    return res.status(500).json({ ok: false, message: 'Could not preview this Space.' });
  }
});

router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const scope = req.body?.scope === 'community' ? 'community' : 'friends';
    const isPublic = req.body?.isPublic === true && scope === 'community';
    const category = typeof req.body?.category === 'string' ? req.body.category : 'Other';
    const tags = Array.isArray(req.body?.tags)
      ? Array.from(new Set(req.body.tags.filter((tag: unknown): tag is string => validName(tag, 24)).map((tag: string) => tag.trim()))).slice(0, 5)
      : [];
    if (!validName(name) || description.length > 1000 || (req.body?.isPublic !== undefined && typeof req.body.isPublic !== 'boolean') ||
      (req.body?.isPublic === true && scope !== 'community') ||
      (req.body?.scope !== undefined && !['friends', 'community'].includes(req.body.scope)) ||
      (req.body?.category !== undefined && !discoveryCategories.includes(category)) ||
      (req.body?.tags !== undefined && (!Array.isArray(req.body.tags) || req.body.tags.length > 5 || req.body.tags.some((tag: unknown) => !validName(tag, 24))))) {
      return res.status(400).json({ ok: false, message: 'Check the Space name, description, listing, and tags.' });
    }
    const user = await User.findById(req.user.id).select('userId');
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const basePermissions = SPACE_PERMISSIONS.VIEW_CHANNEL | SPACE_PERMISSIONS.SEND_MESSAGES |
      SPACE_PERMISSIONS.READ_MESSAGE_HISTORY | SPACE_PERMISSIONS.ADD_REACTIONS |
      SPACE_PERMISSIONS.EMBED_LINKS | SPACE_PERMISSIONS.CREATE_INVITE |
      SPACE_PERMISSIONS.CREATE_PUBLIC_THREADS | SPACE_PERMISSIONS.SEND_MESSAGES_IN_THREADS |
      SPACE_PERMISSIONS.CREATE_EVENTS;
    const space = await Space.create({
      name,
      description,
      ownerId: user.userId,
      inviteCode: makeInviteCode(),
      members: [{ userId: user.userId, roleIds: [], nickname: '', joinedAt: new Date() }],
      roles: [{ id: 'everyone', name: '@everyone', color: '#99aab5', permissions: basePermissions, position: 0, hoist: false, mentionable: false }],
      channels: [
        ...(scope === 'community' ? [
          { id: randomUUID(), name: 'rules', type: 'text', topic: 'Read the community rules before participating.', categoryId: '', position: 0, permissionOverwrites: [] },
          { id: randomUUID(), name: 'announcements', type: 'announcement', topic: 'Important community updates.', categoryId: '', position: 1, permissionOverwrites: [] }
        ] : []),
        { id: randomUUID(), name: 'general', type: 'text', topic: '', categoryId: '', position: scope === 'community' ? 2 : 0, permissionOverwrites: [] },
        { id: randomUUID(), name: 'lounge', type: 'voice', topic: '', categoryId: '', position: scope === 'community' ? 3 : 1, permissionOverwrites: [] }
      ],
      explicitContentFilter: scope === 'community' ? 'membersWithoutRoles' : 'disabled',
      isPublic,
      discoveryCategory: category,
      discoveryTags: tags
    });
    return res.status(201).json({ ok: true, space: serializeSpace(space) });
  } catch (error) {
    console.error('Failed to create Space', error);
    return res.status(500).json({ ok: false, message: 'Failed to create Space' });
  }
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character] as string));
const isEveryoneChannelVisible = (space: ISpace, channel: ISpaceChannel) => {
  let permissions = space.roles.find(role => role.id === 'everyone')?.permissions || 0;
  const layers = [...getCategoryAncestors(space, channel.categoryId).map(category => category.permissionOverwrites || []), channel.permissionOverwrites || []];
  for (const layer of layers) {
    const everyone = layer.find(overwrite => overwrite.roleId === 'everyone');
    if (everyone) permissions = (permissions & ~everyone.deny) | everyone.allow;
  }
  if (permissions & SPACE_PERMISSIONS.ADMINISTRATOR) return true;
  return Boolean(permissions & SPACE_PERMISSIONS.VIEW_CHANNEL);
};

router.get('/:id/widget.json', async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space || !space.isPublic || !space.widgetEnabled) return res.status(404).json({ ok: false, message: 'Public widget is not enabled.' });
    const channel = space.channels.find(item => item.id === space.widgetChannelId);
    if (!channel || channel.type === 'voice' || !isEveryoneChannelVisible(space, channel)) return res.status(404).json({ ok: false, message: 'Widget channel is unavailable.' });
    return res.set('Cache-Control', 'public, max-age=60').json({
      id: String(space.id),
      name: space.name,
      description: space.description,
      icon: space.icon,
      memberCount: space.members.length,
      channel: { id: channel.id, name: channel.name, topic: channel.topic },
      joinUrl: `/?joinSpace=${encodeURIComponent(String(space.id))}`
    });
  } catch (error) {
    console.error('Failed to serve public Space widget data', error);
    return res.status(500).json({ ok: false, message: 'Could not load this Space widget.' });
  }
});

router.get('/:id/widget', async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space || !space.isPublic || !space.widgetEnabled) return res.status(404).type('text').send('Public widget is not enabled.');
    const channel = space.channels.find(item => item.id === space.widgetChannelId);
    if (!channel || channel.type === 'voice' || !isEveryoneChannelVisible(space, channel)) return res.status(404).type('text').send('Widget channel is unavailable.');
    const name = escapeHtml(space.name);
    const description = escapeHtml(space.description);
    const channelName = escapeHtml(channel.name);
    const topic = escapeHtml(channel.topic);
    const icon = space.icon ? `<img src="${escapeHtml(space.icon)}" alt="" width="56" height="56" style="border-radius:16px;object-fit:cover">` : '';
    const joinPath = `/?joinSpace=${encodeURIComponent(String(space.id))}`;
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · Space</title><body style="margin:0;padding:16px;background:transparent;font:14px system-ui,sans-serif;color:#17364a"><article style="box-sizing:border-box;max-width:420px;padding:18px;border:1px solid #ffffff;border-radius:22px;background:linear-gradient(145deg,#f8fdff,#dff5ff);box-shadow:0 12px 30px #12547a30"><div style="display:flex;align-items:center;gap:12px">${icon}<div><strong style="font-size:18px">${name}</strong><div style="color:#42677d">${space.members.length} members</div></div></div><p style="line-height:1.5">${description}</p><div style="padding:10px 12px;border-radius:12px;background:#ffffffa8"><strong>#${channelName}</strong>${topic ? `<div style="margin-top:4px;color:#42677d">${topic}</div>` : ''}</div><a href="${joinPath}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:14px;padding:10px 16px;border-radius:12px;background:#1686bf;color:#fff;text-decoration:none;font-weight:700">Join Space</a></article></body></html>`;
    return res.set('Cache-Control', 'public, max-age=60').type('html').send(html);
  } catch (error) {
    console.error('Failed to serve public Space widget', error);
    return res.status(500).type('text').send('Could not load this Space widget.');
  }
});

router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!getSpaceMember(space, req.user.userId)) return res.status(403).json({ ok: false, message: 'You are not a member of this Space' });
    const memberIds = space.members.map(member => member.userId);
    const users = await User.find({ userId: { $in: memberIds } }).select('userId username displayName avatar publicKey banner bio pronouns status createdAt badges memberNumber themeGradient activity connections');
    const data = serializeSpace(space);
    data.members = data.members.map((member: any) => {
      const user = users.find(item => item.userId === member.userId);
      const safeConnections = (user?.connections || [])
        .filter((c: any) => c.visibleOnProfile !== false)
        .map((c: any) => {
          const { accessToken, refreshToken, ...safe } = c.toObject ? c.toObject() : c;
          return safe;
        });
      return {
        ...member,
        username: user?.username,
        displayName: user?.displayName,
        avatar: user?.avatar,
        publicKey: user?.publicKey,
        banner: user?.banner,
        bio: user?.bio,
        pronouns: user?.pronouns,
        status: user?.status,
        activity: user?.activity,
        connections: safeConnections,
        accountCreatedAt: user?.createdAt,
        badges: user?.badges,
        memberNumber: user?.memberNumber,
        themeGradient: user?.themeGradient
      };
    });
    data.channels = data.channels.filter((channel: ISpaceChannel) => canReadSpaceChannel(space, req.user.userId, channel));
    return res.json({ ok: true, space: data });
  } catch (error) {
    console.error('Failed to load Space', error);
    return res.status(500).json({ ok: false, message: 'Failed to load Space' });
  }
});

router.post('/:id/history/share-keys', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
    if (!space.shareHistoryWithNewMembers) return res.status(403).json({ ok: false, message: 'Message history sharing is disabled by the Space owner.' });
    if (!getSpaceMember(space, req.user.userId)) return res.status(403).json({ ok: false, message: 'You are not a member of this Space.' });
    const targetUserId = req.body?.targetUserId;
    const packets = req.body?.packets;
    if (typeof targetUserId !== 'string' || targetUserId === req.user.userId || !Array.isArray(packets) || packets.length > 100) {
      return res.status(400).json({ ok: false, message: 'Provide a target member and up to 100 message key packets.' });
    }
    const targetMember = getSpaceMember(space, targetUserId);
    if (!targetMember || !targetMember.joinedAt) return res.status(404).json({ ok: false, message: 'Target member is not in this Space.' });
    const targetUser = await User.findOne({ userId: targetUserId }).select('publicKey');
    if (!targetUser?.publicKey) return res.status(409).json({ ok: false, message: 'Target member has not set up an encryption key.' });
    const sourceUserId = req.user.userId;
    const validPackets = packets.filter((packet: any) =>
      packet && typeof packet.messageId === 'string' && mongoose.isValidObjectId(packet.messageId) &&
      typeof packet.wrappedKey === 'string' && Buffer.from(packet.wrappedKey, 'base64').length === 256
    );
    if (validPackets.length !== packets.length) return res.status(400).json({ ok: false, message: 'One or more message key packets are invalid.' });
    const updatedChannels = new Set<string>();
    let sharedCount = 0;
    for (const packet of validPackets) {
      const message = await Message.findById(packet.messageId);
      if (!message || message.createdAt >= targetMember.joinedAt) continue;
      const room = /^space:([0-9a-fA-F]{24}):([a-zA-Z0-9-]{1,64})(?::([a-zA-Z0-9-]{1,64}))?$/.exec(message.roomId);
      if (!room || room[1].toLowerCase() !== String(space.id).toLowerCase()) continue;
      const channel = getSpaceChannel(space, room[2]);
      if (!channel || !canReadSpaceChannel(space, sourceUserId, channel)) continue;
      if (!(await canAccessSpaceRoom(sourceUserId, message.roomId, 'READ_MESSAGE_HISTORY')) ||
        !(await canAccessSpaceRoom(targetUserId, message.roomId, 'READ_MESSAGE_HISTORY'))) continue;
      let envelope: { v?: number; keys?: Record<string, string> };
      try {
        envelope = JSON.parse(message.content);
      } catch {
        continue;
      }
      if (envelope.v !== 3 || !envelope.keys?.[sourceUserId] || envelope.keys[targetUserId]) continue;
      envelope.keys[targetUserId] = packet.wrappedKey;
      message.content = JSON.stringify(envelope);
      await message.save();
      sharedCount += 1;
      updatedChannels.add(room[3] ? `${room[2]}:${room[3]}` : room[2]);
    }
    if (sharedCount) {
      await writeSpaceAudit(space.id, sourceUserId, 'history.keys.shared', targetUserId, { messageCount: sharedCount, channelIds: [...updatedChannels] });
      const io = req.app.get('io');
      if (io) io.to(targetUserId).emit('space:history-shared', { spaceId: String(space.id) });
    }
    return res.json({ ok: true, sharedCount });
  } catch (error) {
    console.error('Failed to share encrypted Space history keys', error);
    return res.status(500).json({ ok: false, message: 'Could not share encrypted message history.' });
  }
});

router.post('/:id/join-public', requireAuth, async (req: any, res: any) => {
  try {
    let space = await findSpace(req.params.id);
    if (!space || !space.isPublic) return res.status(404).json({ ok: false, message: 'Public Space not found.' });
    if (space.bannedUserIds.includes(req.user.userId)) return res.status(403).json({ ok: false, message: 'You are banned from this Space.' });
    if (!getSpaceMember(space, req.user.userId)) {
      if (space.invitesPaused) return res.status(403).json({ ok: false, message: 'New joins are currently paused for this Space.' });
      const user = await User.findOne({ userId: req.user.userId }).select('publicKey createdAt');
      if (space.verificationLevel !== 'none' && !user?.publicKey) return res.status(403).json({ ok: false, message: 'Set up an encryption key before joining this Space.' });
      if (!meetsVerificationLevel(user, space.verificationLevel)) {
        return res.status(403).json({ ok: false, message: `This Space requires an account at least ${verificationAgeLabel(space.verificationLevel)} old.` });
      }
      const initialRoles = (space?.autoRoleId && space?.roles?.some((r: any) => r.id === space?.autoRoleId)) ? [space.autoRoleId] : [];
      const result = await Space.updateOne(
        { _id: space._id, isPublic: true, members: { $not: { $elemMatch: { userId: req.user.userId } } } },
        { $push: { members: { userId: req.user.userId, roleIds: initialRoles, nickname: '', joinedAt: new Date() } } }
      );
      if (result.modifiedCount) {
        space = await Space.findById(space._id);
        if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
        const io = req.app.get('io');
        if (io) await syncSpaceChannelRooms(io, space);
        void handleNikoMemberJoin(req, space, req.user.userId);
      }
    }
    return res.json({ ok: true, space: serializeSpace(space) });
  } catch (error) {
    console.error('Failed to join public Space', error);
    return res.status(500).json({ ok: false, message: 'Could not join this Space.' });
  }
});

router.patch('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission.' });
    const { name, description, icon, banner, verificationLevel, defaultNotifications, explicitContentFilter, isPublic, widgetEnabled, widgetChannelId, shareHistoryWithNewMembers, welcomeChannelId, welcomeMessageTemplate, autoRoleId, systemChannelId, rulesChannelId } = req.body || {};
    if (isPublic !== undefined && typeof isPublic !== 'boolean') return res.status(400).json({ ok: false, message: 'Public listing must be on or off.' });
    if (isPublic !== undefined && space.ownerId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the Space owner can change its public listing.' });
    if (widgetEnabled !== undefined && typeof widgetEnabled !== 'boolean') return res.status(400).json({ ok: false, message: 'Choose whether the public widget should be enabled.' });
    if (widgetEnabled !== undefined && space.ownerId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the Space owner can enable or disable its public widget.' });
    if (shareHistoryWithNewMembers !== undefined && (typeof shareHistoryWithNewMembers !== 'boolean' || space.ownerId !== req.user.userId)) return res.status(403).json({ ok: false, message: 'Only the Space owner can change new-member message history access.' });
    if (widgetChannelId !== undefined && (typeof widgetChannelId !== 'string' || (widgetChannelId && !space.channels.some(channel => channel.id === widgetChannelId && channel.type !== 'voice' && isEveryoneChannelVisible(space, channel))))) return res.status(400).json({ ok: false, message: 'Choose a text channel visible to @everyone.' });
    if (name !== undefined) {
      if (!validName(name)) return res.status(400).json({ ok: false, message: 'Space name must be between 1 and 100 characters.' });
      space.name = name.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 1000) return res.status(400).json({ ok: false, message: 'Description cannot exceed 1,000 characters.' });
      space.description = description.trim();
    }
    if (icon !== undefined) {
      if (typeof icon !== 'string' || icon.length > 2048) return res.status(400).json({ ok: false, message: 'Invalid Space icon.' });
      space.icon = icon;
    }
    if (banner !== undefined) {
      if (typeof banner !== 'string' || banner.length > 2048) return res.status(400).json({ ok: false, message: 'Invalid Space banner.' });
      space.banner = banner;
    }
    if (verificationLevel !== undefined) {
      if (!['none', 'low', 'medium', 'high'].includes(verificationLevel)) return res.status(400).json({ ok: false, message: 'Invalid verification level.' });
      space.verificationLevel = verificationLevel;
    }
    if (defaultNotifications !== undefined) {
      if (!['all', 'mentions'].includes(defaultNotifications)) return res.status(400).json({ ok: false, message: 'Invalid notification setting.' });
      space.defaultNotifications = defaultNotifications;
    }
    if (explicitContentFilter !== undefined) {
      if (!['disabled', 'membersWithoutRoles', 'allMembers'].includes(explicitContentFilter)) return res.status(400).json({ ok: false, message: 'Invalid content filter.' });
      space.explicitContentFilter = explicitContentFilter;
    }
    if (isPublic !== undefined) {
      space.isPublic = isPublic;
      if (!isPublic) space.widgetEnabled = false;
    }
    if (widgetEnabled !== undefined) space.widgetEnabled = widgetEnabled;
    if (widgetChannelId !== undefined) space.widgetChannelId = widgetChannelId;
    if (shareHistoryWithNewMembers !== undefined) space.shareHistoryWithNewMembers = shareHistoryWithNewMembers;
    if (welcomeChannelId !== undefined) space.welcomeChannelId = typeof welcomeChannelId === 'string' ? welcomeChannelId : '';
    if (welcomeMessageTemplate !== undefined) space.welcomeMessageTemplate = typeof welcomeMessageTemplate === 'string' ? welcomeMessageTemplate.slice(0, 500) : '';
    if (autoRoleId !== undefined) space.autoRoleId = typeof autoRoleId === 'string' ? autoRoleId : '';
    if (systemChannelId !== undefined) space.systemChannelId = typeof systemChannelId === 'string' ? systemChannelId : '';
    if (rulesChannelId !== undefined) space.rulesChannelId = typeof rulesChannelId === 'string' ? rulesChannelId : '';
    const widgetChannel = space.channels.find(channel => channel.id === space.widgetChannelId);
    if (space.widgetEnabled && (!space.isPublic || !widgetChannel || widgetChannel.type === 'voice' || !isEveryoneChannelVisible(space, widgetChannel))) return res.status(400).json({ ok: false, message: 'A public Space and an everyone-visible text channel are required to enable the widget.' });
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'space.settings.updated', '', {
      ...(verificationLevel !== undefined ? { verificationLevel } : {}),
      ...(defaultNotifications !== undefined ? { defaultNotifications } : {}),
      ...(explicitContentFilter !== undefined ? { explicitContentFilter } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
      ...(widgetEnabled !== undefined ? { widgetEnabled } : {}),
      ...(shareHistoryWithNewMembers !== undefined ? { shareHistoryWithNewMembers } : {})
    });
    return res.json({ ok: true, space: serializeSpace(space) });
  } catch (error) {
    console.error('Failed to update Space settings', error);
    return res.status(500).json({ ok: false, message: 'Failed to update Space settings' });
  }
});

router.get('/:id/audit-logs', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission to view audit history.' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const logs = await SpaceAuditLog.find({ spaceId: space._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const actorIds = Array.from(new Set(logs.map(log => log.actorId)));
    const actors = await User.find({ userId: { $in: actorIds } }).select('userId username displayName');
    return res.json({
      ok: true,
      logs: logs.map(log => ({
        id: String(log._id),
        actorId: log.actorId,
        actorName: actors.find(actor => actor.userId === log.actorId)?.displayName || actors.find(actor => actor.userId === log.actorId)?.username || log.actorId,
        action: log.action,
        targetId: log.targetId,
        details: log.details,
        createdAt: log.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Failed to load Space audit history', error);
    return res.status(500).json({ ok: false, message: 'Failed to load audit history.' });
  }
});

router.get('/:id/invites', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission to view invites.' });
    return res.json({ ok: true, invites: space.invites, invitesPaused: space.invitesPaused });
  } catch (error) {
    console.error('Failed to list Space invites', error);
    return res.status(500).json({ ok: false, message: 'Failed to load invites' });
  }
});

router.get('/:id/bans', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'BAN_MEMBERS')) return res.status(403).json({ ok: false, message: 'You need Ban Members permission to view the ban list.' });
    const users = await User.find({ userId: { $in: space.bannedUserIds } }).select('userId username displayName avatar');
    const bans = space.bannedUserIds.map(userId => {
      const user = users.find(item => item.userId === userId);
      const details = space.bans.find(ban => ban.userId === userId);
      return {
        userId,
        username: user?.username || '',
        displayName: user?.displayName || '',
        avatar: user?.avatar || '',
        moderatorId: details?.moderatorId || '',
        reason: details?.reason || '',
        bannedAt: details?.bannedAt || null
      };
    });
    return res.json({ ok: true, bans });
  } catch (error) {
    console.error('Failed to list Space bans', error);
    return res.status(500).json({ ok: false, message: 'Failed to load ban list' });
  }
});

router.post('/:id/channels', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const { name, type, topic, categoryId } = req.body || {};
    if (!validName(name) || !['text', 'voice', 'announcement', 'forum'].includes(type)) return res.status(400).json({ ok: false, message: 'Provide a valid channel name and type.' });
    if (categoryId && !space.categories.some(category => category.id === categoryId)) return res.status(400).json({ ok: false, message: 'Selected channel category does not exist.' });
    const channel = { id: randomUUID(), name: name.trim().toLowerCase().replace(/\s+/g, '-'), type: type as SpaceChannelType, topic: typeof topic === 'string' ? topic.slice(0, 1024) : '', categoryId: typeof categoryId === 'string' ? categoryId : '', position: space.channels.length, slowmodeSeconds: 0, nsfw: false, forumTags: [], permissionOverwrites: [] };
    space.channels.push(channel);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'channel.created', channel.id, { name: channel.name, type: channel.type, categoryId: channel.categoryId });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.status(201).json({ ok: true, channel });
  } catch (error) {
    console.error('Failed to create Space channel', error);
    return res.status(500).json({ ok: false, message: 'Failed to create channel' });
  }
});

router.patch('/:id/channels/:channelId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const channel = getSpaceChannel(space, req.params.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found' });
    const { name, topic, permissionOverwrites, position, slowmodeSeconds, nsfw, forumTags, bitrate, userLimit, inactivityHideDays } = req.body || {};
    if (name !== undefined) {
      if (!validName(name)) return res.status(400).json({ ok: false, message: 'Channel name must be between 1 and 100 characters.' });
      channel.name = name.trim().toLowerCase().replace(/\s+/g, '-');
    }
    if (topic !== undefined) {
      if (typeof topic !== 'string' || topic.length > 1024) return res.status(400).json({ ok: false, message: 'Channel topic cannot exceed 1,024 characters.' });
      channel.topic = topic;
    }
    if (slowmodeSeconds !== undefined) {
      if (!Number.isInteger(slowmodeSeconds) || slowmodeSeconds < 0 || slowmodeSeconds > 21600) return res.status(400).json({ ok: false, message: 'Slowmode must be between 0 and 21,600 seconds.' });
      channel.slowmodeSeconds = slowmodeSeconds;
    }
    if (nsfw !== undefined) {
      if (typeof nsfw !== 'boolean') return res.status(400).json({ ok: false, message: 'Channel age-restriction setting must be a boolean.' });
      channel.nsfw = nsfw;
    }
    if (bitrate !== undefined) {
      if (!Number.isInteger(bitrate) || bitrate < 8000 || bitrate > 384000) return res.status(400).json({ ok: false, message: 'Bitrate must be between 8 and 384 kbps.' });
      channel.bitrate = bitrate;
    }
    if (userLimit !== undefined) {
      if (!Number.isInteger(userLimit) || userLimit < 0 || userLimit > 99) return res.status(400).json({ ok: false, message: 'User limit must be between 0 and 99.' });
      channel.userLimit = userLimit;
    }
    if (inactivityHideDays !== undefined) {
      if (!Number.isInteger(inactivityHideDays) || inactivityHideDays < 0 || inactivityHideDays > 365) return res.status(400).json({ ok: false, message: 'Inactivity hide days must be between 0 and 365.' });
      channel.inactivityHideDays = inactivityHideDays;
    }
    if (forumTags !== undefined) {
      if (!Array.isArray(forumTags) || forumTags.length > 20 || forumTags.some((tag: unknown) => !validName(tag, 20))) return res.status(400).json({ ok: false, message: 'Forum tags must contain up to 20 names of 20 characters or fewer.' });
      if (channel.type !== 'forum') return res.status(400).json({ ok: false, message: 'Tags are only available on forum channels.' });
      channel.forumTags = Array.from(new Set(forumTags.map((tag: string) => tag.trim())));
    }
    if (req.body.categoryId !== undefined) {
      if (typeof req.body.categoryId !== 'string' || (req.body.categoryId && !space.categories.some(category => category.id === req.body.categoryId))) return res.status(400).json({ ok: false, message: 'Selected channel category does not exist.' });
      channel.categoryId = req.body.categoryId;
    }
    if (position !== undefined) {
      if (!Number.isInteger(position) || position < 0 || position >= space.channels.length) return res.status(400).json({ ok: false, message: 'Channel position is invalid.' });
      space.channels.sort((left, right) => left.position - right.position);
      space.channels.splice(space.channels.indexOf(channel), 1);
      space.channels.splice(position, 0, channel);
      space.channels.forEach((item, index) => { item.position = index; });
    }
    if (permissionOverwrites !== undefined) {
      if (!Array.isArray(permissionOverwrites) || permissionOverwrites.length > 100 || permissionOverwrites.some((item: any) =>
        !item || typeof item.roleId !== 'string' ||
        (item.roleId !== 'everyone' && !space.roles.some(role => role.id === item.roleId) && !space.members.some(member => member.userId === item.roleId)) ||
        !parsePermissionBits(item.allow) || !parsePermissionBits(item.deny) ||
        (space.ownerId !== req.user.userId && ((item.allow & ~getSpacePermissions(space, req.user.userId)) !== 0 || (item.allow & SPACE_PERMISSIONS.ADMINISTRATOR) !== 0))
      )) return res.status(400).json({ ok: false, message: 'Invalid channel permission overwrites.' });
      channel.permissionOverwrites = permissionOverwrites;
    }
    if (space.widgetEnabled && channel.id === space.widgetChannelId && !isEveryoneChannelVisible(space, channel)) return res.status(400).json({ ok: false, message: 'The widget channel must remain visible to @everyone.' });
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'channel.updated', channel.id, { name: channel.name, categoryId: channel.categoryId, position: channel.position });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true, channel });
  } catch (error) {
    console.error('Failed to update channel', error);
    return res.status(500).json({ ok: false, message: 'Failed to update channel' });
  }
});

router.post('/:id/channels/:channelId/sync-permissions', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const channel = getSpaceChannel(space, req.params.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found' });

    const category = space.categories.find(item => item.id === channel.categoryId);
    channel.permissionOverwrites = category ? JSON.parse(JSON.stringify(category.permissionOverwrites || [])) : [];

    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'channel.updated', channel.id, { name: channel.name, syncedPermissions: true });
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      for (const member of space.members) io.to(member.userId).emit('space:updated', { spaceId: String(space.id) });
    }
    return res.json({ ok: true, channel });
  } catch (error) {
    console.error('Failed to sync channel permissions', error);
    return res.status(500).json({ ok: false, message: 'Failed to sync channel permissions' });
  }
});

router.put('/:id/channels-reorder', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });

    const { channels, categories } = req.body || {};
    if (Array.isArray(channels)) {
      for (const item of channels) {
        const ch = space.channels.find(c => c.id === item.id);
        if (ch) {
          if (Number.isInteger(item.position)) ch.position = item.position;
          if (item.categoryId !== undefined) {
            if (item.categoryId === '' || space.categories.some(cat => cat.id === item.categoryId)) {
              ch.categoryId = item.categoryId;
            }
          }
        }
      }
      space.channels.sort((a, b) => a.position - b.position);
      space.channels.forEach((c, i) => { c.position = i; });
    }

    if (Array.isArray(categories)) {
      for (const item of categories) {
        const cat = space.categories.find(c => c.id === item.id);
        if (cat && Number.isInteger(item.position)) {
          cat.position = item.position;
        }
      }
      space.categories.sort((a, b) => a.position - b.position);
      space.categories.forEach((c, i) => { c.position = i; });
    }

    await space.save();
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      for (const member of space.members) io.to(member.userId).emit('space:updated', { spaceId: String(space.id) });
    }
    return res.json({ ok: true, channels: space.channels, categories: space.categories });
  } catch (error) {
    console.error('Failed to reorder channels', error);
    return res.status(500).json({ ok: false, message: 'Failed to reorder channels' });
  }
});

router.delete('/:id/channels/:channelId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    if (space.channels.length <= 1) return res.status(400).json({ ok: false, message: 'A Space must keep at least one channel.' });
    const channel = getSpaceChannel(space, req.params.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found' });
    if (channel.id === space.widgetChannelId) {
      space.widgetEnabled = false;
      space.widgetChannelId = '';
    }
    const threads = await SpaceThread.find({ spaceId: space._id, channelId: channel.id }).select('_id');
    space.channels.splice(space.channels.indexOf(channel), 1);
    await space.save();
    const threadRoomIds = threads.map(thread => `space:${space.id}:${channel.id}:${thread.id}`);
    await Promise.all([
      SpaceThread.deleteMany({ spaceId: space._id, channelId: channel.id }),
      Message.deleteMany({ roomId: { $in: [`space:${space.id}:${channel.id}`, ...threadRoomIds] } })
    ]);
    await writeSpaceAudit(space.id, req.user.userId, 'channel.deleted', channel.id, { name: channel.name });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete channel', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete channel' });
  }
});

router.get('/:id/channels/:channelId/invites', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'CREATE_INVITE')) return res.status(403).json({ ok: false, message: 'You need Create Invite permission.' });
    const invites = (space.invites || []).filter(item => item.channelId === req.params.channelId);
    return res.json({ ok: true, invites });
  } catch (error) {
    console.error('Failed to list channel invites', error);
    return res.status(500).json({ ok: false, message: 'Failed to list channel invites' });
  }
});

router.post('/:id/channels/:channelId/invites', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'CREATE_INVITE')) return res.status(403).json({ ok: false, message: 'You need Create Invite permission.' });
    const channel = getSpaceChannel(space, req.params.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found' });

    const { maxUses, maxAgeSeconds } = req.body || {};
    const code = randomUUID().replace(/-/g, '').slice(0, 8);
    const expiresAt = maxAgeSeconds && Number.isInteger(maxAgeSeconds) && maxAgeSeconds > 0
      ? new Date(Date.now() + maxAgeSeconds * 1000)
      : undefined;
    const invite = {
      code,
      creatorId: req.user.userId,
      createdAt: new Date(),
      expiresAt,
      maxUses: maxUses && Number.isInteger(maxUses) && maxUses > 0 ? maxUses : undefined,
      uses: 0,
      channelId: channel.id
    };
    space.invites.push(invite);
    await space.save();
    return res.status(201).json({ ok: true, invite });
  } catch (error) {
    console.error('Failed to create channel invite', error);
    return res.status(500).json({ ok: false, message: 'Failed to create channel invite' });
  }
});

router.delete('/:id/channels/:channelId/invites/:code', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'CREATE_INVITE')) return res.status(403).json({ ok: false, message: 'You need Create Invite permission.' });
    const idx = (space.invites || []).findIndex(item => item.code === req.params.code);
    if (idx >= 0) {
      space.invites.splice(idx, 1);
      await space.save();
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete channel invite', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete channel invite' });
  }
});

router.get('/:id/channels/:channelId/webhooks', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_WEBHOOKS')) return res.status(403).json({ ok: false, message: 'You need Manage Webhooks permission.' });
    const webhooks = await SpaceWebhook.find({ spaceId: String(space._id), channelId: req.params.channelId }).sort({ createdAt: -1 });
    return res.json({ ok: true, webhooks });
  } catch (error) {
    console.error('Failed to list webhooks', error);
    return res.status(500).json({ ok: false, message: 'Failed to list webhooks' });
  }
});

router.post('/:id/channels/:channelId/webhooks', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_WEBHOOKS')) return res.status(403).json({ ok: false, message: 'You need Manage Webhooks permission.' });
    const channel = getSpaceChannel(space, req.params.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found' });

    const count = await SpaceWebhook.countDocuments({ spaceId: String(space._id), channelId: channel.id });
    if (count >= 10) return res.status(400).json({ ok: false, message: 'Maximum 10 webhooks allowed per channel.' });

    const { name, avatar } = req.body || {};
    const webhook = await SpaceWebhook.create({
      id: randomUUID(),
      spaceId: String(space._id),
      channelId: channel.id,
      name: (typeof name === 'string' && name.trim()) ? name.trim().slice(0, 80) : 'Spidey Bot',
      avatar: (typeof avatar === 'string') ? avatar.slice(0, 2048) : '',
      token: randomBytes(24).toString('base64url'),
      creatorId: req.user.userId,
      createdAt: new Date()
    });
    return res.status(201).json({ ok: true, webhook });
  } catch (error) {
    console.error('Failed to create webhook', error);
    return res.status(500).json({ ok: false, message: 'Failed to create webhook' });
  }
});

router.delete('/:id/webhooks/:webhookId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_WEBHOOKS')) return res.status(403).json({ ok: false, message: 'You need Manage Webhooks permission.' });
    await SpaceWebhook.deleteOne({ id: req.params.webhookId, spaceId: String(space._id) });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete webhook', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete webhook' });
  }
});

router.post('/webhooks/:webhookId/:token', async (req: any, res: any) => {
  try {
    const { webhookId, token } = req.params;
    const webhook = await SpaceWebhook.findOne({ id: webhookId, token });
    if (!webhook) return res.status(404).json({ ok: false, message: 'Webhook not found or invalid token.' });

    const space = await Space.findById(webhook.spaceId);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
    const channel = getSpaceChannel(space, webhook.channelId);
    if (!channel) return res.status(404).json({ ok: false, message: 'Channel not found.' });

    const { content, username, avatar_url } = req.body || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ ok: false, message: 'Content is required.' });
    }

    const roomId = `space:${space.id}:${channel.id}`;
    const senderName = (typeof username === 'string' && username.trim()) ? username.trim().slice(0, 80) : webhook.name;
    const avatar = (typeof avatar_url === 'string') ? avatar_url.slice(0, 2048) : webhook.avatar;

    const message = await Message.create({
      roomId,
      senderId: `webhook:${webhook.id}`,
      senderName,
      content: JSON.stringify({ text: content.trim() }),
      createdAt: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('message:receive', {
        id: String(message._id),
        roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        timestamp: message.createdAt.toISOString(),
        avatar
      });
    }

    return res.status(200).json({ ok: true, id: String(message._id) });
  } catch (error) {
    console.error('Failed to execute webhook', error);
    return res.status(500).json({ ok: false, message: 'Failed to execute webhook.' });
  }
});

router.get('/:id/channels/:channelId/threads', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const channel = space && getSpaceChannel(space, req.params.channelId);
    if (!space || !channel) return res.status(404).json({ ok: false, message: 'Channel not found' });
    if (!hasSpacePermission(space, req.user.userId, 'VIEW_CHANNEL', channel)) return res.status(403).json({ ok: false, message: 'You cannot view this channel.' });
    const includeArchived = req.query.includeArchived === 'true' && hasSpacePermission(space, req.user.userId, 'MANAGE_THREADS', channel);
    const threads = await SpaceThread.find({
      spaceId: space._id,
      channelId: channel.id,
      $or: [{ private: false }, { private: { $exists: false } }, { createdBy: req.user.userId }, { memberIds: req.user.userId }],
      ...(includeArchived ? {} : { archived: false })
    }).sort({ lastActivityAt: -1 }).limit(100).lean();
    return res.json({ ok: true, threads: threads.map(thread => ({ ...thread, id: String(thread._id) })) });
  } catch (error) {
    console.error('Failed to load channel threads', error);
    return res.status(500).json({ ok: false, message: 'Failed to load threads' });
  }
});

router.post('/:id/channels/:channelId/threads', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const channel = space && getSpaceChannel(space, req.params.channelId);
    if (!space || !channel) return res.status(404).json({ ok: false, message: 'Channel not found' });
    if (!hasSpacePermission(space, req.user.userId, 'VIEW_CHANNEL', channel)) return res.status(403).json({ ok: false, message: 'You cannot view this channel.' });
    const title = req.body?.title;
    if (!validName(title, 100)) return res.status(400).json({ ok: false, message: 'Thread title must be between 1 and 100 characters.' });
    const starterMessageId = typeof req.body?.starterMessageId === 'string' ? req.body.starterMessageId : '';
    const isPrivate = req.body?.private === true;
    const requestedTags = req.body?.tags;
    const requestedMemberIds = req.body?.memberIds;
    if (requestedMemberIds !== undefined && (!Array.isArray(requestedMemberIds) ||
      requestedMemberIds.some((id: unknown) => typeof id !== 'string' || !getSpaceMember(space, id)))) {
      return res.status(400).json({ ok: false, message: 'Choose current Space members for a private thread.' });
    }
    const memberIds = Array.isArray(requestedMemberIds)
      ? Array.from(new Set(requestedMemberIds.filter((id: unknown): id is string => typeof id === 'string')))
      : [];
    if (channel.type === 'forum') {
      if (!hasSpacePermission(space, req.user.userId, 'SEND_MESSAGES', channel)) return res.status(403).json({ ok: false, message: 'You cannot create a post in this forum.' });
      if (starterMessageId) return res.status(400).json({ ok: false, message: 'Forum posts cannot be attached to another message.' });
      if (requestedTags !== undefined && (!Array.isArray(requestedTags) || requestedTags.length > 5 ||
        requestedTags.some((tag: unknown) => typeof tag !== 'string' || !channel.forumTags.includes(tag)))) {
        return res.status(400).json({ ok: false, message: 'Choose up to five tags configured for this forum.' });
      }
    } else {
      if (requestedTags !== undefined) return res.status(400).json({ ok: false, message: 'Tags are only available on forum posts.' });
      const createPermission = isPrivate ? 'CREATE_PRIVATE_THREADS' : 'CREATE_PUBLIC_THREADS';
      if (!hasSpacePermission(space, req.user.userId, createPermission, channel)) return res.status(403).json({ ok: false, message: `You need ${isPrivate ? 'Create Private Threads' : 'Create Public Threads'} permission.` });
      if (!starterMessageId) return res.status(400).json({ ok: false, message: 'Choose a message to start this thread.' });
      const rootMessage = await Message.findOne({ _id: starterMessageId, roomId: `space:${space.id}:${channel.id}` }).select('_id');
      if (!rootMessage) return res.status(404).json({ ok: false, message: 'The thread’s starting message was not found.' });
    }
    if (memberIds.length > 99) return res.status(400).json({ ok: false, message: 'A thread can include up to 100 members.' });
    if (isPrivate && channel.type === 'forum') return res.status(400).json({ ok: false, message: 'Forum posts are public.' });
    const thread = await SpaceThread.create({
      spaceId: space._id,
      channelId: channel.id,
      title: title.trim(),
      starterMessageId: starterMessageId || undefined,
      createdBy: req.user.userId,
      private: isPrivate,
      memberIds: isPrivate ? Array.from(new Set([req.user.userId, ...memberIds])) : [],
      tags: channel.type === 'forum' && Array.isArray(requestedTags) ? Array.from(new Set(requestedTags.filter((tag: unknown): tag is string => typeof tag === 'string'))) : []
    });
    return res.status(201).json({ ok: true, thread: { ...thread.toObject(), id: String(thread.id) } });
  } catch (error) {
    console.error('Failed to create channel thread', error);
    return res.status(500).json({ ok: false, message: 'Failed to create thread' });
  }
});

router.patch('/:id/threads/:threadId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const thread = space && await SpaceThread.findOne({ _id: req.params.threadId, spaceId: space._id });
    const channel = space && thread && getSpaceChannel(space, thread.channelId);
    if (!space || !thread || !channel) return res.status(404).json({ ok: false, message: 'Thread not found' });
    const canManage = hasSpacePermission(space, req.user.userId, 'MANAGE_THREADS', channel);
    if (!canManage && thread.createdBy !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the thread creator or a moderator can edit this thread.' });
    if (req.body?.title !== undefined) {
      if (!validName(req.body.title, 100)) return res.status(400).json({ ok: false, message: 'Thread title must be between 1 and 100 characters.' });
      thread.title = req.body.title.trim();
    }
    if (req.body?.locked !== undefined || req.body?.archived !== undefined) {
      if (!canManage && (req.body.locked !== undefined || req.body.archived === false)) return res.status(403).json({ ok: false, message: 'Only a thread moderator can lock or reopen threads.' });
      if (req.body.locked !== undefined) {
        if (typeof req.body.locked !== 'boolean') return res.status(400).json({ ok: false, message: 'Thread lock state must be a boolean.' });
        thread.locked = req.body.locked;
      }
      if (req.body.archived !== undefined) {
        if (typeof req.body.archived !== 'boolean') return res.status(400).json({ ok: false, message: 'Thread archive state must be a boolean.' });
        thread.archived = req.body.archived;
        thread.archivedAt = thread.archived ? new Date() : undefined;
      }
    }
    await thread.save();
    const io = req.app.get('io');
    if (io && thread.archived) io.in(`space:${space.id}:${channel.id}:${thread.id}`).socketsLeave(`space:${space.id}:${channel.id}:${thread.id}`);
    return res.json({ ok: true, thread: { ...thread.toObject(), id: String(thread.id) } });
  } catch (error) {
    console.error('Failed to update thread', error);
    return res.status(500).json({ ok: false, message: 'Failed to update thread' });
  }
});

router.delete('/:id/threads/:threadId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const thread = space && await SpaceThread.findOne({ _id: req.params.threadId, spaceId: space._id });
    const channel = space && thread && getSpaceChannel(space, thread.channelId);
    if (!space || !thread || !channel) return res.status(404).json({ ok: false, message: 'Thread not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_THREADS', channel)) return res.status(403).json({ ok: false, message: 'You need Manage Threads permission.' });
    const roomId = `space:${space.id}:${channel.id}:${thread.id}`;
    await Promise.all([Message.deleteMany({ roomId }), thread.deleteOne()]);
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('space:thread-deleted', { threadId: String(thread.id) });
      io.in(roomId).socketsLeave(roomId);
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete thread', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete thread' });
  }
});

router.post('/:id/categories', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    if (!validName(req.body?.name)) return res.status(400).json({ ok: false, message: 'Category name must be between 1 and 100 characters.' });
    const parentId = req.body?.parentId || '';
    if (typeof parentId !== 'string' || (parentId && !space.categories.some(item => item.id === parentId))) return res.status(400).json({ ok: false, message: 'Parent category does not exist.' });
    const siblingPositions = space.categories.filter(item => item.parentId === parentId).map(item => item.position);
    const category = { id: randomUUID(), name: req.body.name.trim(), parentId, position: siblingPositions.length ? Math.max(...siblingPositions) + 1 : 0, permissionOverwrites: [] };
    space.categories.push(category);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'category.created', category.id, { name: category.name, parentId });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.status(201).json({ ok: true, category });
  } catch (error) {
    console.error('Failed to create channel category', error);
    return res.status(500).json({ ok: false, message: 'Failed to create category' });
  }
});

router.patch('/:id/categories/:categoryId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const category = space.categories.find(item => item.id === req.params.categoryId);
    if (!category) return res.status(404).json({ ok: false, message: 'Category not found' });
    const { name, permissionOverwrites, position } = req.body || {};
    if (name !== undefined) {
      if (!validName(name)) return res.status(400).json({ ok: false, message: 'Category name must be between 1 and 100 characters.' });
      category.name = name.trim();
    }
    if (position !== undefined) {
      const siblings = space.categories.filter(item => item.parentId === category.parentId && item.id !== category.id).sort((a, b) => a.position - b.position);
      if (!Number.isInteger(position) || position < 0 || position > siblings.length) return res.status(400).json({ ok: false, message: 'Category position is invalid.' });
      siblings.splice(position, 0, category);
      siblings.forEach((item, index) => { item.position = index; });
    }
    if (req.body.parentId !== undefined) {
      const parentId = req.body.parentId;
      if (typeof parentId !== 'string' || (parentId && !space.categories.some(item => item.id === parentId))) return res.status(400).json({ ok: false, message: 'Parent category does not exist.' });
      if (parentId === category.id || getCategoryAncestors(space, parentId).some(item => item.id === category.id)) {
        return res.status(400).json({ ok: false, message: 'A category cannot be nested inside itself or one of its descendants.' });
      }
      category.parentId = parentId;
      category.position = space.categories.filter(item => item.parentId === parentId && item.id !== category.id).length;
    }
    if (permissionOverwrites !== undefined) {
      if (!Array.isArray(permissionOverwrites) || permissionOverwrites.length > 100 || permissionOverwrites.some((item: any) =>
        !item || typeof item.roleId !== 'string' ||
        (item.roleId !== 'everyone' && !space.roles.some(role => role.id === item.roleId) && !space.members.some(member => member.userId === item.roleId)) ||
        !parsePermissionBits(item.allow) || !parsePermissionBits(item.deny) ||
        (space.ownerId !== req.user.userId && ((item.allow & ~getSpacePermissions(space, req.user.userId)) !== 0 || (item.allow & SPACE_PERMISSIONS.ADMINISTRATOR) !== 0))
      )) return res.status(400).json({ ok: false, message: 'Invalid category permission overwrites.' });
      category.permissionOverwrites = permissionOverwrites;
    }
    if (space.widgetEnabled) {
      const widgetChannel = space.channels.find(channel => channel.id === space.widgetChannelId);
      if (widgetChannel?.categoryId === category.id && !isEveryoneChannelVisible(space, widgetChannel)) {
        return res.status(400).json({ ok: false, message: 'The widget channel must remain visible to @everyone.' });
      }
    }
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'category.updated', category.id, { name: category.name, parentId: category.parentId });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true, category });
  } catch (error) {
    console.error('Failed to update channel category', error);
    return res.status(500).json({ ok: false, message: 'Failed to update category' });
  }
});

router.post('/:id/categories/:categoryId/sync-channels', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const category = space.categories.find(item => item.id === req.params.categoryId);
    if (!category) return res.status(404).json({ ok: false, message: 'Category not found' });

    const catOverwrites = JSON.parse(JSON.stringify(category.permissionOverwrites || []));
    for (const channel of space.channels) {
      if (channel.categoryId === category.id) {
        channel.permissionOverwrites = JSON.parse(JSON.stringify(catOverwrites));
      }
    }
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'category.updated', category.id, { name: category.name, syncedChannels: true });
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      for (const member of space.members) io.to(member.userId).emit('space:updated', { spaceId: String(space.id) });
    }
    return res.json({ ok: true, channels: space.channels });
  } catch (error) {
    console.error('Failed to sync category channels', error);
    return res.status(500).json({ ok: false, message: 'Failed to sync category channels' });
  }
});

router.delete('/:id/categories/:categoryId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
    const category = space.categories.find(item => item.id === req.params.categoryId);
    if (!category) return res.status(404).json({ ok: false, message: 'Category not found' });
    const parentId = category.parentId || '';
    space.categories.splice(space.categories.indexOf(category), 1);
    for (const child of space.categories) if (child.parentId === category.id) child.parentId = parentId;
    for (const channel of space.channels) if (channel.categoryId === category.id) channel.categoryId = parentId;
    const widgetChannel = space.channels.find(channel => channel.id === space.widgetChannelId);
    if (space.widgetEnabled && widgetChannel && !isEveryoneChannelVisible(space, widgetChannel)) {
      return res.status(400).json({ ok: false, message: 'The widget channel must remain visible to @everyone.' });
    }
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'category.deleted', category.id, { name: category.name });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete channel category', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete category' });
  }
});

router.post('/:id/roles', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_ROLES')) return res.status(403).json({ ok: false, message: 'You need Manage Roles permission.' });
    const { name, color, icon, permissions, hoist, mentionable } = req.body || {};
    if (!validName(name) || name.trim().length > 100 || !parsePermissionBits(permissions) ||
      (color !== undefined && (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))) ||
      (icon !== undefined && (typeof icon !== 'string' || icon.length > 2048))) {
      return res.status(400).json({ ok: false, message: 'Invalid role name, color, or permission set.' });
    }
    const role: ISpaceRole = { id: randomUUID(), name: name.trim(), color: color || '#99aab5', icon: icon?.trim() || '', permissions, position: space.roles.length, hoist: Boolean(hoist), mentionable: Boolean(mentionable) };
    if (space.ownerId !== req.user.userId) {
      const granted = getSpacePermissions(space, req.user.userId);
      if ((permissions & ~granted) !== 0 || (permissions & SPACE_PERMISSIONS.ADMINISTRATOR) !== 0) return res.status(403).json({ ok: false, message: 'You cannot grant permissions you do not have.' });
    }
    space.roles.push(role);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'role.created', role.id, { name: role.name, permissions: role.permissions });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.status(201).json({ ok: true, role });
  } catch (error) {
    console.error('Failed to create role', error);
    return res.status(500).json({ ok: false, message: 'Failed to create role' });
  }
});

router.patch('/:id/roles/:roleId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_ROLES')) return res.status(403).json({ ok: false, message: 'You need Manage Roles permission.' });
    const role = space.roles.find(item => item.id === req.params.roleId);
    if (!role) return res.status(404).json({ ok: false, message: 'Role not found' });
    if (!canManageRole(space, req.user.userId, role)) return res.status(403).json({ ok: false, message: 'Your role is not high enough to edit this role.' });
    const previousIcon = role.icon;
    const { name, color, icon, permissions, hoist, mentionable, position } = req.body || {};
    if (name !== undefined) {
      if (!validName(name)) return res.status(400).json({ ok: false, message: 'Role name must be between 1 and 100 characters.' });
      role.name = name.trim();
    }
    if (color !== undefined) {
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ ok: false, message: 'Invalid role color.' });
      role.color = color;
    }
    if (icon !== undefined) {
      if (typeof icon !== 'string' || icon.length > 2048) return res.status(400).json({ ok: false, message: 'Role icon is invalid.' });
      role.icon = icon.trim();
    }
    if (permissions !== undefined) {
      if (!parsePermissionBits(permissions)) return res.status(400).json({ ok: false, message: 'Invalid permissions.' });
      if (space.ownerId !== req.user.userId && ((permissions & ~getSpacePermissions(space, req.user.userId)) !== 0 || (permissions & SPACE_PERMISSIONS.ADMINISTRATOR) !== 0)) return res.status(403).json({ ok: false, message: 'You cannot grant permissions you do not have.' });
      role.permissions = permissions;
    }
    if (position !== undefined) {
      if (!Number.isInteger(position) || position < 1 || position >= space.roles.length) return res.status(400).json({ ok: false, message: 'Role position is invalid.' });
      const actor = getSpaceMember(space, req.user.userId);
      const actorTopPosition = Math.max(0, ...space.roles.filter(item => actor?.roleIds.includes(item.id)).map(item => item.position));
      if (space.ownerId !== req.user.userId && position >= actorTopPosition) return res.status(403).json({ ok: false, message: 'You cannot move a role above your highest role.' });
      space.roles.sort((left, right) => left.position - right.position);
      space.roles.splice(space.roles.indexOf(role), 1);
      space.roles.splice(position, 0, role);
      space.roles.forEach((item, index) => { item.position = index; });
    }
    if (hoist !== undefined) role.hoist = Boolean(hoist);
    if (mentionable !== undefined) role.mentionable = Boolean(mentionable);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'role.updated', role.id, { name: role.name, permissions: role.permissions, position: role.position, mentionable: role.mentionable });
    if (icon !== undefined && previousIcon !== role.icon) await removeUploadedAssetFile(String(space.id), previousIcon || '');
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true, role });
  } catch (error) {
    console.error('Failed to update role', error);
    return res.status(500).json({ ok: false, message: 'Failed to update role' });
  }
});

router.post('/:id/roles/:roleId/icon', requireAuth, assetUpload, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    const role = space.roles.find(item => item.id === req.params.roleId);
    if (!role || role.id === 'everyone') return res.status(404).json({ ok: false, message: 'Role not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_ROLES') || !canManageRole(space, req.user.userId, role)) {
      return res.status(403).json({ ok: false, message: 'You cannot edit this role.' });
    }
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) return res.status(400).json({ ok: false, message: 'Choose a role icon to upload.' });
    if (req.file.size > EMOJI_FILE_LIMIT) return res.status(413).json({ ok: false, message: 'Role icons must be 256 KB or smaller.' });
    const extension = allowedUploadedImage(req.file.buffer);
    if (!extension) return res.status(415).json({ ok: false, message: 'Upload a PNG, JPEG, WebP, or GIF role icon.' });
    const dimensions = imageDimensions(req.file.buffer, extension);
    if (!dimensions || dimensions.width !== dimensions.height) return res.status(400).json({ ok: false, message: 'Role icons must be square images.' });
    const fileName = `${randomUUID()}.${extension}`;
    const directory = path.join(__dirname, '../../uploads/spaces', String(space.id));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, fileName), req.file.buffer, { flag: 'wx' });
    const url = `/uploads/spaces/${space.id}/${fileName}`;
    const previousUrl = role.icon || '';
    role.icon = url;
    try {
      await space.save();
    } catch (error) {
      await removeUploadedAssetFile(String(space.id), url);
      throw error;
    }
    await removeUploadedAssetFile(String(space.id), previousUrl);
    await writeSpaceAudit(space.id, req.user.userId, 'role.icon.updated', role.id, { icon: url });
    return res.json({ ok: true, role });
  } catch (error) {
    console.error('Failed to upload Space role icon', error);
    return res.status(500).json({ ok: false, message: 'Could not upload this role icon.' });
  }
});

router.delete('/:id/roles/:roleId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    const role = space.roles.find(item => item.id === req.params.roleId);
    if (!role) return res.status(404).json({ ok: false, message: 'Role not found' });
    if (role.id === 'everyone') return res.status(400).json({ ok: false, message: 'The default @everyone role cannot be deleted.' });
    if (!canManageRole(space, req.user.userId, role)) return res.status(403).json({ ok: false, message: 'Your role is not high enough to delete this role.' });
    space.roles.splice(space.roles.indexOf(role), 1);
    for (const member of space.members) member.roleIds = member.roleIds.filter(id => id !== role.id);
    removePermissionOverwrites(space, role.id);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'role.deleted', role.id, { name: role.name });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete role', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete role' });
  }
});

router.get('/:id/members/:userId/moderation', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
    const mayReview = ['MANAGE_ROLES', 'MANAGE_MESSAGES', 'MODERATE_MEMBERS', 'KICK_MEMBERS', 'BAN_MEMBERS']
      .some(permission => hasSpacePermission(space, req.user.userId, permission as SpacePermission));
    if (!mayReview) return res.status(403).json({ ok: false, message: 'You need a moderation permission to view member details.' });
    const member = getSpaceMember(space, req.params.userId);
    if (!member) return res.status(404).json({ ok: false, message: 'Space member not found.' });
    const [user, roomActivity] = await Promise.all([
      User.findOne({ userId: member.userId }).select('username displayName avatar createdAt status').lean(),
      Message.aggregate<{ _id: string; count: number; lastMessageAt: Date }>([
        { $match: { senderId: member.userId, roomId: new RegExp(`^space:${String(space.id)}:`), isSystemMessage: false } },
        { $group: { _id: '$roomId', count: { $sum: 1 }, lastMessageAt: { $max: '$createdAt' } } }
      ])
    ]);
    const activityByChannel = roomActivity.reduce((totals: Record<string, { count: number; lastMessageAt: Date }>, activity: { _id: string; count: number; lastMessageAt: Date }) => {
      const channelId = activity._id.split(':')[2];
      if (!channelId) return totals;
      const current = totals[channelId] || { count: 0, lastMessageAt: activity.lastMessageAt };
      current.count += activity.count;
      if (activity.lastMessageAt > current.lastMessageAt) current.lastMessageAt = activity.lastMessageAt;
      totals[channelId] = current;
      return totals;
    }, {});
    const lastMessageAt = Object.values(activityByChannel).reduce<Date | null>((latest, item) => !latest || item.lastMessageAt > latest ? item.lastMessageAt : latest, null);
    return res.json({
      ok: true,
      member: {
        userId: member.userId,
        username: user?.username || 'Unknown member',
        displayName: user?.displayName || '',
        avatar: user?.avatar || '',
        joinedAt: member.joinedAt,
        mutedUntil: member.mutedUntil || null,
        accountCreatedAt: user?.createdAt || null,
        roles: space.roles.filter(role => member.roleIds.includes(role.id)).sort((a, b) => b.position - a.position).map(role => ({ id: role.id, name: role.name, color: role.color })),
        messageCount: Object.values(activityByChannel).reduce((total, item) => total + item.count, 0),
        lastMessageAt,
        messagesByChannel: Object.entries(activityByChannel).map(([channelId, activity]) => ({
          channelId,
          channelName: space.channels.find(channel => channel.id === channelId)?.name || 'Deleted channel',
          count: activity.count,
          lastMessageAt: activity.lastMessageAt
        })).sort((a, b) => b.count - a.count)
      }
    });
  } catch (error) {
    console.error('Failed to load Space member moderation details', error);
    return res.status(500).json({ ok: false, message: 'Could not load member details.' });
  }
});

router.patch('/:id/members/:userId/timeout', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found.' });
    if (!hasSpacePermission(space, req.user.userId, 'MODERATE_MEMBERS')) return res.status(403).json({ ok: false, message: 'You need Moderate Members permission.' });
    if (req.params.userId === space.ownerId) return res.status(400).json({ ok: false, message: 'The Space owner cannot be muted.' });
    const target = getSpaceMember(space, req.params.userId);
    if (!target) return res.status(404).json({ ok: false, message: 'Space member not found.' });
    const actor = getSpaceMember(space, req.user.userId);
    const actorTop = Math.max(0, ...space.roles.filter(role => actor?.roleIds.includes(role.id)).map(role => role.position));
    const targetTop = Math.max(0, ...space.roles.filter(role => target.roleIds.includes(role.id)).map(role => role.position));
    if (space.ownerId !== req.user.userId && actorTop <= targetTop) return res.status(403).json({ ok: false, message: 'Your role is not high enough to manage this member.' });
    const durationMinutes = req.body?.durationMinutes;
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 40320)) {
      return res.status(400).json({ ok: false, message: 'Timeout must be between 1 minute and 28 days, or zero to remove it.' });
    }
    target.mutedUntil = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : undefined;
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.timeout.updated', target.userId, { mutedUntil: target.mutedUntil?.toISOString() || null });
    const io = req.app.get('io');
    if (io) for (const member of space.members) io.to(member.userId).emit('space:updated', { spaceId: String(space.id) });
    return res.json({ ok: true, mutedUntil: target.mutedUntil || null });
  } catch (error) {
    console.error('Failed to update Space member timeout', error);
    return res.status(500).json({ ok: false, message: 'Could not update member timeout.' });
  }
});

router.put('/:id/members/:userId/roles', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_ROLES')) return res.status(403).json({ ok: false, message: 'You need Manage Roles permission.' });
    const member = getSpaceMember(space, req.params.userId);
    if (!member) return res.status(404).json({ ok: false, message: 'Space member not found' });
    const roleIds = req.body?.roleIds;
    if (!Array.isArray(roleIds) || roleIds.some((id: unknown) => typeof id !== 'string' || id === 'everyone' || !space.roles.some(role => role.id === id))) return res.status(400).json({ ok: false, message: 'Invalid role list.' });
    const temporaryRoleHours = req.body?.temporaryRoleHours || {};
    if (!temporaryRoleHours || typeof temporaryRoleHours !== 'object' || Array.isArray(temporaryRoleHours) ||
      Object.entries(temporaryRoleHours).some(([roleId, hours]) =>
        !roleIds.includes(roleId) || !Number.isInteger(hours) || Number(hours) < 1 || Number(hours) > 8760
      )) return res.status(400).json({ ok: false, message: 'Temporary role durations must be between 1 hour and 1 year.' });
    const requestedRoles = space.roles.filter(role => roleIds.includes(role.id));
    if (requestedRoles.some(role => !canManageRole(space, req.user.userId, role))) return res.status(403).json({ ok: false, message: 'Your role is not high enough to assign one of these roles.' });
    const previousRoleIds = [...member.roleIds];
    const previousTemporary = member.temporaryRoleAssignments || [];
    member.roleIds = Array.from(new Set(roleIds));
    member.temporaryRoleAssignments = member.roleIds.flatMap(roleId => {
      const hours = (temporaryRoleHours as Record<string, number>)[roleId];
      const existing = previousTemporary.find(assignment => assignment.roleId === roleId && assignment.expiresAt > new Date());
      if (hours) return [{ roleId, expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000) }];
      return existing ? [existing] : [];
    }) as typeof member.temporaryRoleAssignments;
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.roles.updated', member.userId, {
      added: member.roleIds.filter(id => !previousRoleIds.includes(id)),
      removed: previousRoleIds.filter(id => !member.roleIds.includes(id)),
      temporaryRoleHours
    });
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true, roleIds: member.roleIds, temporaryRoleAssignments: member.temporaryRoleAssignments });
  } catch (error) {
    console.error('Failed to update member roles', error);
    return res.status(500).json({ ok: false, message: 'Failed to update member roles' });
  }
});

router.patch('/:id/members/:userId/nickname', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    const target = getSpaceMember(space, req.params.userId);
    if (!target) return res.status(404).json({ ok: false, message: 'Space member not found' });
    const nickname = req.body?.nickname;
    if (typeof nickname !== 'string' || nickname.trim().length > 32) return res.status(400).json({ ok: false, message: 'Nickname must be 32 characters or fewer.' });
    const isSelf = req.params.userId === req.user.userId;
    if (isSelf) {
      if (!hasSpacePermission(space, req.user.userId, 'CHANGE_NICKNAME')) return res.status(403).json({ ok: false, message: 'You cannot change your nickname in this Space.' });
    } else {
      if (!hasSpacePermission(space, req.user.userId, 'MANAGE_NICKNAMES')) return res.status(403).json({ ok: false, message: 'You need Manage Nicknames permission.' });
      if (req.params.userId === space.ownerId) return res.status(403).json({ ok: false, message: 'The Space owner’s nickname cannot be changed.' });
      const actor = getSpaceMember(space, req.user.userId);
      const actorTop = Math.max(0, ...space.roles.filter(role => actor?.roleIds.includes(role.id)).map(role => role.position));
      const targetTop = Math.max(0, ...space.roles.filter(role => target.roleIds.includes(role.id)).map(role => role.position));
      if (space.ownerId !== req.user.userId && actorTop <= targetTop) return res.status(403).json({ ok: false, message: 'Your role is not high enough to change this nickname.' });
    }
    target.nickname = nickname.trim();
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, isSelf ? 'member.nickname.changed' : 'member.nickname.moderated', target.userId, { nickname: target.nickname });
    return res.json({ ok: true, nickname: target.nickname });
  } catch (error) {
    console.error('Failed to update Space nickname', error);
    return res.status(500).json({ ok: false, message: 'Failed to update nickname' });
  }
});

router.post('/:id/invites', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'CREATE_INVITE')) return res.status(403).json({ ok: false, message: 'You cannot create invites in this Space.' });
    const expiresInHours = req.body?.expiresInHours;
    const expiresInMinutes = req.body?.expiresInMinutes;
    const maxUses = req.body?.maxUses;
    if (expiresInHours !== undefined && expiresInMinutes !== undefined) return res.status(400).json({ ok: false, message: 'Provide invite expiry in hours or minutes, not both.' });
    if (expiresInHours !== undefined && (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 720)) return res.status(400).json({ ok: false, message: 'Invite expiry must be between 1 hour and 30 days.' });
    if (expiresInMinutes !== undefined && (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 30 || expiresInMinutes > 43200)) return res.status(400).json({ ok: false, message: 'Invite expiry must be between 30 minutes and 30 days.' });
    if (maxUses !== undefined && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100)) return res.status(400).json({ ok: false, message: 'Invite use limit must be between 1 and 100.' });
    if (space.invitesPaused) return res.status(403).json({ ok: false, message: 'Invites are currently paused for this Space.' });
    const invite = {
      code: makeInviteCode(),
      creatorId: req.user.userId,
      createdAt: new Date(),
      expiresAt: expiresInMinutes
        ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
        : expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : undefined,
      maxUses: maxUses || undefined,
      uses: 0
    };
    space.invites.push(invite);
    await space.save();
    return res.status(201).json({ ok: true, invite });
  } catch (error) {
    console.error('Failed to create invite', error);
    return res.status(500).json({ ok: false, message: 'Failed to create invite' });
  }
});

router.delete('/:id/invites/:code', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission to revoke invites.' });
      const invite = space.invites.find(item => item.code === req.params.code);
    if (!invite) return res.status(404).json({ ok: false, message: 'Invite not found.' });
    space.invites.splice(space.invites.indexOf(invite), 1);
    await space.save();
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to revoke Space invite', error);
    return res.status(500).json({ ok: false, message: 'Failed to revoke invite' });
  }
});

router.get('/:id/events', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!getSpaceMember(space, req.user.userId)) return res.status(403).json({ ok: false, message: 'You are not a member of this Space.' });
    const events = await SpaceEvent.find({
      spaceId: space._id,
      ...(req.query.includePast === 'true' ? {} : { scheduledStartAt: { $gte: new Date() } })
    }).sort({ scheduledStartAt: 1 }).limit(100).lean();
    return res.json({ ok: true, events });
  } catch (error) {
    console.error('Failed to load Space events', error);
    return res.status(500).json({ ok: false, message: 'Failed to load events' });
  }
});

router.post('/:id/events', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'CREATE_EVENTS')) return res.status(403).json({ ok: false, message: 'You need Create Events permission.' });
    const { name, description = '', location = '', scheduledStartAt, scheduledEndAt } = req.body || {};
    const start = new Date(scheduledStartAt);
    const end = scheduledEndAt ? new Date(scheduledEndAt) : undefined;
    if (!validName(name, 100) || typeof description !== 'string' || description.length > 2000 ||
      typeof location !== 'string' || location.length > 200 || !Number.isFinite(start.getTime()) || start <= new Date() ||
      (end && (!Number.isFinite(end.getTime()) || end <= start))) {
      return res.status(400).json({ ok: false, message: 'Provide a name and a valid future start time; an optional end must be later than the start.' });
    }
    const event = await SpaceEvent.create({
      spaceId: space._id,
      name: name.trim(),
      description: description.trim(),
      location: location.trim(),
      scheduledStartAt: start,
      scheduledEndAt: end,
      createdBy: req.user.userId
    });
    const io = req.app.get('io');
    if (io) {
      for (const member of space.members) io.to(member.userId).emit('space:event-created', { spaceId: String(space.id), event });
    }
    return res.status(201).json({ ok: true, event });
  } catch (error) {
    console.error('Failed to create Space event', error);
    return res.status(500).json({ ok: false, message: 'Failed to create event' });
  }
});

router.patch('/:id/events/:eventId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const event = space && await SpaceEvent.findOne({ _id: req.params.eventId, spaceId: space._id });
    if (!space || !event) return res.status(404).json({ ok: false, message: 'Event not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_EVENTS') && event.createdBy !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the event creator or an event moderator can edit it.' });
    const { name, description, location, scheduledStartAt, scheduledEndAt } = req.body || {};
    if (name !== undefined) {
      if (!validName(name, 100)) return res.status(400).json({ ok: false, message: 'Event name must be between 1 and 100 characters.' });
      event.name = name.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 2000) return res.status(400).json({ ok: false, message: 'Event description cannot exceed 2,000 characters.' });
      event.description = description.trim();
    }
    if (location !== undefined) {
      if (typeof location !== 'string' || location.length > 200) return res.status(400).json({ ok: false, message: 'Event location cannot exceed 200 characters.' });
      event.location = location.trim();
    }
    const nextStart = scheduledStartAt === undefined ? event.scheduledStartAt : new Date(scheduledStartAt);
    const nextEnd = scheduledEndAt === undefined ? event.scheduledEndAt : scheduledEndAt ? new Date(scheduledEndAt) : undefined;
    if (!Number.isFinite(nextStart.getTime()) || nextStart <= new Date() ||
      (nextEnd && (!Number.isFinite(nextEnd.getTime()) || nextEnd <= nextStart))) {
      return res.status(400).json({ ok: false, message: 'Provide a future event start and an optional later end time.' });
    }
    event.scheduledStartAt = nextStart;
    event.scheduledEndAt = nextEnd;
    await event.save();
    const io = req.app.get('io');
    if (io) for (const member of space.members) io.to(member.userId).emit('space:event-updated', { spaceId: String(space.id), event });
    return res.json({ ok: true, event });
  } catch (error) {
    console.error('Failed to update Space event', error);
    return res.status(500).json({ ok: false, message: 'Failed to update event' });
  }
});

router.post('/:id/events/:eventId/rsvp', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space || !getSpaceMember(space, req.user.userId)) return res.status(403).json({ ok: false, message: 'Join this Space before responding to an event.' });
    const event = await SpaceEvent.findOne({ _id: req.params.eventId, spaceId: space._id });
    if (!event) return res.status(404).json({ ok: false, message: 'Event not found' });
    const interested = req.body?.interested;
    if (typeof interested !== 'boolean') return res.status(400).json({ ok: false, message: 'Choose whether you are interested in this event.' });
    if (interested && !event.interestedUserIds.includes(req.user.userId)) event.interestedUserIds.push(req.user.userId);
    if (!interested) event.interestedUserIds = event.interestedUserIds.filter(userId => userId !== req.user.userId);
    await event.save();
    const io = req.app.get('io');
    if (io) for (const member of space.members) io.to(member.userId).emit('space:event-updated', { spaceId: String(space.id), event });
    return res.json({ ok: true, interestedUserIds: event.interestedUserIds });
  } catch (error) {
    console.error('Failed to update event RSVP', error);
    return res.status(500).json({ ok: false, message: 'Failed to update RSVP' });
  }
});

router.delete('/:id/events/:eventId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    const event = space && await SpaceEvent.findOne({ _id: req.params.eventId, spaceId: space._id });
    if (!space || !event) return res.status(404).json({ ok: false, message: 'Event not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_EVENTS') && event.createdBy !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the event creator or an event moderator can cancel it.' });
    await event.deleteOne();
    const io = req.app.get('io');
    if (io) for (const member of space.members) io.to(member.userId).emit('space:event-deleted', { spaceId: String(space.id), eventId: String(event.id) });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to cancel Space event', error);
    return res.status(500).json({ ok: false, message: 'Failed to cancel event' });
  }
});

router.patch('/:id/invites', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission to revoke invites.' });
    space.inviteCode = makeInviteCode();
    await space.save();
    return res.json({ ok: true, code: space.inviteCode });
  } catch (error) {
    console.error('Failed to rotate Space invite', error);
    return res.status(500).json({ ok: false, message: 'Failed to revoke and replace the invite' });
  }
});

router.post('/join/:code', requireAuth, async (req: any, res: any) => {
  try {
    let space = await Space.findOne({ $or: [{ inviteCode: req.params.code }, { 'invites.code': req.params.code }] });
    if (!space) return res.status(404).json({ ok: false, message: 'Invite not found or expired.' });
    if (space.bannedUserIds.includes(req.user.userId)) return res.status(403).json({ ok: false, message: 'You are banned from this Space.' });
    let joined = false;
    if (!getSpaceMember(space, req.user.userId)) {
      if (space.invitesPaused) return res.status(403).json({ ok: false, message: 'Invites are currently paused for this Space.' });
      const user = await User.findOne({ userId: req.user.userId }).select('publicKey createdAt');
      if (space.verificationLevel !== 'none' && !user?.publicKey) return res.status(403).json({ ok: false, message: 'Set up an encryption key before joining this Space.' });
      if (!meetsVerificationLevel(user, space.verificationLevel)) {
        return res.status(403).json({ ok: false, message: `This Space requires an account at least ${verificationAgeLabel(space.verificationLevel)} old.` });
      }
      const joinAutoRoles = (space?.autoRoleId && space?.roles?.some((r: any) => r.id === space?.autoRoleId)) ? [space.autoRoleId] : [];
      const invite = space.invites.find(item => item.code === req.params.code);
      if (invite) {
        if (invite.expiresAt && invite.expiresAt <= new Date()) return res.status(410).json({ ok: false, message: 'This invite has expired.' });
        if (invite.maxUses && invite.uses >= invite.maxUses) return res.status(410).json({ ok: false, message: 'This invite has reached its use limit.' });
        const conditions: Record<string, unknown> = {
          _id: space._id,
          members: { $not: { $elemMatch: { userId: req.user.userId } } },
          invites: { $elemMatch: { code: req.params.code } }
        };
        const inviteConditions: Record<string, unknown> = { code: req.params.code };
        if (invite.expiresAt) inviteConditions.expiresAt = { $gt: new Date() };
        if (invite.maxUses) inviteConditions.uses = { $lt: invite.maxUses };
        conditions.invites = { $elemMatch: inviteConditions };
        const result = await Space.updateOne(conditions, {
          $push: { members: { userId: req.user.userId, roleIds: joinAutoRoles, nickname: '', joinedAt: new Date() } },
          $inc: { 'invites.$.uses': 1 }
        });
        if (!result.modifiedCount) return res.status(410).json({ ok: false, message: 'This invite has expired or reached its use limit.' });
      } else {
        const result = await Space.updateOne(
          { _id: space._id, inviteCode: req.params.code, members: { $not: { $elemMatch: { userId: req.user.userId } } } },
          { $push: { members: { userId: req.user.userId, roleIds: joinAutoRoles, nickname: '', joinedAt: new Date() } } }
        );
        if (!result.modifiedCount) return res.status(410).json({ ok: false, message: 'This invite is no longer available.' });
      }
      space = await Space.findById(space._id);
      if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
      joined = true;
    }
    if (joined) {
      const io = req.app.get('io');
      if (io) await syncSpaceChannelRooms(io, space);
      void handleNikoMemberJoin(req, space, req.user.userId);
    }
    return res.json({ ok: true, space: serializeSpace(space) });
  } catch (error) {
    console.error('Failed to join Space', error);
    return res.status(500).json({ ok: false, message: 'Failed to join Space' });
  }
});

router.post('/:id/members/:userId/kick', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'KICK_MEMBERS')) return res.status(403).json({ ok: false, message: 'You need Kick Members permission.' });
    if (req.params.userId === space.ownerId) return res.status(400).json({ ok: false, message: 'The Space owner cannot be removed.' });
    const target = getSpaceMember(space, req.params.userId);
    if (!target) return res.status(404).json({ ok: false, message: 'Space member not found' });
    const actor = getSpaceMember(space, req.user.userId);
    const actorTop = Math.max(0, ...space.roles.filter(role => actor?.roleIds.includes(role.id)).map(role => role.position));
    const targetTop = Math.max(0, ...space.roles.filter(role => target.roleIds.includes(role.id)).map(role => role.position));
    if (space.ownerId !== req.user.userId && actorTop <= targetTop) return res.status(403).json({ ok: false, message: 'Your role is not high enough to remove this member.' });
    space.members.splice(space.members.indexOf(target), 1);
    removePermissionOverwrites(space, target.userId);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.kicked', target.userId);
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      for (const client of await io.in(req.params.userId).fetchSockets()) {
        client.leave(`space:${space.id}`);
        for (const channel of space.channels) client.leave(`space:${space.id}:${channel.id}`);
      }
      io.to(req.params.userId).emit('space:member-removed', { spaceId: String(space.id) });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to remove Space member', error);
    return res.status(500).json({ ok: false, message: 'Failed to remove member' });
  }
});

router.post('/:id/members/:userId/ban', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'BAN_MEMBERS')) return res.status(403).json({ ok: false, message: 'You need Ban Members permission.' });
    if (req.params.userId === space.ownerId) return res.status(400).json({ ok: false, message: 'The Space owner cannot be banned.' });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length > 500) return res.status(400).json({ ok: false, message: 'Ban reason cannot exceed 500 characters.' });
    const target = getSpaceMember(space, req.params.userId);
    if (target) {
      const actor = getSpaceMember(space, req.user.userId);
      const actorTop = Math.max(0, ...space.roles.filter(role => actor?.roleIds.includes(role.id)).map(role => role.position));
      const targetTop = Math.max(0, ...space.roles.filter(role => target.roleIds.includes(role.id)).map(role => role.position));
      if (space.ownerId !== req.user.userId && actorTop <= targetTop) return res.status(403).json({ ok: false, message: 'Your role is not high enough to ban this member.' });
      space.members.splice(space.members.indexOf(target), 1);
    }
    removePermissionOverwrites(space, req.params.userId);
    if (!space.bannedUserIds.includes(req.params.userId)) space.bannedUserIds.push(req.params.userId);
    space.bans = space.bans.filter(ban => ban.userId !== req.params.userId);
    space.bans.push({ userId: req.params.userId, moderatorId: req.user.userId, reason, bannedAt: new Date() });
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.banned', req.params.userId, { reason });
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      for (const client of await io.in(req.params.userId).fetchSockets()) {
        client.leave(`space:${space.id}`);
        for (const channel of space.channels) client.leave(`space:${space.id}:${channel.id}`);
      }
      io.to(req.params.userId).emit('space:member-removed', { spaceId: String(space.id) });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to ban Space member', error);
    return res.status(500).json({ ok: false, message: 'Failed to ban member' });
  }
});

router.delete('/:id/bans/:userId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'BAN_MEMBERS')) return res.status(403).json({ ok: false, message: 'You need Ban Members permission.' });
    space.bannedUserIds = space.bannedUserIds.filter(userId => userId !== req.params.userId);
    space.bans = space.bans.filter(ban => ban.userId !== req.params.userId);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.unbanned', req.params.userId);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to unban Space member', error);
    return res.status(500).json({ ok: false, message: 'Failed to unban member' });
  }
});

router.post('/:id/leave', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (space.ownerId === req.user.userId) return res.status(400).json({ ok: false, message: 'Transfer ownership before leaving this Space.' });
    const member = getSpaceMember(space, req.user.userId);
    if (!member) return res.status(404).json({ ok: false, message: 'You are not a member of this Space.' });
    space.members.splice(space.members.indexOf(member), 1);
    removePermissionOverwrites(space, member.userId);
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'member.left', member.userId);
    const io = req.app.get('io');
    if (io) {
      await syncSpaceChannelRooms(io, space);
      io.to(req.user.userId).emit('space:member-removed', { spaceId: String(space.id) });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to leave Space', error);
    return res.status(500).json({ ok: false, message: 'Failed to leave Space' });
  }
});

router.post('/:id/transfer-ownership', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (space.ownerId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the current owner can transfer ownership.' });
    const nextOwnerId = req.body?.userId;
    if (typeof nextOwnerId !== 'string' || nextOwnerId === req.user.userId || !getSpaceMember(space, nextOwnerId)) return res.status(400).json({ ok: false, message: 'Choose another current Space member.' });
    space.ownerId = nextOwnerId;
    await space.save();
    await writeSpaceAudit(space.id, req.user.userId, 'space.ownership.transferred', nextOwnerId);
    const io = req.app.get('io');
    if (io) await syncSpaceChannelRooms(io, space);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to transfer Space ownership', error);
    return res.status(500).json({ ok: false, message: 'Failed to transfer ownership' });
  }
});

router.delete('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (space.ownerId !== req.user.userId) return res.status(403).json({ ok: false, message: 'Only the Space owner can delete it.' });
    const threads = await SpaceThread.find({ spaceId: space._id }).select('_id channelId');
    const roomIds = [
      ...space.channels.map(channel => `space:${space.id}:${channel.id}`),
      ...threads.map(thread => `space:${space.id}:${thread.channelId}:${thread.id}`)
    ];
    const io = req.app.get('io');
    if (io) {
      for (const socket of await io.fetchSockets()) {
        for (const roomId of roomIds) socket.leave(roomId);
      }
      for (const member of space.members) io.to(member.userId).emit('space:deleted', { spaceId: String(space.id) });
    }
    await fs.rm(path.join(__dirname, '../../uploads/spaces', String(space.id)), { recursive: true, force: true });
    await Promise.all([
      Message.deleteMany({ roomId: { $in: roomIds } }),
      Notification.deleteMany({ roomId: { $in: roomIds } }),
      SpaceThread.deleteMany({ spaceId: space._id }),
      SpaceEvent.deleteMany({ spaceId: space._id }),
      space.deleteOne()
    ]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete Space', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete Space' });
  }
});

const addAsset = (kind: 'emojis' | 'stickers') => async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_EMOJIS_AND_STICKERS')) return res.status(403).json({ ok: false, message: 'You need Manage Emojis and Stickers permission.' });
    const { name, url, associatedEmoji } = req.body || {};
    if (!validName(name, 32) || typeof url !== 'string' || url.length > 2048 || !/^https?:\/\/\S+$/i.test(url)) return res.status(400).json({ ok: false, message: 'Provide an asset name and an http(s) URL.' });
    if (kind === 'emojis' && countSpaceEmojis(space, false) >= MAX_SPACE_EMOJIS_PER_ANIMATION) return res.status(400).json({ ok: false, message: `This Space has reached its static emoji limit of ${MAX_SPACE_EMOJIS_PER_ANIMATION}.` });
    if (kind === 'stickers' && space.stickers.length >= MAX_SPACE_STICKERS) return res.status(400).json({ ok: false, message: `This Space has reached its ${MAX_SPACE_STICKERS} sticker limit.` });
    if (kind === 'stickers' && (typeof associatedEmoji !== 'string' || !associatedEmoji.trim() || Array.from(associatedEmoji).length > 16)) return res.status(400).json({ ok: false, message: 'Choose a related emoji for this sticker.' });
    const asset = { id: randomUUID(), name: name.trim().replace(/\s+/g, '_'), url, animated: false, associatedEmoji: kind === 'stickers' ? associatedEmoji.trim() : '', creatorId: req.user.userId, createdAt: new Date() };
    space[kind].push(asset);
    await space.save();
    return res.status(201).json({ ok: true, asset });
  } catch (error) {
    console.error(`Failed to add Space ${kind}`, error);
    return res.status(500).json({ ok: false, message: `Failed to add ${kind === 'emojis' ? 'emoji' : 'sticker'}` });
  }
};

router.post('/:id/assets/upload', requireAuth, assetUpload, async (req: any, res: any) => {
    const kind: unknown = req.body?.kind;
    try {
      const space = await findSpace(req.params.id);
      if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
      if (kind === 'icon' || kind === 'banner') {
        if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE')) return res.status(403).json({ ok: false, message: 'You need Manage Space permission.' });
      } else {
        if (kind !== 'emojis' && kind !== 'stickers') return res.status(400).json({ ok: false, message: 'Choose an emoji, sticker, icon, or banner.' });
        if (!hasSpacePermission(space, req.user.userId, 'MANAGE_EMOJIS_AND_STICKERS')) return res.status(403).json({ ok: false, message: 'You need Manage Emojis and Stickers permission.' });
        if (!validName(req.body?.name, 32)) return res.status(400).json({ ok: false, message: 'Asset name must be between 1 and 32 characters.' });
      }
      if (!req.file || !Buffer.isBuffer(req.file.buffer)) return res.status(400).json({ ok: false, message: 'Choose an image to upload.' });
      if (kind === 'stickers' && space.stickers.length >= MAX_SPACE_STICKERS) return res.status(400).json({ ok: false, message: `This Space has reached its ${MAX_SPACE_STICKERS} sticker limit.` });
      const extension = allowedUploadedImage(req.file.buffer);
      if (!extension) return res.status(415).json({ ok: false, message: 'Upload a valid PNG, JPEG, GIF, or WebP image.' });
      const animated = isAnimatedImage(req.file.buffer, extension);
      if (kind === 'emojis') {
        if (extension === 'jpg') return res.status(415).json({ ok: false, message: 'Emoji files must be PNG, WebP, GIF, or animated PNG.' });
        if (req.file.size > EMOJI_FILE_LIMIT) return res.status(413).json({ ok: false, message: 'Emoji files must be 256 KB or smaller.' });
        if (countSpaceEmojis(space, animated) >= MAX_SPACE_EMOJIS_PER_ANIMATION) return res.status(400).json({ ok: false, message: `This Space has reached its ${animated ? 'animated' : 'static'} emoji limit of ${MAX_SPACE_EMOJIS_PER_ANIMATION}.` });
      }
      if (kind === 'stickers' && req.file.size > STICKER_FILE_LIMIT) return res.status(413).json({ ok: false, message: 'Sticker files must be 512 KB or smaller.' });
      if (kind === 'stickers' && (typeof req.body?.associatedEmoji !== 'string' || !req.body.associatedEmoji.trim() || Array.from(req.body.associatedEmoji).length > 16)) return res.status(400).json({ ok: false, message: 'Choose a related emoji for this sticker.' });
      if (kind === 'stickers') {
        const dimensions = imageDimensions(req.file.buffer, extension);
        if (!dimensions || dimensions.width !== 320 || dimensions.height !== 320) return res.status(400).json({ ok: false, message: 'Stickers must be exactly 320 x 320 pixels.' });
      }
      if (kind === 'emojis') {
        const dimensions = imageDimensions(req.file.buffer, extension);
        if (!dimensions || dimensions.width !== dimensions.height) return res.status(400).json({ ok: false, message: 'Emoji images must be square. 128 × 128 pixels is recommended.' });
      }
      const fileName = `${randomUUID()}.${extension}`;
      const directory = path.join(__dirname, '../../uploads/spaces', String(space.id));
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, fileName), req.file.buffer, { flag: 'wx' });
      const url = `/uploads/spaces/${space.id}/${fileName}`;
      if (kind === 'icon' || kind === 'banner') {
        const previousUrl = space[kind];
        space[kind] = url;
        try {
          await space.save();
        } catch (error) {
          await removeUploadedAssetFile(String(space.id), url);
          throw error;
        }
        await removeUploadedAssetFile(String(space.id), previousUrl);
        return res.status(201).json({ ok: true, [kind]: url });
      }
      const asset = {
        id: randomUUID(),
        name: req.body.name.trim().replace(/\s+/g, '_'),
        url,
        animated,
        associatedEmoji: kind === 'stickers' ? String(req.body?.associatedEmoji || '').trim() : '',
        creatorId: req.user.userId,
        createdAt: new Date()
      };
      space[kind].push(asset);
      try {
        await space.save();
      } catch (error) {
        await removeUploadedAssetFile(String(space.id), url);
        throw error;
      }
      return res.status(201).json({ ok: true, asset });
    } catch (error) {
      console.error('Failed to upload Space asset', error);
      return res.status(500).json({ ok: false, message: 'Failed to upload asset' });
    }
});

router.post('/:id/emojis', requireAuth, addAsset('emojis'));
router.post('/:id/stickers', requireAuth, addAsset('stickers'));

router.delete('/:id/assets/:kind/:assetId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await findSpace(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!['emojis', 'stickers'].includes(req.params.kind)) return res.status(400).json({ ok: false, message: 'Invalid asset type.' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_EMOJIS_AND_STICKERS')) return res.status(403).json({ ok: false, message: 'You need Manage Emojis and Stickers permission.' });
    const assets = req.params.kind === 'emojis' ? space.emojis : space.stickers;
    const asset = assets.find(item => item.id === req.params.assetId);
    if (!asset) return res.status(404).json({ ok: false, message: 'Asset not found' });
    assets.splice(assets.indexOf(asset), 1);
    await space.save();
    await removeUploadedAssetFile(String(space.id), asset.url);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to remove Space asset', error);
    return res.status(500).json({ ok: false, message: 'Failed to remove asset' });
  }
});

router.use((error: any, _req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ ok: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Asset images must be 10 MB or smaller.' : 'Upload one image at a time.' });
  }
  return next(error);
});

export default router;

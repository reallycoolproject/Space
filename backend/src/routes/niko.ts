import express from 'express';
import { randomUUID } from 'crypto';
import requireAuth from '../middleware/auth';
import { Space, SPACE_PERMISSIONS, SpaceChannelType } from '../models/Space';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { NikoConfig, INikoConfig, INikoEmbed, INikoActionRow } from '../models/NikoBot';
import { NikoMemberXP } from '../models/NikoMemberXP';
import { hasSpacePermission, getSpaceMember, getSpaceChannel } from '../utils/spacePermissions';

export const router = express.Router();

// In-memory cache for /snipe (last deleted message per channel)
export const lastDeletedMessages = new Map<
  string,
  {
    senderName: string;
    senderAvatar?: string;
    senderId: string;
    text: string;
    timestamp: Date;
    deletedAt: Date;
  }
>();

// In-memory tracker for anti-spam (userId_spaceId -> array of timestamp ms)
const messageFrequencyTracker = new Map<string, number[]>();

// Variable substitution helper
function replaceTemplateVariables(
  str: string,
  vars: {
    user?: { username: string; displayName?: string; userId: string };
    space?: { name: string; memberCount: number };
  }
): string {
  if (!str) return '';
  let res = str;
  if (vars.user) {
    res = res.replace(/\{user\}/gi, vars.user.displayName || vars.user.username);
    res = res.replace(/\{user\.mention\}/gi, `@${vars.user.username}`);
    res = res.replace(/\{user\.tag\}/gi, `@${vars.user.username}`);
  }
  if (vars.space) {
    res = res.replace(/\{space\.name\}/gi, vars.space.name);
    res = res.replace(/\{member_count\}/gi, String(vars.space.memberCount));
  }
  res = res.replace(/\{date\}/gi, new Date().toLocaleDateString());
  return res;
}

// XP Calculation Formula: XP needed for next level
export function getRequiredXpForLevel(level: number): number {
  return 5 * (level * level) + 50 * level + 100;
}

// Helper to get or create Niko configuration
export async function getOrCreateNikoConfig(spaceId: string): Promise<INikoConfig> {
  let config = await NikoConfig.findOne({ spaceId });
  if (!config) {
    config = await NikoConfig.create({
      spaceId,
      enabled: true,
      botName: 'Niko',
      botAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NikoSpace&backgroundColor=5865f2',
      bio: 'Niko — The all-in-one automation, moderation & embed studio assistant.',
      accentColor: '#5865F2',
      prefix: '/',
      ticketConfig: {
        enabled: true,
        supportRoleIds: [],
        ticketCounter: 0,
        categories: [
          { id: 'general', name: 'General Support', description: 'Ask questions or get help with this Space', emoji: '❓' },
          { id: 'billing', name: 'Billing & Perks', description: 'Inquire about purchases, perks, or VIP subscriptions', emoji: '💳' },
          { id: 'reports', name: 'Report Member', description: 'Privately report user misconduct or rule violation', emoji: '🛡️' }
        ]
      },
      levelingConfig: {
        enabled: true,
        minXp: 15,
        maxXp: 25,
        cooldownSeconds: 60,
        voiceXpPerMin: 10,
        alertType: 'channel',
        stackRoles: true,
        roleRewards: []
      },
      automodConfig: {
        enabled: true,
        antiSpam: { enabled: true, maxMessagesPer5s: 5, action: 'delete' },
        antiMassMention: { enabled: true, maxMentions: 5, action: 'warn' },
        antiInvite: { enabled: true, whitelistRoles: [], whitelistChannels: [], action: 'delete' },
        badWords: { enabled: false, words: [], regexPatterns: [], action: 'delete' },
        antiRaid: { enabled: true, lockedDown: false, joinThreshold: 10 }
      }
    });
  }
  return config;
}

// Helper to post a Niko Bot Message into a Space text channel
export async function sendNikoBotMessage(
  req: any,
  space: any,
  channelId: string,
  payload: {
    text?: string;
    embeds?: INikoEmbed[];
    components?: INikoActionRow[];
    botMeta?: {
      botName?: string;
      botAvatar?: string;
    };
  }
) {
  const niko = await getOrCreateNikoConfig(space.id);
  const roomId = `space:${space.id}:${channelId}`;

  const botName = payload.botMeta?.botName || niko.botName || 'Niko';
  const botAvatar = payload.botMeta?.botAvatar || niko.botAvatar;

  const contentPayload = {
    isBot: true,
    text: payload.text || '',
    embeds: payload.embeds || [],
    components: payload.components || [],
    botMeta: {
      isBot: true,
      botName,
      botAvatar,
      badge: 'BOT'
    }
  };

  const message = await Message.create({
    roomId,
    senderId: `bot_niko_${space.id}`,
    senderName: botName,
    content: JSON.stringify(contentPayload),
    isSystemMessage: false,
    deliveredTo: []
  });

  const io = req.app?.get('io');
  if (io) {
    io.to(roomId).emit('message:receive', {
      id: message._id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      timestamp: message.createdAt,
      reactions: [],
      edited: false
    });
  }

  return message;
}

// Helper to handle new member joins (Auto-Roles & Welcome Messages)
export async function handleNikoMemberJoin(req: any, space: any, userId: string) {
  try {
    const config = await NikoConfig.findOne({ spaceId: space.id || space._id });
    if (!config || !config.enabled) return;

    const user = await User.findOne({ userId }).select('username displayName avatar');
    if (!user) return;

    // 1. Assign autoRoleIds if configured
    if (config.welcomeConfig?.autoRoleIds?.length) {
      const validRoles = config.welcomeConfig.autoRoleIds.filter((rId: string) => space.roles.some((r: any) => r.id === rId));
      if (validRoles.length) {
        const mem = space.members.find((m: any) => m.userId === userId);
        if (mem) {
          for (const rId of validRoles) {
            if (!mem.roleIds.includes(rId)) mem.roleIds.push(rId);
          }
          await space.save();
        }
      }
    }

    // 2. Post welcome message/embed if enabled
    if (config.welcomeConfig?.enabled && config.welcomeConfig.channelId) {
      const channel = getSpaceChannel(space, config.welcomeConfig.channelId);
      if (channel) {
        const welcomeText = (config.welcomeConfig.message || 'Welcome to **{space.name}**, {user.mention}! 🎉')
          .replace(/\{user\}/gi, user.displayName || user.username)
          .replace(/\{user\.mention\}/gi, `<@${user.userId}>`)
          .replace(/\{user\.tag\}/gi, `@${user.username}`)
          .replace(/\{space\.name\}/gi, space.name)
          .replace(/\{member_count\}/gi, String(space.members.length));

        const welcomeEmbed: INikoEmbed = {
          id: randomUUID(),
          color: config.accentColor || '#5865F2',
          title: `👋 Welcome to ${space.name}!`,
          description: welcomeText,
          thumbnailUrl: user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Niko',
          footer: { text: `Member #${space.members.length} · Niko Welcome Suite`, timestamp: true }
        };

        await sendNikoBotMessage(req, space, config.welcomeConfig.channelId, {
          text: welcomeText,
          embeds: [welcomeEmbed]
        });
      }
    }
  } catch (err) {
    console.warn('handleNikoMemberJoin error:', err);
  }
}

// --------------------------------------------------------------------------
// 1. GET /api/spaces/:id/niko - Full Niko Configuration & Statistics
// --------------------------------------------------------------------------
router.get('/:id/niko', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const member = getSpaceMember(space, req.user.userId);
    if (!member) return res.status(403).json({ ok: false, message: 'You are not a member of this Space' });

    const config = await getOrCreateNikoConfig(space.id);

    // Calculate quick stats
    const totalLeveledMembers = await NikoMemberXP.countDocuments({ spaceId: space.id });
    const topXpMember = await NikoMemberXP.findOne({ spaceId: space.id }).sort({ xp: -1 }).select('username xp level');

    const stats = {
      totalTickets: config.ticketConfig.ticketCounter || 0,
      openTickets: (config.tickets || []).filter(t => t.status === 'open' || t.status === 'claimed').length,
      totalGiveaways: (config.giveaways || []).length,
      activeGiveaways: (config.giveaways || []).filter(g => !g.ended && new Date(g.endsAt) > new Date()).length,
      totalWarnings: (config.warnings || []).length,
      totalLeveledMembers,
      topMember: topXpMember ? { username: topXpMember.username, level: topXpMember.level, xp: topXpMember.xp } : null,
      isLockedDown: config.automodConfig.antiRaid.lockedDown
    };

    return res.json({ ok: true, config, stats });
  } catch (error) {
    console.error('Failed to get Niko config:', error);
    return res.status(500).json({ ok: false, message: 'Failed to retrieve Niko configuration' });
  }
});

// --------------------------------------------------------------------------
// 2. PATCH /api/spaces/:id/niko - Update Niko Configuration
// --------------------------------------------------------------------------
router.patch('/:id/niko', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const canManage = hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE') || space.ownerId === req.user.userId;
    if (!canManage) return res.status(403).json({ ok: false, message: 'Permission denied: Requires MANAGE_SPACE' });

    const config = await getOrCreateNikoConfig(space.id);
    const updates = req.body;

    if (updates.botName !== undefined) config.botName = String(updates.botName).trim().slice(0, 32);
    if (updates.botAvatar !== undefined) config.botAvatar = String(updates.botAvatar).trim();
    if (updates.bio !== undefined) config.bio = String(updates.bio).trim().slice(0, 256);
    if (updates.accentColor !== undefined) config.accentColor = String(updates.accentColor).trim();
    if (updates.prefix !== undefined) config.prefix = String(updates.prefix).trim().slice(0, 5);
    if (updates.enabled !== undefined) config.enabled = Boolean(updates.enabled);

    if (updates.embedTemplates !== undefined && Array.isArray(updates.embedTemplates)) {
      config.embedTemplates = updates.embedTemplates;
    }
    if (updates.rolePanels !== undefined && Array.isArray(updates.rolePanels)) {
      config.rolePanels = updates.rolePanels;
    }
    if (updates.ticketConfig !== undefined) {
      config.ticketConfig = { ...config.ticketConfig, ...updates.ticketConfig };
    }
    if (updates.welcomeConfig !== undefined) {
      config.welcomeConfig = { ...config.welcomeConfig, ...updates.welcomeConfig };
    }
    if (updates.levelingConfig !== undefined) {
      config.levelingConfig = { ...config.levelingConfig, ...updates.levelingConfig };
    }
    if (updates.automodConfig !== undefined) {
      config.automodConfig = { ...config.automodConfig, ...updates.automodConfig };
    }
    if (updates.customCommands !== undefined && Array.isArray(updates.customCommands)) {
      config.customCommands = updates.customCommands;
    }

    await config.save();
    return res.json({ ok: true, config });
  } catch (error) {
    console.error('Failed to update Niko config:', error);
    return res.status(500).json({ ok: false, message: 'Failed to update Niko configuration' });
  }
});

// --------------------------------------------------------------------------
// 3. POST /api/spaces/:id/niko/embeds/send - Visual Embed Studio Delivery
// --------------------------------------------------------------------------
router.post('/:id/niko/embeds/send', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const canManage = hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE') || space.ownerId === req.user.userId;
    if (!canManage) return res.status(403).json({ ok: false, message: 'Permission denied: Requires MANAGE_SPACE' });

    const { channelId, channelIds: inputChannelIds, embed, components, content, webhookOverride } = req.body;
    const targetChannelIds: string[] = Array.isArray(inputChannelIds) && inputChannelIds.length > 0
      ? inputChannelIds
      : (channelId ? [channelId] : []);

    if (targetChannelIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one target channel is required' });
    }

    // Process variable injection
    const user = await User.findOne({ userId: req.user.userId }).select('username displayName');
    const templateVars = {
      user: {
        username: user?.username || req.user.username,
        displayName: user?.displayName,
        userId: req.user.userId
      },
      space: {
        name: space.name,
        memberCount: space.members.length
      }
    };

    let processedEmbed: INikoEmbed | null = null;
    if (embed) {
      processedEmbed = {
        ...embed,
        title: replaceTemplateVariables(embed.title || '', templateVars),
        description: replaceTemplateVariables(embed.description || '', templateVars),
        fields: (embed.fields || []).map((f: any) => ({
          ...f,
          name: replaceTemplateVariables(f.name || '', templateVars),
          value: replaceTemplateVariables(f.value || '', templateVars)
        }))
      };
    }

    const processedText = content ? replaceTemplateVariables(content, templateVars) : '';

    const sentMessageIds: string[] = [];
    for (const targetId of targetChannelIds) {
      const channel = getSpaceChannel(space, targetId);
      if (!channel) continue;

      const message = await sendNikoBotMessage(req, space, targetId, {
        text: processedText,
        embeds: processedEmbed ? [processedEmbed] : [],
        components: Array.isArray(components) ? components : [],
        botMeta: webhookOverride?.username ? {
          botName: webhookOverride.username,
          botAvatar: webhookOverride.avatarUrl
        } : undefined
      });
      sentMessageIds.push(String(message._id));
    }

    return res.status(201).json({ ok: true, messageId: sentMessageIds[0], messageIds: sentMessageIds });
  } catch (error) {
    console.error('Failed to send embed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to dispatch embed message' });
  }
});

// POST /api/spaces/:id/niko/embed-templates - Save or update an embed template
router.post('/:id/niko/embed-templates', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE') && space.ownerId !== req.user.userId) {
      return res.status(403).json({ ok: false, message: 'Permission denied' });
    }

    const template = req.body.template || req.body;
    if (!template || !template.name) return res.status(400).json({ ok: false, message: 'Template name is required' });

    const config = await getOrCreateNikoConfig(space.id);
    const existingIndex = config.embedTemplates.findIndex((t: any) => t.id === template.id);
    const savedTemplate = {
      ...template,
      id: template.id || randomUUID()
    };

    if (existingIndex >= 0) {
      config.embedTemplates[existingIndex] = savedTemplate;
    } else {
      config.embedTemplates.push(savedTemplate);
    }
    await config.save();

    return res.json({ ok: true, template: savedTemplate, templates: config.embedTemplates });
  } catch (error) {
    console.error('Failed to save embed template:', error);
    return res.status(500).json({ ok: false, message: 'Failed to save template' });
  }
});

// DELETE /api/spaces/:id/niko/embed-templates/:templateId
router.delete('/:id/niko/embed-templates/:templateId', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });
    if (!hasSpacePermission(space, req.user.userId, 'MANAGE_SPACE') && space.ownerId !== req.user.userId) {
      return res.status(403).json({ ok: false, message: 'Permission denied' });
    }

    const config = await getOrCreateNikoConfig(space.id);
    config.embedTemplates = config.embedTemplates.filter((t: any) => t.id !== req.params.templateId);
    await config.save();

    return res.json({ ok: true, templates: config.embedTemplates });
  } catch (error) {
    console.error('Failed to delete embed template:', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete template' });
  }
});

// --------------------------------------------------------------------------
// 4. POST /api/spaces/:id/niko/interaction - Interactive Component Dispatcher
// --------------------------------------------------------------------------
router.post('/:id/niko/interaction', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const member = getSpaceMember(space, req.user.userId);
    if (!member) return res.status(403).json({ ok: false, message: 'You are not a member of this Space' });

    const config = await getOrCreateNikoConfig(space.id);
    const { actionType, targetId, customId, selectedValues, channelId } = req.body;

    // A. BUTTON ROLE TOGGLE
    if (actionType === 'role') {
      const roleId = targetId || customId;
      const role = space.roles.find(r => r.id === roleId);
      if (!role) return res.status(404).json({ ok: false, message: 'Role not found' });

      const hasRole = member.roleIds.includes(roleId);
      if (hasRole) {
        member.roleIds = member.roleIds.filter(id => id !== roleId);
      } else {
        member.roleIds.push(roleId);
      }
      await space.save();

      return res.json({
        ok: true,
        action: hasRole ? 'removed' : 'added',
        roleName: role.name,
        color: role.color,
        message: hasRole ? `Removed role @${role.name}` : `Granted role @${role.name}`
      });
    }

    // B. UNIQUE / RADIO GROUP ROLE ASSIGNMENT
    if (actionType === 'role_radio') {
      const { roleId, groupRoleIds } = req.body;
      const role = space.roles.find(r => r.id === roleId);
      if (!role) return res.status(404).json({ ok: false, message: 'Role not found' });

      // Strip previous roles in this radio group
      if (Array.isArray(groupRoleIds)) {
        member.roleIds = member.roleIds.filter(id => !groupRoleIds.includes(id));
      }
      member.roleIds.push(roleId);
      await space.save();

      return res.json({
        ok: true,
        action: 'added',
        roleName: role.name,
        message: `Updated to role @${role.name}`
      });
    }

    // C. DROPDOWN ROLE SELECT
    if (actionType === 'role_select') {
      const values: string[] = Array.isArray(selectedValues) ? selectedValues : [];
      // Keep other roles, add/toggle selected
      values.forEach(roleId => {
        if (!member.roleIds.includes(roleId)) {
          member.roleIds.push(roleId);
        }
      });
      await space.save();

      return res.json({
        ok: true,
        message: `Updated roles: ${values.length} roles saved.`
      });
    }

    // D. VERIFY ROLE (ONE-TIME PERMANENT)
    if (actionType === 'verify') {
      const roleId = targetId || config.ticketConfig.supportRoleIds[0];
      const role = space.roles.find(r => r.id === roleId);
      if (!role) return res.status(404).json({ ok: false, message: 'Verification role not configured' });

      if (!member.roleIds.includes(role.id)) {
        member.roleIds.push(role.id);
        await space.save();
      }

      return res.json({
        ok: true,
        action: 'verified',
        roleName: role.name,
        message: `✅ You have been successfully verified and granted @${role.name}!`
      });
    }

    // E. CREATE SUPPORT TICKET (Ticket Tool Grade)
    if (actionType === 'ticket' || actionType === 'ticket_create') {
      if (!config.ticketConfig.enabled) {
        return res.status(400).json({ ok: false, message: 'Tickets are currently disabled in this Space' });
      }

      // Check if user already has an open ticket
      const existing = (config.tickets || []).find(
        t => t.creatorId === req.user.userId && (t.status === 'open' || t.status === 'claimed')
      );
      if (existing) {
        return res.status(400).json({
          ok: false,
          message: `You already have an open ticket in <#${existing.channelId}>!`,
          channelId: existing.channelId
        });
      }

      config.ticketConfig.ticketCounter = (config.ticketConfig.ticketCounter || 0) + 1;
      const ticketNum = String(config.ticketConfig.ticketCounter).padStart(4, '0');
      const categoryId = targetId || 'general';
      const catObj = config.ticketConfig.categories.find(c => c.id === categoryId) || config.ticketConfig.categories[0];
      const categoryName = catObj ? catObj.name : 'General Support';

      // Create new private channel
      const channelIdNew = randomUUID();
      const channelName = `ticket-${req.user.username.toLowerCase().slice(0, 10)}-${ticketNum}`;

      // Overwrites:
      // @everyone -> deny VIEW_CHANNEL
      // Ticket Creator -> allow VIEW_CHANNEL, SEND_MESSAGES, ATTACH_FILES, READ_MESSAGE_HISTORY
      // Staff Roles -> allow VIEW_CHANNEL, SEND_MESSAGES, ATTACH_FILES, MANAGE_MESSAGES
      const overwrites = [
        {
          roleId: 'everyone',
          allow: 0,
          deny: SPACE_PERMISSIONS.VIEW_CHANNEL
        },
        {
          roleId: req.user.userId,
          allow:
            SPACE_PERMISSIONS.VIEW_CHANNEL |
            SPACE_PERMISSIONS.SEND_MESSAGES |
            SPACE_PERMISSIONS.ATTACH_FILES |
            SPACE_PERMISSIONS.READ_MESSAGE_HISTORY,
          deny: 0
        }
      ];

      (config.ticketConfig.supportRoleIds || []).forEach(roleId => {
        overwrites.push({
          roleId,
          allow:
            SPACE_PERMISSIONS.VIEW_CHANNEL |
            SPACE_PERMISSIONS.SEND_MESSAGES |
            SPACE_PERMISSIONS.ATTACH_FILES |
            SPACE_PERMISSIONS.MANAGE_MESSAGES |
            SPACE_PERMISSIONS.READ_MESSAGE_HISTORY,
          deny: 0
        });
      });

      const newChannel = {
        id: channelIdNew,
        name: channelName,
        type: 'text' as SpaceChannelType,
        topic: `Support ticket #${ticketNum} created by @${req.user.username} for ${categoryName}`,
        categoryId: catObj?.targetCategoryId || config.ticketConfig.defaultCategoryId || '',
        position: space.channels.length,
        slowmodeSeconds: 0,
        nsfw: false,
        forumTags: [],
        permissionOverwrites: overwrites
      };

      space.channels.push(newChannel);
      await space.save();

      // Record ticket
      const ticketRecord = {
        id: randomUUID(),
        channelId: channelIdNew,
        creatorId: req.user.userId,
        creatorUsername: req.user.username,
        ticketNumber: config.ticketConfig.ticketCounter,
        categoryId,
        categoryName,
        status: 'open' as const,
        createdAt: new Date()
      };
      config.tickets.push(ticketRecord);
      await config.save();

      // Post in-ticket Control Panel Embed
      await sendNikoBotMessage(req, space, channelIdNew, {
        text: `Welcome <@${req.user.userId}>! Support will be with you shortly.`,
        embeds: [
          {
            id: randomUUID(),
            color: '#5865F2',
            title: `🎫 Ticket #${ticketNum} — ${categoryName}`,
            description: `Hello **${req.user.username}**! Thank you for reaching out to support.\n\nPlease describe your question or issue in detail below. Staff have been alerted and will assist you as soon as possible.`,
            fields: [
              { id: '1', name: 'Ticket Creator', value: `<@${req.user.userId}>`, inline: true },
              { id: '2', name: 'Category', value: categoryName, inline: true },
              { id: '3', name: 'Status', value: '🟢 Open / Unclaimed', inline: true }
            ],
            footer: {
              text: `Niko Ticket System · Ticket ID: ${ticketRecord.id}`,
              timestamp: true
            }
          }
        ],
        components: [
          {
            type: 'action_row',
            components: [
              {
                type: 'button',
                id: `close_${ticketRecord.id}`,
                label: 'Close Ticket',
                emoji: '🔒',
                style: 'danger',
                actionType: 'ticket_close',
                targetId: ticketRecord.id
              },
              {
                type: 'button',
                id: `claim_${ticketRecord.id}`,
                label: 'Claim Ticket',
                emoji: '🙋',
                style: 'primary',
                actionType: 'ticket_claim',
                targetId: ticketRecord.id
              },
              {
                type: 'button',
                id: `add_user_${ticketRecord.id}`,
                label: 'Add / Remove User',
                emoji: '👥',
                style: 'secondary',
                actionType: 'ticket_add_user',
                targetId: ticketRecord.id
              }
            ]
          }
        ]
      });

      return res.status(201).json({
        ok: true,
        channelId: channelIdNew,
        channelName,
        message: `Ticket channel #${channelName} created successfully!`
      });
    }

    // F. IN-TICKET ACTIONS (Close, Claim, Add User)
    if (actionType === 'ticket_close') {
      const ticketId = targetId || customId;
      const ticket = config.tickets.find(t => t.id === ticketId || t.channelId === channelId);
      if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket record not found' });

      ticket.status = 'closed';
      ticket.closedAt = new Date();
      await config.save();

      // Post closing notice
      await sendNikoBotMessage(req, space, ticket.channelId, {
        text: `🔒 Ticket #${ticket.ticketNumber} was closed by **${req.user.username}**. Generating transcript...`
      });

      // Remove channel after delay or immediately
      space.channels = space.channels.filter(c => c.id !== ticket.channelId);
      await space.save();

      return res.json({ ok: true, message: `Ticket #${ticket.ticketNumber} has been closed and removed.` });
    }

    if (actionType === 'ticket_claim') {
      const ticketId = targetId || customId;
      const ticket = config.tickets.find(t => t.id === ticketId || t.channelId === channelId);
      if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket record not found' });

      ticket.status = 'claimed';
      ticket.claimedBy = { userId: req.user.userId, username: req.user.username };
      await config.save();

      await sendNikoBotMessage(req, space, ticket.channelId, {
        text: `🙋 **${req.user.username}** has claimed this ticket and will be assisting you!`
      });

      return res.json({ ok: true, message: `Ticket claimed by @${req.user.username}` });
    }

    // G. GIVEAWAY ENTER
    if (actionType === 'giveaway') {
      const giveawayId = targetId || customId;
      const giveaway = config.giveaways.find(g => g.id === giveawayId);
      if (!giveaway) return res.status(404).json({ ok: false, message: 'Giveaway not found' });

      if (giveaway.ended || new Date(giveaway.endsAt) < new Date()) {
        return res.status(400).json({ ok: false, message: 'This giveaway has ended!' });
      }

      const hasEntered = giveaway.participants.includes(req.user.userId);
      if (hasEntered) {
        giveaway.participants = giveaway.participants.filter(id => id !== req.user.userId);
      } else {
        giveaway.participants.push(req.user.userId);
      }
      await config.save();

      return res.json({
        ok: true,
        action: hasEntered ? 'left' : 'entered',
        participantCount: giveaway.participants.length,
        message: hasEntered ? 'You have left the giveaway.' : '🎉 You have entered the giveaway! Good luck!'
      });
    }

    // H. POLL VOTE
    if (actionType === 'poll_vote') {
      return res.json({ ok: true, message: 'Vote registered!' });
    }

    return res.status(400).json({ ok: false, message: 'Unknown interaction actionType' });
  } catch (error) {
    console.error('Interaction dispatch failed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to process interaction' });
  }
});

// --------------------------------------------------------------------------
// 5. GET /api/spaces/:id/niko/rank/:userId - Dynamic User Rank Card
// --------------------------------------------------------------------------
router.get('/:id/niko/rank/:userId', requireAuth, async (req: any, res: any) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.userId;

    const userXP = await NikoMemberXP.findOne({ spaceId, userId: targetUserId });
    const targetUser = await User.findOne({ userId: targetUserId }).select('username displayName avatar');

    const xp = userXP?.xp || 0;
    const level = userXP?.level || 0;
    const requiredXp = getRequiredXpForLevel(level);

    // Calculate leaderboard position
    const higherCount = await NikoMemberXP.countDocuments({ spaceId, xp: { $gt: xp } });
    const rank = higherCount + 1;

    return res.json({
      ok: true,
      rank,
      level,
      xp,
      requiredXp,
      progressPercentage: Math.min(100, Math.floor((xp / requiredXp) * 100)),
      messagesCount: userXP?.messagesCount || 0,
      voiceMinutes: userXP?.voiceMinutes || 0,
      user: {
        userId: targetUserId,
        username: targetUser?.username || 'User',
        displayName: targetUser?.displayName || targetUser?.username || 'User',
        avatar: targetUser?.avatar || ''
      }
    });
  } catch (error) {
    console.error('Rank card lookup failed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch rank data' });
  }
});

// --------------------------------------------------------------------------
// 6. GET /api/spaces/:id/niko/leaderboard - Paginated XP Leaderboard
// --------------------------------------------------------------------------
router.get('/:id/niko/leaderboard', requireAuth, async (req: any, res: any) => {
  try {
    const spaceId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

    const total = await NikoMemberXP.countDocuments({ spaceId });
    const entries = await NikoMemberXP.find({ spaceId })
      .sort({ xp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formatted = entries.map((entry, index) => ({
      rank: (page - 1) * limit + index + 1,
      userId: entry.userId,
      username: entry.username,
      avatar: entry.avatar,
      xp: entry.xp,
      level: entry.level,
      messagesCount: entry.messagesCount,
      requiredXp: getRequiredXpForLevel(entry.level)
    }));

    return res.json({
      ok: true,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      leaderboard: formatted
    });
  } catch (error) {
    console.error('Leaderboard query failed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch leaderboard' });
  }
});

// --------------------------------------------------------------------------
// 7. POST /api/spaces/:id/niko/automod/lockdown - 1-Click Anti-Raid Mode
// --------------------------------------------------------------------------
router.post('/:id/niko/automod/lockdown', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const canManage = hasSpacePermission(space, req.user.userId, 'ADMINISTRATOR') || space.ownerId === req.user.userId;
    if (!canManage) return res.status(403).json({ ok: false, message: 'Permission denied: Requires ADMINISTRATOR' });

    const config = await getOrCreateNikoConfig(space.id);
    const setLocked = req.body.locked !== undefined ? Boolean(req.body.locked) : !config.automodConfig.antiRaid.lockedDown;

    config.automodConfig.antiRaid.lockedDown = setLocked;
    space.invitesPaused = setLocked;

    // Apply or lift SEND_MESSAGES deny on @everyone across all channels
    space.channels.forEach(channel => {
      const everyoneOverwrite = channel.permissionOverwrites.find(o => o.roleId === 'everyone');
      if (everyoneOverwrite) {
        if (setLocked) {
          everyoneOverwrite.deny |= SPACE_PERMISSIONS.SEND_MESSAGES;
        } else {
          everyoneOverwrite.deny &= ~SPACE_PERMISSIONS.SEND_MESSAGES;
        }
      } else if (setLocked) {
        channel.permissionOverwrites.push({
          roleId: 'everyone',
          allow: 0,
          deny: SPACE_PERMISSIONS.SEND_MESSAGES
        });
      }
    });

    await space.save();
    await config.save();

    return res.json({
      ok: true,
      lockedDown: setLocked,
      message: setLocked
        ? '🚨 Space is now in GLOBAL LOCKDOWN! Invites paused and channels locked.'
        : '🟢 Lockdown lifted! Normal channel permissions restored.'
    });
  } catch (error) {
    console.error('Lockdown toggle failed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to update lockdown state' });
  }
});

// --------------------------------------------------------------------------
// 8. POST /api/spaces/:id/niko/slash-command - Slash Commands Engine
// --------------------------------------------------------------------------
router.post('/:id/niko/slash-command', requireAuth, async (req: any, res: any) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) return res.status(404).json({ ok: false, message: 'Space not found' });

    const { command, args: inputArgs = {}, rawArgs = '', channelId } = req.body;
    if (!command) return res.status(400).json({ ok: false, message: 'Command is required' });

    const config = await getOrCreateNikoConfig(space.id);
    const cmd = command.toLowerCase().replace(/^\//, '');

    // Normalize args from either structured args or rawArgs string
    let args: Record<string, any> = { ...inputArgs };
    if (typeof rawArgs === 'string' && rawArgs.trim() && Object.keys(inputArgs).length === 0) {
      const parts = rawArgs.trim().split(/\s+/);
      if (cmd === 'rank' || cmd === 'userinfo' || cmd === 'av' || cmd === 'avatar' || cmd === 'banner') {
        args.userId = parts[0];
      } else if (cmd === 'warn' || cmd === 'ban' || cmd === 'kick') {
        args.userId = parts[0];
        args.reason = parts.slice(1).join(' ');
      } else if (cmd === 'timeout') {
        args.userId = parts[0];
        args.duration = parts[1];
        args.reason = parts.slice(2).join(' ');
      } else if (cmd === 'purge') {
        args.amount = parts[0];
      } else if (cmd === 'slowmode') {
        args.seconds = parts[0];
      } else if (cmd === 'poll') {
        if (rawArgs.includes('|')) {
          const pollParts = rawArgs.split('|').map((s: string) => s.trim());
          args.question = pollParts[0];
          args.options = pollParts.slice(1).filter(Boolean);
        } else {
          args.question = rawArgs;
        }
      } else if (cmd === 'gstart') {
        args.duration = parts[0];
        args.winners = parts[1];
        args.prize = parts.slice(2).join(' ');
      } else if (cmd === 'remindme') {
        args.time = parts[0];
        args.text = parts.slice(1).join(' ');
      }
    }

    // Helper to resolve user from string query (@username, username, userId, mention)
    const resolveTargetUser = async (targetQuery?: string) => {
      if (!targetQuery) {
        return User.findOne({ userId: req.user.userId }).select('userId username displayName avatar banner');
      }
      const clean = targetQuery.trim().replace(/^<@!?([a-zA-Z0-9_-]+)>$/, '$1').replace(/^@/, '');
      const member = space.members.find((m: any) => m.userId === clean || m.nickname?.toLowerCase() === clean.toLowerCase());
      const queryId = member ? member.userId : clean;
      return User.findOne({
        $or: [
          { userId: queryId },
          { username: new RegExp(`^${clean}$`, 'i') },
          { displayName: new RegExp(`^${clean}$`, 'i') }
        ]
      }).select('userId username displayName avatar banner');
    };

    // /rank [user]
    if (cmd === 'rank') {
      const targetUser = await resolveTargetUser(args.userId);
      const targetUserId = targetUser?.userId || req.user.userId;
      const userXP = await NikoMemberXP.findOne({ spaceId: space.id, userId: targetUserId });

      const xp = userXP?.xp || 0;
      const level = userXP?.level || 0;
      const requiredXp = getRequiredXpForLevel(level);
      const higherCount = await NikoMemberXP.countDocuments({ spaceId: space.id, xp: { $gt: xp } });
      const rank = higherCount + 1;
      const progress = Math.min(100, Math.floor((xp / requiredXp) * 100));

      const rankEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `⭐ Rank Card — ${targetUser?.displayName || targetUser?.username}`,
        thumbnailUrl: targetUser?.avatar || '',
        description: `**Server Rank:** #${rank}\n**Level:** ${level}\n**Total XP:** ${xp} / ${requiredXp} XP\n**Progress:** ${progress}%\n[${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}]`,
        footer: { text: `Niko Leveling System · ${space.name}`, timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, { embeds: [rankEmbed] });
      }

      return res.json({ ok: true, embed: rankEmbed });
    }

    // /leaderboard
    if (cmd === 'leaderboard') {
      const topMembers = await NikoMemberXP.find({ spaceId: space.id }).sort({ xp: -1 }).limit(10).lean();
      const list = topMembers
        .map((m, i) => `${i + 1}. **${m.username}** — Level ${m.level} (${m.xp} XP)`)
        .join('\n');

      const lbEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#FEE75C',
        title: `🏆 ${space.name} XP Leaderboard`,
        description: list || 'No leveled members yet! Start chatting to earn XP!',
        footer: { text: 'Niko Leveling · Top 10 Members', timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, { embeds: [lbEmbed] });
      }
      return res.json({ ok: true, embed: lbEmbed });
    }

    // /av or /avatar [user]
    if (cmd === 'av' || cmd === 'avatar') {
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User not found' });
      const avEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `🖼️ Avatar of ${targetUser.displayName || targetUser.username}`,
        imageUrl: targetUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Niko',
        footer: { text: `Requested by @${req.user.username}`, timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [avEmbed] });
      return res.json({ ok: true, embed: avEmbed });
    }

    // /banner [user]
    if (cmd === 'banner') {
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User not found' });
      const bannerEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `🎨 Banner of ${targetUser.displayName || targetUser.username}`,
        imageUrl: targetUser.banner || undefined,
        description: targetUser.banner ? undefined : '*This user has not set a custom banner.*',
        footer: { text: `Requested by @${req.user.username}`, timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [bannerEmbed] });
      return res.json({ ok: true, embed: bannerEmbed });
    }

    // /userinfo [user]
    if (cmd === 'userinfo') {
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User not found' });
      const member = space.members.find((m: any) => m.userId === targetUser.userId);
      const memberRoles = space.roles.filter((r: any) => member?.roleIds?.includes(r.id)).map((r: any) => r.name);
      const userXP = await NikoMemberXP.findOne({ spaceId: space.id, userId: targetUser.userId });

      const infoEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `👤 User Information — ${targetUser.displayName || targetUser.username}`,
        thumbnailUrl: targetUser.avatar || '',
        fields: [
          { id: '1', name: 'User', value: `<@${targetUser.userId}> (${targetUser.username})`, inline: true },
          { id: '2', name: 'Level & XP', value: `Level ${userXP?.level || 0} (${userXP?.xp || 0} XP)`, inline: true },
          { id: '3', name: 'Joined Space', value: member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown', inline: true },
          { id: '4', name: 'Roles', value: memberRoles.length ? memberRoles.join(', ') : 'None', inline: false }
        ],
        footer: { text: `User ID: ${targetUser.userId}`, timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [infoEmbed] });
      return res.json({ ok: true, embed: infoEmbed });
    }

    // /snipe - Recover last deleted message in channel
    if (cmd === 'snipe') {
      if (!channelId) return res.status(400).json({ ok: false, message: 'channelId is required' });
      const sniped = lastDeletedMessages.get(channelId);
      if (!sniped) {
        return res.json({ ok: false, message: 'There is nothing to snipe in this channel!' });
      }

      const snipeEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#ED4245',
        author: { name: sniped.senderName, iconUrl: sniped.senderAvatar },
        title: '🎯 Sniped Deleted Message',
        description: sniped.text || '*No text content*',
        footer: {
          text: `Deleted at ${sniped.deletedAt.toLocaleTimeString()} · Original message from ${sniped.timestamp.toLocaleTimeString()}`
        }
      };

      await sendNikoBotMessage(req, space, channelId, { embeds: [snipeEmbed] });
      return res.json({ ok: true, embed: snipeEmbed });
    }

    // /poll [question] [options...]
    if (cmd === 'poll') {
      const question = args.question || 'Community Poll';
      const options: string[] = Array.isArray(args.options) && args.options.length > 0 ? args.options : ['Yes', 'No'];

      const pollComponents: INikoActionRow = {
        type: 'action_row',
        components: options.slice(0, 5).map((opt, i) => ({
          type: 'button',
          id: `poll_${randomUUID()}`,
          label: opt,
          emoji: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || '▫️',
          style: 'secondary',
          actionType: 'poll_vote',
          targetId: String(i)
        }))
      };

      const pollEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#5865F2',
        title: `📊 ${question}`,
        description: options.map((opt, i) => `${['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || '▫️'} **${opt}** (0 votes)`).join('\n\n'),
        footer: { text: `Poll created by @${req.user.username} · Click a button to vote!`, timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, {
          embeds: [pollEmbed],
          components: [pollComponents]
        });
      }

      return res.json({ ok: true, message: 'Poll deployed!' });
    }

    // /gstart [duration] [winners] [prize]
    if (cmd === 'gstart') {
      const prize = args.prize || 'Special Role / Perk';
      const winnerCount = Math.max(1, parseInt(args.winners) || 1);
      const minutes = Math.max(1, parseInt(args.duration) || 10);
      const endsAt = new Date(Date.now() + minutes * 60 * 1000);

      const giveawayId = randomUUID();
      const giveawayRecord = {
        id: giveawayId,
        messageId: '',
        channelId: channelId || '',
        prize,
        winnerCount,
        endsAt,
        hostUserId: req.user.userId,
        hostUsername: req.user.username,
        participants: [],
        ended: false
      };

      config.giveaways.push(giveawayRecord);
      await config.save();

      const giveawayEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#EB459E',
        title: `🎉 GIVEAWAY: ${prize} 🎉`,
        description: `React with the button below to enter!\n\n**Winners:** ${winnerCount}\n**Hosted By:** <@${req.user.userId}>\n**Ends At:** ${endsAt.toLocaleString()}\n**Entries:** 0`,
        footer: { text: 'Niko Giveaways · Good luck!', timestamp: true }
      };

      const gComponent: INikoActionRow = {
        type: 'action_row',
        components: [
          {
            type: 'button',
            id: `g_${giveawayId}`,
            label: 'Enter Giveaway',
            emoji: '🎉',
            style: 'success',
            actionType: 'giveaway',
            targetId: giveawayId
          }
        ]
      };

      if (channelId) {
        const msg = await sendNikoBotMessage(req, space, channelId, {
          embeds: [giveawayEmbed],
          components: [gComponent]
        });
        giveawayRecord.messageId = String(msg._id);
        await config.save();
      }

      return res.json({ ok: true, message: 'Giveaway started!' });
    }

    // /warn [user] [reason]
    if (cmd === 'warn') {
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User to warn is required' });
      const targetUserId = targetUser.userId;
      const reason = args.reason || 'Rule violation';

      config.warnings.push({
        id: randomUUID(),
        userId: targetUserId,
        moderatorId: req.user.userId,
        moderatorUsername: req.user.username,
        reason,
        createdAt: new Date()
      });
      await config.save();

      const warnEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#ED4245',
        title: '⚠️ Moderation Warning Issued',
        description: `**Member:** <@${targetUserId}>\n**Moderator:** <@${req.user.userId}>\n**Reason:** ${reason}`,
        footer: { text: `Total warnings for user: ${config.warnings.filter(w => w.userId === targetUserId).length}`, timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, { embeds: [warnEmbed] });
      }
      return res.json({ ok: true, message: `Warning issued to user.` });
    }

    // /warnings [user]
    if (cmd === 'warnings') {
      const targetUser = await resolveTargetUser(args.userId);
      const targetUserId = targetUser?.userId || req.user.userId;
      const userWarns = config.warnings.filter(w => w.userId === targetUserId);

      const list = userWarns.length
        ? userWarns.map((w, i) => `${i + 1}. **${w.reason}** — by @${w.moderatorUsername} (${new Date(w.createdAt).toLocaleDateString()})`).join('\n')
        : 'This member has a clean record with 0 warnings.';

      const warnsEmbed: INikoEmbed = {
        id: randomUUID(),
        color: userWarns.length ? '#ED4245' : '#57F287',
        title: `📋 Warnings for Member`,
        description: list,
        footer: { text: `Total: ${userWarns.length} warnings`, timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, { embeds: [warnsEmbed] });
      }
      return res.json({ ok: true, embed: warnsEmbed });
    }

    // /ban [user] [reason]
    if (cmd === 'ban') {
      if (!hasSpacePermission(space, req.user.userId, 'BAN_MEMBERS')) {
        return res.status(403).json({ ok: false, message: 'You need Ban Members permission.' });
      }
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User to ban not found' });
      if (targetUser.userId === space.ownerId) return res.status(400).json({ ok: false, message: 'Cannot ban space owner.' });

      const reason = args.reason || 'Banned by moderator via Niko';
      if (!space.bannedUserIds.includes(targetUser.userId)) space.bannedUserIds.push(targetUser.userId);
      space.bans = (space.bans || []).filter((b: any) => b.userId !== targetUser.userId);
      space.bans.push({ userId: targetUser.userId, moderatorId: req.user.userId, reason, bannedAt: new Date() });
      space.members = space.members.filter((m: any) => m.userId !== targetUser.userId);
      await space.save();

      const banEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#ED4245',
        title: '🔨 Member Banned',
        description: `**Member:** <@${targetUser.userId}> (${targetUser.username})\n**Moderator:** <@${req.user.userId}>\n**Reason:** ${reason}`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [banEmbed] });
      return res.json({ ok: true, message: `Banned @${targetUser.username}` });
    }

    // /kick [user] [reason]
    if (cmd === 'kick') {
      if (!hasSpacePermission(space, req.user.userId, 'KICK_MEMBERS')) {
        return res.status(403).json({ ok: false, message: 'You need Kick Members permission.' });
      }
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User to kick not found' });
      if (targetUser.userId === space.ownerId) return res.status(400).json({ ok: false, message: 'Cannot kick space owner.' });

      const reason = args.reason || 'Kicked by moderator via Niko';
      space.members = space.members.filter((m: any) => m.userId !== targetUser.userId);
      await space.save();

      const kickEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#ED4245',
        title: '👢 Member Kicked',
        description: `**Member:** <@${targetUser.userId}> (${targetUser.username})\n**Moderator:** <@${req.user.userId}>\n**Reason:** ${reason}`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [kickEmbed] });
      return res.json({ ok: true, message: `Kicked @${targetUser.username}` });
    }

    // /timeout [user] [minutes] [reason]
    if (cmd === 'timeout') {
      if (!hasSpacePermission(space, req.user.userId, 'MODERATE_MEMBERS')) {
        return res.status(403).json({ ok: false, message: 'You need Moderate Members permission.' });
      }
      const targetUser = await resolveTargetUser(args.userId);
      if (!targetUser) return res.status(404).json({ ok: false, message: 'User to timeout not found' });
      const durationMinutes = Math.max(1, parseInt(args.duration) || 10);
      const reason = args.reason || 'Timed out by moderator';
      const member = space.members.find((m: any) => m.userId === targetUser.userId);
      if (!member) return res.status(404).json({ ok: false, message: 'Member not found in space' });

      member.mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
      await space.save();

      const timeoutEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#FEE75C',
        title: '⏳ Member Timed Out',
        description: `**Member:** <@${targetUser.userId}>\n**Duration:** ${durationMinutes} minutes\n**Moderator:** <@${req.user.userId}>\n**Reason:** ${reason}`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [timeoutEmbed] });
      return res.json({ ok: true, message: `Timed out @${targetUser.username} for ${durationMinutes}m` });
    }

    // /lock
    if (cmd === 'lock') {
      if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) {
        return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
      }
      const ch = space.channels.find((c: any) => c.id === channelId);
      if (!ch) return res.status(404).json({ ok: false, message: 'Channel not found' });
      const everyoneRole = space.roles.find((r: any) => r.id === 'everyone' || r.name === '@everyone');
      const everyoneId = everyoneRole ? everyoneRole.id : 'everyone';
      let overwrite = ch.permissionOverwrites.find((o: any) => o.roleId === everyoneId);
      if (!overwrite) {
        overwrite = { roleId: everyoneId, allow: 0, deny: 0 };
        ch.permissionOverwrites.push(overwrite);
      }
      overwrite.deny = (overwrite.deny || 0) | SPACE_PERMISSIONS.SEND_MESSAGES;
      overwrite.allow = (overwrite.allow || 0) & ~SPACE_PERMISSIONS.SEND_MESSAGES;
      await space.save();

      const lockEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#ED4245',
        title: '🔒 Channel Locked',
        description: `This channel **#${ch.name}** has been locked by <@${req.user.userId}>. Members cannot send messages.`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      await sendNikoBotMessage(req, space, channelId, { embeds: [lockEmbed] });
      return res.json({ ok: true, message: 'Channel locked' });
    }

    // /unlock
    if (cmd === 'unlock') {
      if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) {
        return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
      }
      const ch = space.channels.find((c: any) => c.id === channelId);
      if (!ch) return res.status(404).json({ ok: false, message: 'Channel not found' });
      const everyoneRole = space.roles.find((r: any) => r.id === 'everyone' || r.name === '@everyone');
      const everyoneId = everyoneRole ? everyoneRole.id : 'everyone';
      const overwrite = ch.permissionOverwrites.find((o: any) => o.roleId === everyoneId);
      if (overwrite) {
        overwrite.deny = (overwrite.deny || 0) & ~SPACE_PERMISSIONS.SEND_MESSAGES;
      }
      await space.save();

      const unlockEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#57F287',
        title: '🔓 Channel Unlocked',
        description: `This channel **#${ch.name}** has been unlocked by <@${req.user.userId}>. Normal messaging resumed.`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      await sendNikoBotMessage(req, space, channelId, { embeds: [unlockEmbed] });
      return res.json({ ok: true, message: 'Channel unlocked' });
    }

    // /slowmode [seconds]
    if (cmd === 'slowmode') {
      if (!hasSpacePermission(space, req.user.userId, 'MANAGE_CHANNELS')) {
        return res.status(403).json({ ok: false, message: 'You need Manage Channels permission.' });
      }
      const seconds = Math.max(0, Math.min(21600, parseInt(args.seconds) || 0));
      const ch = space.channels.find((c: any) => c.id === channelId);
      if (!ch) return res.status(404).json({ ok: false, message: 'Channel not found' });
      ch.slowmodeSeconds = seconds;
      await space.save();

      const smEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#5865F2',
        title: '⏱️ Slowmode Updated',
        description: seconds > 0
          ? `Slowmode for **#${ch.name}** is now set to **${seconds} seconds**.`
          : `Slowmode for **#${ch.name}** has been disabled.`,
        footer: { text: 'Niko Moderation Suite', timestamp: true }
      };
      await sendNikoBotMessage(req, space, channelId, { embeds: [smEmbed] });
      return res.json({ ok: true, message: 'Slowmode updated' });
    }

    // /remindme [time] [text]
    if (cmd === 'remindme') {
      const minutes = Math.max(1, parseInt(args.time) || 5);
      const text = args.text || 'Reminder!';
      const remindEmbed: INikoEmbed = {
        id: randomUUID(),
        color: '#5865F2',
        title: '⏰ Reminder Set',
        description: `I will remind you <@${req.user.userId}> in **${minutes} minutes**:\n\n> ${text}`,
        footer: { text: 'Niko Utilities', timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [remindEmbed] });
      return res.json({ ok: true, message: 'Reminder set' });
    }

    // /serverinfo
    if (cmd === 'serverinfo') {
      const infoEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `ℹ️ ${space.name} — Server Information`,
        thumbnailUrl: space.icon || '',
        fields: [
          { id: '1', name: 'Owner', value: `<@${space.ownerId}>`, inline: true },
          { id: '2', name: 'Members', value: `${space.members.length} members`, inline: true },
          { id: '3', name: 'Channels', value: `${space.channels.length} channels`, inline: true },
          { id: '4', name: 'Roles', value: `${space.roles.length} roles`, inline: true },
          { id: '5', name: 'Verification', value: space.verificationLevel || 'none', inline: true },
          { id: '6', name: 'Created At', value: new Date(space.createdAt).toLocaleDateString(), inline: true }
        ],
        footer: { text: `Server ID: ${space._id}`, timestamp: true }
      };

      if (channelId) {
        await sendNikoBotMessage(req, space, channelId, { embeds: [infoEmbed] });
      }
      return res.json({ ok: true, embed: infoEmbed });
    }

    // /purge [amount]
    if (cmd === 'purge') {
      const amount = Math.min(100, Math.max(1, parseInt(args.amount) || 10));
      const roomId = `space:${space.id}:${channelId}`;
      const messagesToDelete = await Message.find({ roomId }).sort({ createdAt: -1 }).limit(amount).select('_id');
      const ids = messagesToDelete.map(m => m._id);

      await Message.deleteMany({ _id: { $in: ids } });

      const io = req.app?.get('io');
      if (io) {
        io.to(roomId).emit('messages:purged', { channelId, count: ids.length });
      }

      return res.json({ ok: true, message: `🧹 Purged ${ids.length} messages from this channel.` });
    }

    // Custom Commands Check
    const customCmd = config.customCommands?.find(c => c.trigger.toLowerCase().replace(/^\//, '') === cmd);
    if (customCmd) {
      const customEmbed: INikoEmbed = {
        id: randomUUID(),
        color: config.accentColor || '#5865F2',
        title: `⚡ /${customCmd.trigger.replace(/^\//, '')}`,
        description: replaceTemplateVariables(customCmd.responseText, {
          user: req.user,
          space: { name: space.name, memberCount: space.members.length }
        }),
        footer: { text: `${config.botName || 'Niko'} Custom Command`, timestamp: true }
      };
      if (channelId) await sendNikoBotMessage(req, space, channelId, { embeds: [customEmbed] });
      return res.json({ ok: true, embed: customEmbed });
    }

    return res.status(400).json({ ok: false, message: `Unknown command /${cmd}` });
  } catch (error) {
    console.error('Slash command failed:', error);
    return res.status(500).json({ ok: false, message: 'Failed to execute slash command' });
  }
});

import mongoose, { Document, Schema } from 'mongoose';

export interface INikoEmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

export interface INikoEmbed {
  id: string;
  name?: string;
  color?: string; // hex (e.g. #5865F2)
  author?: {
    name: string;
    iconUrl?: string;
    url?: string;
  };
  title?: string;
  titleUrl?: string;
  description?: string;
  fields?: INikoEmbedField[];
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: {
    text: string;
    iconUrl?: string;
    timestamp?: boolean;
  };
  timestamp?: string;
}

export interface INikoComponentOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  roleId?: string;
}

export interface INikoComponent {
  type: 'button' | 'select';
  id: string;
  label?: string;
  emoji?: string;
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  url?: string;
  actionType:
    | 'role'
    | 'ticket'
    | 'verify'
    | 'custom_link'
    | 'giveaway'
    | 'ticket_close'
    | 'ticket_claim'
    | 'ticket_add_user'
    | 'poll_vote';
  targetId?: string;
  customId?: string;
  disabled?: boolean;
  placeholder?: string;
  options?: INikoComponentOption[];
  minValues?: number;
  maxValues?: number;
}

export interface INikoActionRow {
  type: 'action_row';
  components: INikoComponent[];
}

export interface INikoRolePanel {
  id: string;
  title: string;
  channelId: string;
  messageId?: string;
  mode: 'toggle' | 'verify' | 'unique' | 'dropdown';
  roles: Array<{
    roleId: string;
    label: string;
    emoji?: string;
    style?: string;
    description?: string;
  }>;
}

export interface INikoTicketCategory {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  targetCategoryId?: string;
}

export interface INikoTicket {
  id: string;
  channelId: string;
  creatorId: string;
  creatorUsername: string;
  ticketNumber: number;
  categoryId: string;
  categoryName: string;
  status: 'open' | 'claimed' | 'closed';
  claimedBy?: {
    userId: string;
    username: string;
  };
  createdAt: Date;
  closedAt?: Date;
}

export interface INikoGiveaway {
  id: string;
  messageId: string;
  channelId: string;
  prize: string;
  winnerCount: number;
  endsAt: Date;
  hostUserId: string;
  hostUsername: string;
  participants: string[];
  winners?: string[];
  ended: boolean;
}

export interface INikoWarning {
  id: string;
  userId: string;
  moderatorId: string;
  moderatorUsername: string;
  reason: string;
  createdAt: Date;
}

export interface INikoCustomCommand {
  id: string;
  trigger: string;
  matchType: 'exact' | 'startsWith' | 'contains';
  responseText: string;
  embedData?: any;
  deleteTrigger: boolean;
}

export interface INikoConfig extends Document {
  spaceId: string;
  enabled: boolean;
  botName: string;
  botAvatar: string;
  bio: string;
  accentColor: string;
  prefix: string;

  embedTemplates: INikoEmbed[];
  rolePanels: INikoRolePanel[];

  ticketConfig: {
    enabled: boolean;
    panelChannelId?: string;
    defaultCategoryId?: string;
    transcriptChannelId?: string;
    supportRoleIds: string[];
    ticketCounter: number;
    categories: INikoTicketCategory[];
  };
  tickets: INikoTicket[];

  levelingConfig: {
    enabled: boolean;
    minXp: number;
    maxXp: number;
    cooldownSeconds: number;
    voiceXpPerMin: number;
    announcementChannelId?: string;
    alertType: 'channel' | 'dm' | 'disabled';
    levelUpMessage?: string;
    sendEmbed?: boolean;
    stackRoles: boolean;
    roleRewards: Array<{ level: number; roleId: string }>;
    noXpChannelIds?: string[];
    doubleXpRoleIds?: string[];
  };

  welcomeConfig: {
    enabled: boolean;
    channelId?: string;
    message: string;
    sendDm: boolean;
    dmMessage: string;
    autoRoleIds: string[];
    goodbyeEnabled: boolean;
    goodbyeChannelId?: string;
    goodbyeMessage: string;
  };

  automodConfig: {
    enabled: boolean;
    antiSpam: {
      enabled: boolean;
      maxMessagesPer5s: number;
      action: 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';
    };
    antiMassMention: {
      enabled: boolean;
      maxMentions: number;
      action: 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';
    };
    antiInvite: {
      enabled: boolean;
      whitelistRoles: string[];
      whitelistChannels: string[];
      action: 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';
    };
    badWords: {
      enabled: boolean;
      words: string[];
      regexPatterns: string[];
      action: 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';
    };
    antiRaid: {
      enabled: boolean;
      lockedDown: boolean;
      joinThreshold: number;
    };
    logChannelId?: string;
  };

  warnings: INikoWarning[];
  giveaways: INikoGiveaway[];
  customCommands: INikoCustomCommand[];

  createdAt: Date;
  updatedAt: Date;
}

const nikoConfigSchema = new Schema<INikoConfig>(
  {
    spaceId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    botName: { type: String, default: 'Niko' },
    botAvatar: {
      type: String,
      default: 'https://api.dicebear.com/7.x/bottts/svg?seed=NikoSpace&backgroundColor=5865f2'
    },
    bio: {
      type: String,
      default: 'Niko — The all-in-one automation, moderation & embed studio assistant.'
    },
    accentColor: { type: String, default: '#5865F2' },
    prefix: { type: String, default: '/' },

    embedTemplates: { type: Array, default: [] } as any,
    rolePanels: { type: Array, default: [] } as any,

    ticketConfig: {
      enabled: { type: Boolean, default: true },
      panelChannelId: { type: String },
      defaultCategoryId: { type: String },
      transcriptChannelId: { type: String },
      supportRoleIds: { type: [String], default: [] },
      ticketCounter: { type: Number, default: 0 },
      categories: {
        type: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            description: { type: String, default: '' },
            emoji: { type: String, default: '🎫' },
            targetCategoryId: { type: String }
          }
        ],
        default: [
          { id: 'general', name: 'General Support', description: 'Ask questions or get help with this Space', emoji: '❓' },
          { id: 'billing', name: 'Billing & Perks', description: 'Inquire about purchases, perks, or VIP subscriptions', emoji: '💳' },
          { id: 'reports', name: 'Report Member / Rule Violation', description: 'Privately report user misconduct or harassment', emoji: '🛡️' }
        ]
      }
    },
    tickets: { type: Array, default: [] } as any,

    levelingConfig: {
      enabled: { type: Boolean, default: true },
      minXp: { type: Number, default: 15 },
      maxXp: { type: Number, default: 25 },
      cooldownSeconds: { type: Number, default: 60 },
      voiceXpPerMin: { type: Number, default: 10 },
      announcementChannelId: { type: String, default: '' },
      alertType: { type: String, enum: ['channel', 'dm', 'disabled'], default: 'channel' },
      levelUpMessage: { type: String, default: '🎉 GG {user.mention}! You just leveled up to **Level {level}**{role}!' },
      sendEmbed: { type: Boolean, default: true },
      stackRoles: { type: Boolean, default: true },
      roleRewards: { type: [{ level: Number, roleId: String }], default: [] },
      noXpChannelIds: { type: [String], default: [] },
      doubleXpRoleIds: { type: [String], default: [] }
    },

    welcomeConfig: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      message: { type: String, default: 'Welcome to **{space.name}**, {user.mention}! 🎉 We are glad to have you here.' },
      sendDm: { type: Boolean, default: false },
      dmMessage: { type: String, default: 'Welcome to **{space.name}**! Enjoy your stay.' },
      autoRoleIds: { type: [String], default: [] },
      goodbyeEnabled: { type: Boolean, default: false },
      goodbyeChannelId: { type: String, default: '' },
      goodbyeMessage: { type: String, default: 'Goodbye **{user}**, we will miss you!' }
    },

    automodConfig: {
      enabled: { type: Boolean, default: true },
      antiSpam: {
        enabled: { type: Boolean, default: true },
        maxMessagesPer5s: { type: Number, default: 5 },
        action: { type: String, enum: ['delete', 'warn', 'timeout', 'kick', 'ban'], default: 'delete' }
      },
      antiMassMention: {
        enabled: { type: Boolean, default: true },
        maxMentions: { type: Number, default: 5 },
        action: { type: String, enum: ['delete', 'warn', 'timeout', 'kick', 'ban'], default: 'warn' }
      },
      antiInvite: {
        enabled: { type: Boolean, default: true },
        whitelistRoles: { type: [String], default: [] },
        whitelistChannels: { type: [String], default: [] },
        action: { type: String, enum: ['delete', 'warn', 'timeout', 'kick', 'ban'], default: 'delete' }
      },
      badWords: {
        enabled: { type: Boolean, default: false },
        words: { type: [String], default: [] },
        regexPatterns: { type: [String], default: [] },
        action: { type: String, enum: ['delete', 'warn', 'timeout', 'kick', 'ban'], default: 'delete' }
      },
      antiRaid: {
        enabled: { type: Boolean, default: true },
        lockedDown: { type: Boolean, default: false },
        joinThreshold: { type: Number, default: 10 }
      },
      logChannelId: { type: String }
    },

    warnings: { type: Array, default: [] } as any,
    giveaways: { type: Array, default: [] } as any,
    customCommands: { type: Array, default: [] } as any
  },
  { timestamps: true }
);

export const NikoConfig = mongoose.model<INikoConfig>('NikoConfig', nikoConfigSchema);

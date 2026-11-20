import mongoose, { Document, Schema } from 'mongoose';

export const SPACE_PERMISSIONS = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  READ_MESSAGE_HISTORY: 1 << 2,
  ADD_REACTIONS: 1 << 3,
  ATTACH_FILES: 1 << 4,
  EMBED_LINKS: 1 << 5,
  MENTION_EVERYONE: 1 << 6,
  MANAGE_MESSAGES: 1 << 7,
  CONNECT: 1 << 8,
  SPEAK: 1 << 9,
  CHANGE_NICKNAME: 1 << 10,
  MANAGE_NICKNAMES: 1 << 11,
  KICK_MEMBERS: 1 << 12,
  BAN_MEMBERS: 1 << 13,
  CREATE_INVITE: 1 << 14,
  MANAGE_CHANNELS: 1 << 15,
  MANAGE_ROLES: 1 << 16,
  MANAGE_EMOJIS_AND_STICKERS: 1 << 17,
  MANAGE_SPACE: 1 << 18,
  ADMINISTRATOR: 1 << 19,
  CREATE_PUBLIC_THREADS: 1 << 20,
  CREATE_PRIVATE_THREADS: 1 << 21,
  SEND_MESSAGES_IN_THREADS: 1 << 22,
  MANAGE_THREADS: 1 << 23,
  CREATE_EVENTS: 1 << 24,
  MANAGE_EVENTS: 1 << 25,
  MANAGE_WEBHOOKS: 1 << 26,
  MODERATE_MEMBERS: 1 << 27
} as const;

export type SpacePermission = keyof typeof SPACE_PERMISSIONS;
export type SpaceChannelType = 'text' | 'voice' | 'announcement' | 'forum';

export interface ISpaceInvite {
  code: string;
  creatorId: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  uses: number;
  channelId?: string;
}

export interface ISpaceBan {
  userId: string;
  moderatorId: string;
  reason: string;
  bannedAt: Date;
}

export interface ISpaceRole {
  id: string;
  name: string;
  color: string;
  icon?: string;
  permissions: number;
  position: number;
  hoist: boolean;
  mentionable: boolean;
}

export interface ISpaceChannelOverwrite {
  roleId: string;
  allow: number;
  deny: number;
}

export interface ISpaceChannel {
  id: string;
  name: string;
  type: SpaceChannelType;
  topic: string;
  categoryId: string;
  position: number;
  slowmodeSeconds: number;
  nsfw: boolean;
  forumTags: string[];
  bitrate?: number;
  userLimit?: number;
  inactivityHideDays?: number;
  permissionOverwrites: ISpaceChannelOverwrite[];
}

export interface ISpaceCategory {
  id: string;
  name: string;
  parentId: string;
  position: number;
  permissionOverwrites: ISpaceChannelOverwrite[];
}

export interface ITemporaryRoleAssignment {
  roleId: string;
  expiresAt: Date;
}

export interface ISpaceMember {
  userId: string;
  roleIds: string[];
  temporaryRoleAssignments: ITemporaryRoleAssignment[];
  nickname: string;
  joinedAt: Date;
  mutedUntil?: Date;
}

export interface ISpaceAsset {
  id: string;
  name: string;
  url: string;
  animated?: boolean;
  associatedEmoji?: string;
  creatorId: string;
  createdAt: Date;
}

export interface ISpace extends Document {
  name: string;
  description: string;
  icon: string;
  banner: string;
  ownerId: string;
  members: ISpaceMember[];
  roles: ISpaceRole[];
  categories: ISpaceCategory[];
  channels: ISpaceChannel[];
  emojis: ISpaceAsset[];
  stickers: ISpaceAsset[];
  inviteCode: string;
  invites: ISpaceInvite[];
  invitesPaused: boolean;
  bannedUserIds: string[];
  bans: ISpaceBan[];
  verificationLevel: 'none' | 'low' | 'medium' | 'high';
  defaultNotifications: 'all' | 'mentions';
  explicitContentFilter: 'disabled' | 'membersWithoutRoles' | 'allMembers';
  isPublic: boolean;
  widgetEnabled: boolean;
  widgetChannelId: string;
  shareHistoryWithNewMembers: boolean;
  discoveryCategory: string;
  discoveryTags: string[];
  welcomeChannelId?: string;
  welcomeMessageTemplate?: string;
  autoRoleId?: string;
  systemChannelId?: string;
  rulesChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<ISpaceRole>({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 100 },
  color: { type: String, default: '#99aab5', match: /^#[0-9a-fA-F]{6}$/ },
  icon: { type: String, default: '', maxlength: 32 },
  permissions: { type: Number, required: true, min: 0 },
  position: { type: Number, required: true, min: 0 },
  hoist: { type: Boolean, default: false },
  mentionable: { type: Boolean, default: false }
}, { _id: false });

const overwriteSchema = new Schema<ISpaceChannelOverwrite>({
  roleId: { type: String, required: true },
  allow: { type: Number, default: 0, min: 0 },
  deny: { type: Number, default: 0, min: 0 }
}, { _id: false });

const channelSchema = new Schema<ISpaceChannel>({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ['text', 'voice', 'announcement', 'forum'], default: 'text' },
  topic: { type: String, default: '', maxlength: 1024 },
  categoryId: { type: String, default: '' },
  position: { type: Number, default: 0, min: 0 },
  slowmodeSeconds: { type: Number, default: 0, min: 0, max: 21600 },
  nsfw: { type: Boolean, default: false },
  forumTags: { type: [String], default: [] },
  bitrate: { type: Number, default: 64000, min: 8000, max: 384000 },
  userLimit: { type: Number, default: 0, min: 0, max: 99 },
  inactivityHideDays: { type: Number, default: 0, min: 0, max: 365 },
  permissionOverwrites: { type: [overwriteSchema], default: [] }
}, { _id: false });

const categorySchema = new Schema<ISpaceCategory>({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 100 },
  parentId: { type: String, default: '' },
  position: { type: Number, default: 0, min: 0 },
  permissionOverwrites: { type: [overwriteSchema], default: [] }
}, { _id: false });

const memberSchema = new Schema<ISpaceMember>({
  userId: { type: String, required: true },
  roleIds: { type: [String], default: [] },
  temporaryRoleAssignments: {
    type: [{ roleId: { type: String, required: true }, expiresAt: { type: Date, required: true } }],
    default: []
  },
  nickname: { type: String, default: '', maxlength: 32 },
  joinedAt: { type: Date, default: Date.now },
  mutedUntil: { type: Date }
}, { _id: false });

const assetSchema = new Schema<ISpaceAsset>({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 32 },
  url: { type: String, required: true, maxlength: 2048 },
  animated: { type: Boolean, default: false },
  associatedEmoji: { type: String, default: '', maxlength: 16 },
  creatorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const inviteSchema = new Schema<ISpaceInvite>({
  code: { type: String, required: true },
  creatorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  maxUses: { type: Number, min: 1 },
  uses: { type: Number, default: 0, min: 0 },
  channelId: { type: String, default: '' }
}, { _id: false });

const banSchema = new Schema<ISpaceBan>({
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: '', maxlength: 500 },
  bannedAt: { type: Date, default: Date.now }
}, { _id: false });

const spaceSchema = new Schema<ISpace>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 1000 },
  icon: { type: String, default: '' },
  banner: { type: String, default: '' },
  ownerId: { type: String, required: true, index: true },
  members: { type: [memberSchema], default: [] },
  roles: { type: [roleSchema], default: [] },
  categories: { type: [categorySchema], default: [] },
  channels: { type: [channelSchema], default: [] },
  emojis: { type: [assetSchema], default: [] },
  stickers: { type: [assetSchema], default: [] },
  inviteCode: { type: String, required: true, unique: true, index: true },
  invites: { type: [inviteSchema], default: [] },
  invitesPaused: { type: Boolean, default: false },
  bannedUserIds: { type: [String], default: [] },
  bans: { type: [banSchema], default: [] },
  verificationLevel: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
  defaultNotifications: { type: String, enum: ['all', 'mentions'], default: 'all' },
  explicitContentFilter: { type: String, enum: ['disabled', 'membersWithoutRoles', 'allMembers'], default: 'disabled' },
  isPublic: { type: Boolean, default: false, index: true },
  widgetEnabled: { type: Boolean, default: false },
  widgetChannelId: { type: String, default: '' },
  shareHistoryWithNewMembers: { type: Boolean, default: false },
  discoveryCategory: { type: String, default: 'Other', maxlength: 40 },
  discoveryTags: { type: [String], default: [], validate: (tags: string[]) => tags.length <= 5 },
  welcomeChannelId: { type: String, default: '' },
  welcomeMessageTemplate: { type: String, default: 'Welcome {user} to {space}! 🎉' },
  autoRoleId: { type: String, default: '' },
  systemChannelId: { type: String, default: '' },
  rulesChannelId: { type: String, default: '' }
}, { timestamps: true });

export const Space = mongoose.model<ISpace>('Space', spaceSchema);

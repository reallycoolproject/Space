import mongoose, { Schema, Document } from 'mongoose';

export type UserProvider = 'local' | 'google';
export type UserRole = 'user' | 'moderator' | 'admin';

export interface IUserBadge {
  id: string;
  name: string;
  description?: string;
  icon: string;
  awardedAt?: Date;
  memberNumber?: number;
}

export interface IUserConnection {
  id: string;
  provider: string;
  accountId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  verified: boolean;
  visibleOnProfile: boolean;
  displayRichPresence: boolean;
  metadata?: Record<string, any>;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  connectedAt: Date;
  lastSyncedAt?: Date;
}

export interface IUserActivity {
  type: 'playing' | 'listening' | 'streaming' | 'watching' | 'competing' | 'custom';
  provider?: string;
  name: string;
  details?: string;
  state?: string;
  url?: string;
  assets?: {
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
  };
  timestamps?: {
    start?: number;
    end?: number;
  };
  syncStatus?: 'active' | 'paused';
  updatedAt?: Date;
}

export interface IUser extends Document {
  email: string;
  username: string;
  userId: string;
  displayName?: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  pronouns?: string;
  badges?: IUserBadge[];
  memberNumber?: number;
  publicKey?: string;
  encryptedPrivateKey?: string;
  keySalt?: string; // Salt for PBKDF2 key derivation
  provider: UserProvider;
  role: UserRole;
  contacts: string[];
  pendingRequests: { userId: string; note?: string }[];
  blockedUsers: string[];
  nicknames?: { userId: string; nickname: string }[];
  hasCompletedOnboarding: boolean;
  isBanned: boolean;
  note?: {
    text: string;
    song?: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: {
        name: string;
        images: { url: string; height: number; width: number }[];
      };
      duration_ms: number;
      preview_url: string | null;
      external_urls: { spotify: string };
    };
    gif?: string;
    duration: '1day' | '3days' | '1week' | 'manual';
    expiresAt?: Date;
  };
  themeGradient?: {
    color1: string;
    color2: string;
    angle: number;
  };
  status: 'active' | 'inactive' | 'dnd';
  customActivity?: string;
  connections?: IUserConnection[];
  activity?: IUserActivity;
  allowOneTimeMessages?: boolean; // Privacy setting to enable/disable one-time messages
  allowGroupAdds?: boolean;
  groupAddExceptions?: string[];
  favoriteGifs?: string[];
  oneTimeMessageCooldowns?: { targetUserId: string; lastSent: Date }[]; // Track cooldowns
  oneTimeMessageRejectedUsers?: string[]; // Users who rejected one-time messages (permanent block)
  oneTimeMessageAcceptedUsers?: string[]; // Users who accepted one-time messages (can chat while unfriended)
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, trim: true, lowercase: true },
  username: { type: String, required: true, trim: true, unique: true },
  userId: { type: String, required: true, unique: true },
  displayName: { type: String, trim: true },
  avatar: { type: String },
  banner: { type: String },
  bio: { type: String, trim: true, maxlength: 300 },
  pronouns: { type: String, trim: true, maxlength: 50 },
  themeGradient: {
    color1: { type: String, default: '#0099ff' },
    color2: { type: String, default: '#7928ca' },
    angle: { type: Number, default: 135 }
  },
  publicKey: { type: String },
  encryptedPrivateKey: { type: String },
  keySalt: { type: String }, // Salt for PBKDF2 key derivation
  provider: { type: String, required: true, enum: ['local', 'google'], default: 'local' },
  role: { type: String, required: true, enum: ['user', 'moderator', 'admin'], default: 'user' },
  contacts: { type: [String], default: [] },
  pendingRequests: [{ userId: String, note: String }],
  blockedUsers: { type: [String], default: [] },
  nicknames: [{ userId: String, nickname: String }],
  hasCompletedOnboarding: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  badges: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String, required: true },
    awardedAt: { type: Date, default: Date.now },
    memberNumber: { type: Number }
  }],
  memberNumber: { type: Number, index: true },
  note: {
    type: {
      text: String,
      song: {
        id: String,
        name: String,
        artists: [{ name: String }],
        album: {
          name: String,
          images: [{ url: String, height: Number, width: Number }]
        },
        duration_ms: Number,
        preview_url: String,
        external_urls: { spotify: String }
      },
      gif: String,
      duration: { type: String, enum: ['1day', '3days', '1week', 'manual'] },
      expiresAt: Date
    }
  },
  status: { type: String, enum: ['active', 'inactive', 'dnd'], default: 'active' },
  customActivity: { type: String, maxlength: 100 },
  connections: [{
    id: { type: String, required: true },
    provider: { type: String, required: true },
    accountId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String },
    avatarUrl: { type: String },
    profileUrl: { type: String },
    verified: { type: Boolean, default: true },
    visibleOnProfile: { type: Boolean, default: true },
    displayRichPresence: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: Date.now }
  }],
  activity: {
    type: { type: String, enum: ['playing', 'listening', 'streaming', 'watching', 'competing', 'custom'] },
    provider: { type: String },
    name: { type: String },
    details: { type: String },
    state: { type: String },
    url: { type: String },
    assets: {
      largeImage: { type: String },
      largeText: { type: String },
      smallImage: { type: String },
      smallText: { type: String }
    },
    timestamps: {
      start: { type: Number },
      end: { type: Number }
    },
    syncStatus: { type: String, enum: ['active', 'paused'], default: 'active' },
    updatedAt: { type: Date, default: Date.now }
  },
  allowOneTimeMessages: { type: Boolean, default: true }, // Privacy setting to enable/disable one-time messages
  allowGroupAdds: { type: Boolean, default: true },
  groupAddExceptions: { type: [String], default: [] },
  favoriteGifs: { type: [String], default: [] },
  oneTimeMessageCooldowns: [{ targetUserId: String, lastSent: Date }], // Track cooldowns
  oneTimeMessageRejectedUsers: { type: [String], default: [] }, // Users who rejected one-time messages (permanent block)
  oneTimeMessageAcceptedUsers: { type: [String], default: [] } // Users who accepted one-time messages (can chat while unfriended)
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);

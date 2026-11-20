export type ConnectionCategory = 'gaming' | 'music' | 'social' | 'developer' | 'anime';

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
  connectedAt: string;
  lastSyncedAt?: string;
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
  updatedAt?: string;
}

export interface ProviderMeta {
  id: string;
  name: string;
  category: ConnectionCategory;
  description: string;
  color: string;
  supportsRichPresence: boolean;
  activityType?: 'playing' | 'listening' | 'streaming' | 'watching' | 'competing';
  urlTemplate: string;
  badgeLabel: string;
}

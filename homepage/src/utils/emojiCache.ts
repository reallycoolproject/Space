import { API_BASE } from '../config';

export interface SpaceAssetInfo {
  asset: {
    id: string;
    name: string;
    url: string;
    animated?: boolean;
    associatedEmoji?: string;
    kind: 'emoji' | 'sticker';
  };
  space: {
    id: string;
    name: string;
    icon: string;
    description: string;
    isPublic: boolean;
    isMember: boolean;
    memberCount: number;
    inviteCode?: string;
  };
}

const assetCache = new Map<string, SpaceAssetInfo>();
const inflightRequests = new Map<string, Promise<SpaceAssetInfo | null>>();

function makeKey(spaceId: string, name: string, type: 'emoji' | 'sticker'): string {
  return `${spaceId}:${name.toLowerCase()}:${type}`;
}

export function getCachedAssetInfo(spaceId: string, name: string, type: 'emoji' | 'sticker'): SpaceAssetInfo | undefined {
  return assetCache.get(makeKey(spaceId, name, type));
}

export function cacheAssetInfo(spaceId: string, name: string, type: 'emoji' | 'sticker', info: SpaceAssetInfo) {
  assetCache.set(makeKey(spaceId, name, type), info);
}

export async function fetchAssetInfo(
  spaceId: string,
  name: string,
  type: 'emoji' | 'sticker' = 'emoji',
  url?: string
): Promise<SpaceAssetInfo | null> {
  const key = makeKey(spaceId, name, type);
  if (assetCache.has(key)) return assetCache.get(key)!;
  if (inflightRequests.has(key)) return inflightRequests.get(key)!;

  const promise = (async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        spaceId,
        name,
        type,
        ...(url ? { url } : {})
      });
      const res = await fetch(`${API_BASE}/api/spaces/asset-info?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.ok && data.asset && data.space) {
        assetCache.set(key, data);
        window.dispatchEvent(new CustomEvent('space-asset-resolved', { detail: { key, info: data } }));
        return data;
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch asset info:', e);
      return null;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}

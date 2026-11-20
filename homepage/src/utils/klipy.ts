import { KLIPY_API_KEY, KLIPY_BASE_URL } from '../config/klipy';

export interface KlipyGifFileVariant {
  url: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface KlipyGifFormatGroup {
  gif?: KlipyGifFileVariant;
  webp?: KlipyGifFileVariant;
  jpg?: KlipyGifFileVariant;
  mp4?: KlipyGifFileVariant;
}

export interface KlipyGifItem {
  id: string | number;
  slug?: string;
  title: string;
  url: string; // resolved preferred GIF URL
  previewUrl: string; // smaller preview for fast masonry grid
  width?: number;
  height?: number;
}

export interface KlipyCategory {
  category: string;
  query: string;
  previewUrl: string;
}

function normalizeKlipyItem(raw: any): KlipyGifItem {
  const file = raw.file || {};
  // Preferred full GIF URL: hd.gif > md.gif > sm.gif
  const fullGifUrl = file.hd?.gif?.url || file.md?.gif?.url || file.sm?.gif?.url || raw.url || '';
  // Preferred grid preview URL: sm.gif > md.gif > hd.gif
  const previewGifUrl = file.sm?.gif?.url || file.md?.gif?.url || file.sm?.webp?.url || fullGifUrl;
  const width = file.hd?.gif?.width || file.md?.gif?.width || file.sm?.gif?.width || 320;
  const height = file.hd?.gif?.height || file.md?.gif?.height || file.sm?.gif?.height || 240;

  return {
    id: raw.id || raw.slug || Math.random().toString(36).slice(2),
    slug: raw.slug,
    title: raw.title || 'GIF',
    url: fullGifUrl,
    previewUrl: previewGifUrl,
    width,
    height
  };
}

export async function getKlipyTrendingGifs(limit = 24, page = 1): Promise<KlipyGifItem[]> {
  try {
    const res = await fetch(`${KLIPY_BASE_URL}/${KLIPY_API_KEY}/gifs/trending?limit=${limit}&page=${page}`);
    if (!res.ok) throw new Error(`Klipy trending returned ${res.status}`);
    const data = await res.json();
    const list = data?.data?.data || data?.data || [];
    return list.map(normalizeKlipyItem).filter((item: KlipyGifItem) => Boolean(item.url));
  } catch (err) {
    console.error('Failed to fetch Klipy trending GIFs:', err);
    return [];
  }
}

export async function searchKlipyGifs(query: string, limit = 24, page = 1): Promise<KlipyGifItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return getKlipyTrendingGifs(limit, page);

  try {
    const res = await fetch(`${KLIPY_BASE_URL}/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(trimmed)}&limit=${limit}&page=${page}`);
    if (!res.ok) throw new Error(`Klipy search returned ${res.status}`);
    const data = await res.json();
    const list = data?.data?.data || data?.data || [];
    return list.map(normalizeKlipyItem).filter((item: KlipyGifItem) => Boolean(item.url));
  } catch (err) {
    console.error('Failed to search Klipy GIFs:', err);
    return [];
  }
}

export async function getKlipyCategories(): Promise<KlipyCategory[]> {
  try {
    const res = await fetch(`${KLIPY_BASE_URL}/${KLIPY_API_KEY}/gifs/categories`);
    if (!res.ok) throw new Error(`Klipy categories returned ${res.status}`);
    const data = await res.json();
    const categories = data?.data?.categories || data?.data || [];
    return categories.map((cat: any) => ({
      category: cat.category || cat.name || '',
      query: cat.query || cat.category || '',
      previewUrl: cat.preview_url || cat.previewUrl || ''
    }));
  } catch (err) {
    console.error('Failed to fetch Klipy categories:', err);
    return [];
  }
}

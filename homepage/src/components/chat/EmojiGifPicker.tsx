import React, { useState, Suspense, lazy, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Smile, Star, Tag, X, Image as ImageIcon, Flame, Sparkles, Layers, Film } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { searchKlipyGifs, getKlipyTrendingGifs, getKlipyCategories, type KlipyGifItem, type KlipyCategory } from '../../utils/klipy';
import { API_BASE } from '../../config';

export interface CustomSpaceEmoji {
  id: string;
  name: string;
  url: string;
  spaceId: string;
  spaceName: string;
  spaceIcon?: string;
  spaceIsPublic?: boolean;
}

export interface CustomSpaceSticker {
  id: string;
  name: string;
  url: string;
  associatedEmoji?: string;
  spaceId: string;
  spaceName: string;
  spaceIcon?: string;
  spaceIsPublic?: boolean;
}

export interface Sticker {
  url: string;
  makerId?: string;
  makerUsername?: string;
  name?: string;
  spaceName?: string;
  spaceId?: string;
  associatedEmoji?: string;
  shared?: boolean;
}

interface EmojiGifPickerProps {
  isOpen: boolean;
  onSelectGif: (url: string) => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker?: (sticker: Sticker) => void;
  stickerMaker?: { userId: string; username: string };
  customEmojis?: CustomSpaceEmoji[];
  customStickers?: CustomSpaceSticker[];
  customAssetsError?: string;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function EmojiGifPicker({
  isOpen,
  onSelectGif,
  onSelectEmoji,
  onSelectSticker,
  stickerMaker,
  customEmojis = [],
  customStickers = [],
  customAssetsError,
  onClose,
  anchorRef
}: EmojiGifPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'stickers'>('emoji');
  const [selectedEmojiSource, setSelectedEmojiSource] = useState<string>('default'); // 'default' or spaceId
  const [selectedStickerSource, setSelectedStickerSource] = useState<string>('all'); // 'all' or spaceId

  // GIF states
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<KlipyGifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [favoriteGifs, setFavoriteGifs] = useState<string[]>([]);
  const [gifCategories, setGifCategories] = useState<string[]>(['trending', 'favorites', 'cat', 'dance', 'anime', 'lol', 'happy', 'cool']);
  const [activeGifCategory, setActiveGifCategory] = useState<string>('trending');
  const [showGifUploader, setShowGifUploader] = useState(false);
  const [customGifs, setCustomGifs] = useState<string[]>([]);
  const [gifImage, setGifImage] = useState<string | null>(null);

  // Sticker states
  const [savedStickers, setSavedStickers] = useState<Sticker[]>([]);
  const [showStickerCreator, setShowStickerCreator] = useState(false);
  const [stickerImage, setStickerImage] = useState<string | null>(null);
  const [stickerName, setStickerName] = useState('');

  const pickerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [internalEmojis, setInternalEmojis] = useState<CustomSpaceEmoji[]>([]);
  const [internalStickers, setInternalStickers] = useState<CustomSpaceSticker[]>([]);

  // Automatically fetch all available space assets if needed
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/api/spaces/assets/available`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (Array.isArray(data.emojis)) setInternalEmojis(data.emojis);
          if (Array.isArray(data.stickers)) setInternalStickers(data.stickers);
        }
      })
      .catch(() => {});
  }, []);

  const allEmojis = useMemo(() => {
    const list = [...customEmojis];
    internalEmojis.forEach(ie => {
      if (!list.some(e => e.id === ie.id || (e.name === ie.name && e.spaceId === ie.spaceId))) {
        list.push(ie);
      }
    });
    return list;
  }, [customEmojis, internalEmojis]);

  const allStickers = useMemo(() => {
    const list = [...customStickers];
    internalStickers.forEach(is => {
      if (!list.some(s => s.id === is.id || (s.name === is.name && s.spaceId === is.spaceId))) {
        list.push(is);
      }
    });
    return list;
  }, [customStickers, internalStickers]);

  // Group custom emojis by space
  const spaceEmojiGroups = useMemo(() => {
    const map = new Map<string, { spaceId: string; spaceName: string; spaceIcon?: string; emojis: CustomSpaceEmoji[] }>();
    allEmojis.forEach(emoji => {
      if (!map.has(emoji.spaceId)) {
        map.set(emoji.spaceId, {
          spaceId: emoji.spaceId,
          spaceName: emoji.spaceName,
          spaceIcon: emoji.spaceIcon,
          emojis: []
        });
      }
      map.get(emoji.spaceId)!.emojis.push(emoji);
    });
    return Array.from(map.values());
  }, [allEmojis]);

  // Group custom stickers by space
  const spaceStickerGroups = useMemo(() => {
    const map = new Map<string, { spaceId: string; spaceName: string; spaceIcon?: string; stickers: CustomSpaceSticker[] }>();
    allStickers.forEach(sticker => {
      if (!map.has(sticker.spaceId)) {
        map.set(sticker.spaceId, {
          spaceId: sticker.spaceId,
          spaceName: sticker.spaceName,
          spaceIcon: sticker.spaceIcon,
          stickers: []
        });
      }
      map.get(sticker.spaceId)!.stickers.push(sticker);
    });
    return Array.from(map.values());
  }, [allStickers]);

  // Load saved favorites and stickers
  useEffect(() => {
    const loadSaved = () => {
      // Local storage
      const localFavs = localStorage.getItem('favorite-gifs');
      if (localFavs) {
        try { setFavoriteGifs(JSON.parse(localFavs)); } catch (e) {}
      }
      const localStickers = localStorage.getItem('custom-stickers');
      if (localStickers) {
        try {
          const parsed = JSON.parse(localStickers);
          setSavedStickers(parsed.map((s: any) => typeof s === 'string' ? { url: s } : s));
        } catch (e) {}
      }
      const localCustomGifs = localStorage.getItem('custom-gifs');
      if (localCustomGifs) {
        try { setCustomGifs(JSON.parse(localCustomGifs)); } catch (e) {}
      }

      // Sync favorite GIFs from backend on initial mount
      const token = localStorage.getItem('token');
      if (token) {
        fetch(`${API_BASE}/api/auth/favorite-gifs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.ok && Array.isArray(data.favoriteGifs)) {
              setFavoriteGifs(prev => {
                const combined = Array.from(new Set([...prev, ...data.favoriteGifs]));
                localStorage.setItem('favorite-gifs', JSON.stringify(combined));
                return combined;
              });
            }
          })
          .catch(() => {});
      }
    };

    loadSaved();
    const handleFavUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setFavoriteGifs(e.detail);
        return;
      }
      try {
        const localFavs = localStorage.getItem('favorite-gifs');
        if (localFavs) setFavoriteGifs(JSON.parse(localFavs));
      } catch {}
    };
    window.addEventListener('favorite-gifs-updated', handleFavUpdated);
    window.addEventListener('saved-stickers-updated', loadSaved);
    return () => {
      window.removeEventListener('favorite-gifs-updated', handleFavUpdated);
      window.removeEventListener('saved-stickers-updated', loadSaved);
    };
  }, []);

  // Fetch Klipy categories on mount
  useEffect(() => {
    getKlipyCategories().then(cats => {
      if (cats && cats.length > 0) {
        setGifCategories(['trending', 'favorites', ...cats.slice(0, 12).map((c: KlipyCategory) => c.category)]);
      }
    });
  }, []);

  // Calculate fixed popup coordinates anchored to anchorRef
  const [coords, setCoords] = useState<{
    bottom: number;
    right?: number;
    left?: number;
    width: string;
    height: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setCoords({
          bottom: 72,
          left: 8,
          right: 8,
          width: 'calc(100vw - 16px)',
          height: `${Math.min(500, window.innerHeight - 90)}px`
        });
        return;
      }

      const pickerWidth = Math.min(500, window.innerWidth - 32);
      const pickerHeight = Math.min(540, window.innerHeight - 90);

      if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const bottomDist = Math.max(12, window.innerHeight - rect.top + 8);
        let rightDist = window.innerWidth - rect.right;
        if (rightDist < 16) rightDist = 16;
        if (window.innerWidth - rightDist - pickerWidth < 16) {
          rightDist = Math.max(16, window.innerWidth - pickerWidth - 16);
        }

        setCoords({
          bottom: bottomDist,
          right: rightDist,
          width: `${pickerWidth}px`,
          height: `${pickerHeight}px`
        });
      } else {
        setCoords({
          bottom: 72,
          right: 16,
          width: `${pickerWidth}px`,
          height: `${pickerHeight}px`
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef?.current && anchorRef.current.contains(target)) {
        return; // Clicked trigger button, let trigger toggle it
      }
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose && onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose && onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  // Load GIFs when tab is 'gif' or search/category changes
  useEffect(() => {
    if (activeTab === 'gif' && isOpen) {
      if (activeGifCategory === 'favorites') {
        return; // favorites rendered directly from state
      }
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setLoadingGifs(true);
        const query = search.trim() || (activeGifCategory !== 'trending' ? activeGifCategory : '');
        (query ? searchKlipyGifs(query, 28) : getKlipyTrendingGifs(28))
          .then(res => setGifs(res))
          .catch(e => console.error(e))
          .finally(() => setLoadingGifs(false));
      }, 350);
    }
  }, [search, activeGifCategory, activeTab, isOpen]);

  // Toggle GIF favorite
  const handleToggleFavorite = async (gifUrl: string) => {
    const isFav = favoriteGifs.includes(gifUrl);
    const updated = isFav
      ? favoriteGifs.filter(u => u !== gifUrl)
      : [gifUrl, ...favoriteGifs.filter(u => u !== gifUrl)];

    setFavoriteGifs(updated);
    localStorage.setItem('favorite-gifs', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('favorite-gifs-updated', { detail: updated }));

    // Sync with backend
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE}/api/auth/favorite-gifs`, {
          method: isFav ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: gifUrl })
        });
      }
    } catch (e) {
      console.warn('Failed to sync favorite GIF to server:', e);
    }
  };

  // Sticker save
  const handleCreateSticker = () => {
    if (stickerImage) {
      const newSticker: Sticker = {
        url: stickerImage,
        name: stickerName.trim() || 'My Sticker',
        makerId: stickerMaker?.userId,
        makerUsername: stickerMaker?.username
      };
      const updated = [...savedStickers, newSticker];
      setSavedStickers(updated);
      localStorage.setItem('custom-stickers', JSON.stringify(updated));
      window.dispatchEvent(new Event('saved-stickers-updated'));
      setStickerImage(null);
      setStickerName('');
      setShowStickerCreator(false);
    }
  };

  // Upload custom GIF
  const handleSaveCustomGif = () => {
    if (gifImage) {
      const updated = [gifImage, ...customGifs];
      setCustomGifs(updated);
      localStorage.setItem('custom-gifs', JSON.stringify(updated));
      setGifImage(null);
      setShowGifUploader(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        ref={pickerRef}
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed bg-[var(--app-panel)] border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[9999] backdrop-blur-2xl text-[var(--text-primary)]"
        style={{
          bottom: coords ? `${coords.bottom}px` : '72px',
          right: coords?.right !== undefined ? `${coords.right}px` : (coords?.left !== undefined ? 'auto' : '16px'),
          left: coords?.left !== undefined ? `${coords.left}px` : 'auto',
          width: coords?.width || 'min(94vw, 500px)',
          height: coords?.height || 'min(540px, calc(100vh - 90px))',
          background: 'linear-gradient(150deg, rgba(20, 28, 55, 0.98) 0%, rgba(12, 16, 32, 0.99) 100%)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.2)'
        }}
      >
        {/* Top Segmented Tab Switcher */}
        <div className="flex items-center px-4 pt-3 pb-2 border-b border-white/10 shrink-0 bg-white/[0.02] gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'emoji'
                ? 'bg-[var(--app-accent)] text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            Emojis
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gif')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gif'
                ? 'bg-[var(--app-accent)] text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            GIFs
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'stickers'
                ? 'bg-[var(--app-accent)] text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Stickers
          </button>
        </div>

        {/* Content Body with Discord-Style Left Navigation Rail */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* ========================================================= */}
          {/* TAB 1: EMOJIS (Discord-Style Left Rail & Twemoji)        */}
          {/* ========================================================= */}
          {activeTab === 'emoji' && (
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Discord-style Vertical Left Slider / Rail */}
              <div className="w-14 bg-black/40 border-r border-white/10 flex flex-col items-center py-2.5 gap-2 overflow-y-auto custom-scrollbar shrink-0">
                {/* Default Emojis Button */}
                <button
                  type="button"
                  title="Default Emojis"
                  onClick={() => setSelectedEmojiSource('default')}
                  className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                    selectedEmojiSource === 'default'
                      ? 'bg-[var(--app-accent)] text-white shadow-lg scale-105'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Smile className="w-5 h-5" />
                  {selectedEmojiSource === 'default' && (
                    <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-white shadow-sm" />
                  )}
                </button>

                {spaceEmojiGroups.length > 0 && <div className="w-6 h-[1px] bg-white/15 my-1" />}

                {/* Spaces with Custom Emojis */}
                {spaceEmojiGroups.map(group => {
                  const isSelected = selectedEmojiSource === group.spaceId;
                  return (
                    <button
                      key={group.spaceId}
                      type="button"
                      title={`${group.spaceName} (${group.emojis.length} emojis)`}
                      onClick={() => setSelectedEmojiSource(group.spaceId)}
                      className={`relative w-10 h-10 rounded-2xl overflow-hidden transition-all flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-[var(--app-accent)] scale-105 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {group.spaceIcon ? (
                        <img src={group.spaceIcon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          {group.spaceName[0]?.toUpperCase() || 'S'}
                        </div>
                      )}
                      {isSelected && (
                        <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-white shadow-sm" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Main Emoji View */}
              <div className="flex-1 flex flex-col min-w-0 bg-[var(--app-bg)] overflow-hidden">
                {selectedEmojiSource === 'default' ? (
                  <div className="flex-1 overflow-hidden relative">
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-white/50">Loading Emojis...</div>}>
                      <EmojiPicker
                        onEmojiClick={(emojiData: any) => onSelectEmoji(emojiData.emoji)}
                        theme={Theme.DARK}
                        emojiStyle={EmojiStyle.TWITTER}
                        width="100%"
                        height="100%"
                        searchPlaceHolder="Search standard emojis..."
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#ffffff'
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  // Custom Space Emojis Grid
                  (() => {
                    const group = spaceEmojiGroups.find(g => g.spaceId === selectedEmojiSource);
                    if (!group) return null;
                    return (
                      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {/* Space Header */}
                        <div className="p-3 border-b border-white/10 flex items-center gap-2.5 bg-white/[0.02]">
                          <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                            {group.spaceIcon ? (
                              <img src={group.spaceIcon} alt="" className="w-full h-full object-cover" />
                            ) : (
                              group.spaceName[0]?.toUpperCase()
                            )}
                          </div>
                          <span className="text-xs font-bold text-white truncate">{group.spaceName}</span>
                          <span className="text-[10px] text-white/50 font-semibold ml-auto">{group.emojis.length} emojis</span>
                        </div>

                        {/* Emojis Grid */}
                        <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar grid grid-cols-6 sm:grid-cols-7 gap-2.5 auto-rows-max">
                          {group.emojis.map(emoji => (
                            <button
                              key={`${emoji.id}-${emoji.name}`}
                              type="button"
                              title={`:${emoji.name}: · ${group.spaceName}`}
                              onClick={() => onSelectEmoji(`:sp${emoji.spaceId}_${emoji.name}:`)}
                              className="group p-1.5 rounded-xl hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center aspect-square relative"
                            >
                              <img src={emoji.url} alt={emoji.name} className="w-8 h-8 object-contain filter drop-shadow-sm group-hover:scale-115 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: KLIPY GIFS                                         */}
          {/* ========================================================= */}
          {activeTab === 'gif' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0 bg-[var(--app-bg)]">
              {/* Search Bar & Custom GIF Upload */}
              <div className="flex items-center gap-2 mb-2.5 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search GIFs..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[var(--app-accent)] transition-all font-medium"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowGifUploader(true)}
                  title="Upload custom GIF"
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Categories Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 custom-scrollbar shrink-0">
                {gifCategories.map(cat => {
                  const isFavTab = cat === 'favorites';
                  const isActive = activeGifCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveGifCategory(cat);
                        setSearch('');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap capitalize transition-all flex items-center gap-1 ${
                        isActive
                          ? isFavTab
                            ? 'bg-yellow-500 text-black shadow-md'
                            : 'bg-[var(--app-accent)] text-white shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                      }`}
                    >
                      {isFavTab ? <Star className="w-3 h-3 fill-current" /> : null}
                      {cat === 'trending' ? '🔥 Trending' : cat === 'favorites' ? `Favorites (${favoriteGifs.length})` : cat}
                    </button>
                  );
                })}
              </div>

              {/* Favorites Quick Row (when not on favorites tab) */}
              {activeGifCategory !== 'favorites' && favoriteGifs.length > 0 && !search && (
                <div className="mb-2 shrink-0">
                  <div className="flex items-center justify-between text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-3 h-3 fill-current" /> Starred Favorites
                    </span>
                    <button
                      onClick={() => setActiveGifCategory('favorites')}
                      className="text-[10px] text-white/50 hover:text-white"
                    >
                      View all ({favoriteGifs.length})
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                    {favoriteGifs.slice(0, 8).map((url, i) => (
                      <div
                        key={`fav-strip-${i}`}
                        className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 group cursor-pointer border border-white/15 hover:border-yellow-400"
                        onClick={() => {
                          onSelectGif(url);
                          onClose && onClose();
                        }}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleFavorite(url);
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-yellow-400 flex items-center justify-center text-[10px]"
                        >
                          ★
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main GIF Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-0.5 min-h-0">
                {activeGifCategory === 'favorites' ? (
                  favoriteGifs.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {favoriteGifs.map((url, index) => (
                        <div
                          key={`fav-grid-${index}`}
                          onClick={() => {
                            onSelectGif(url);
                            onClose && onClose();
                          }}
                          className="relative rounded-xl overflow-hidden group cursor-pointer aspect-video bg-black/40 border border-white/10 hover:border-yellow-400 transition-all"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleFavorite(url);
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-yellow-400 hover:text-white flex items-center justify-center text-xs shadow-md transition-colors"
                            title="Remove from favorites"
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-white/50">
                      <Star className="w-8 h-8 text-yellow-400/50 mb-2" />
                      <p className="text-xs font-bold text-white/80">No Favorite GIFs Yet</p>
                      <p className="text-[11px] text-white/50 mt-1 max-w-[240px]">
                        Click the star on any GIF in chat or here to save your favorites!
                      </p>
                    </div>
                  )
                ) : loadingGifs ? (
                  <div className="h-full flex items-center justify-center text-xs text-white/50 py-12">
                    Loading GIFs...
                  </div>
                ) : gifs.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {gifs.map(gif => {
                      const isFavorited = favoriteGifs.includes(gif.url);
                      return (
                        <div
                          key={gif.id}
                          onClick={() => {
                            onSelectGif(gif.url);
                            onClose && onClose();
                          }}
                          className="relative rounded-xl overflow-hidden group cursor-pointer aspect-video bg-black/40 border border-white/10 hover:border-[var(--app-accent)] transition-all"
                        >
                          <img
                            src={gif.previewUrl || gif.url}
                            alt={gif.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleFavorite(gif.url);
                            }}
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all shadow-md ${
                              isFavorited
                                ? 'bg-yellow-500 text-black opacity-100 scale-105'
                                : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'
                            }`}
                            title={isFavorited ? 'Remove from favorites' : 'Star to favorites'}
                          >
                            {isFavorited ? '★' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-white/50 py-12">
                    No GIFs found for "{search}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: STICKERS (Discord-Style Space Rail)                */}
          {/* ========================================================= */}
          {activeTab === 'stickers' && (
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Rail for Stickers */}
              <div className="w-14 bg-black/40 border-r border-white/10 flex flex-col items-center py-2.5 gap-2 overflow-y-auto custom-scrollbar shrink-0">
                <button
                  type="button"
                  title="All Stickers"
                  onClick={() => setSelectedStickerSource('all')}
                  className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                    selectedStickerSource === 'all'
                      ? 'bg-[var(--app-accent)] text-white shadow-lg scale-105'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Tag className="w-5 h-5" />
                  {selectedStickerSource === 'all' && (
                    <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-white shadow-sm" />
                  )}
                </button>

                {spaceStickerGroups.length > 0 && <div className="w-6 h-[1px] bg-white/15 my-1" />}

                {spaceStickerGroups.map(group => {
                  const isSelected = selectedStickerSource === group.spaceId;
                  return (
                    <button
                      key={group.spaceId}
                      type="button"
                      title={`${group.spaceName} (${group.stickers.length} stickers)`}
                      onClick={() => setSelectedStickerSource(group.spaceId)}
                      className={`relative w-10 h-10 rounded-2xl overflow-hidden transition-all flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-[var(--app-accent)] scale-105 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {group.spaceIcon ? (
                        <img src={group.spaceIcon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                          {group.spaceName[0]?.toUpperCase() || 'S'}
                        </div>
                      )}
                      {isSelected && (
                        <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-white shadow-sm" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Stickers Grid */}
              <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0 bg-[var(--app-bg)]">
                <div className="flex items-center justify-between mb-2.5 shrink-0">
                  <span className="text-xs font-bold text-white/70">
                    {selectedStickerSource === 'all' ? 'All Stickers' : spaceStickerGroups.find(g => g.spaceId === selectedStickerSource)?.spaceName}
                  </span>
                  <button
                    onClick={() => setShowStickerCreator(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--app-accent)] text-white text-[11px] font-bold hover:brightness-110 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Create
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-3 gap-2.5 auto-rows-max">
                  {(() => {
                    const displayed = selectedStickerSource === 'all'
                      ? [
                          ...customStickers.map(s => ({ ...s, shared: true })),
                          ...savedStickers.map((s, idx) => ({ ...s, id: `saved-${idx}`, name: s.name || `Sticker ${idx + 1}`, shared: false }))
                        ]
                      : customStickers.filter(s => s.spaceId === selectedStickerSource).map(s => ({ ...s, shared: true }));

                    if (displayed.length === 0) {
                      return (
                        <div className="col-span-3 text-center py-12 text-xs text-white/50">
                          No stickers in this space yet. Click "Create" to add one!
                        </div>
                      );
                    }

                    return displayed.map((sticker, i) => (
                      <div
                        key={sticker.id || `stk-${i}`}
                        className="group relative aspect-square p-2 rounded-2xl bg-black/30 border border-white/10 hover:border-[var(--app-accent)] cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
                        onClick={() => {
                          onSelectSticker && onSelectSticker(sticker);
                          onClose && onClose();
                        }}
                      >
                        <img
                          src={sticker.url}
                          alt={sticker.name}
                          className="max-w-full max-h-full object-contain filter drop-shadow-md"
                        />
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticker Creator Modal Overlay */}
        {showStickerCreator && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col p-5">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white">Create Custom Sticker</h4>
              <button onClick={() => setShowStickerCreator(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              {stickerImage ? (
                <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/20 bg-black/40 p-2 flex items-center justify-center">
                  <img src={stickerImage} alt="" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <label className="w-full h-36 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[var(--app-accent)] transition-colors">
                  <Plus className="w-7 h-7 text-white/40 mb-1" />
                  <span className="text-xs text-white/60">Upload sticker image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = () => setStickerImage(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }} />
                </label>
              )}
              {stickerImage && (
                <input
                  type="text"
                  value={stickerName}
                  onChange={e => setStickerName(e.target.value)}
                  placeholder="Sticker name (e.g. wow_cat)"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white outline-none focus:border-[var(--app-accent)]"
                />
              )}
            </div>
            {stickerImage && (
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={handleCreateSticker}
                  className="flex-1 py-2 rounded-xl bg-[var(--app-accent)] text-white text-xs font-bold"
                >
                  Save Sticker
                </button>
                <button
                  onClick={() => setStickerImage(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white/80 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Custom GIF Uploader Modal Overlay */}
        {showGifUploader && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col p-5">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white">Upload Custom GIF</h4>
              <button onClick={() => setShowGifUploader(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              {gifImage ? (
                <div className="w-48 h-32 rounded-2xl overflow-hidden border border-white/20 bg-black/40 p-2 flex items-center justify-center">
                  <img src={gifImage} alt="" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <label className="w-full h-36 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[var(--app-accent)] transition-colors">
                  <Plus className="w-7 h-7 text-white/40 mb-1" />
                  <span className="text-xs text-white/60">Upload .gif file</span>
                  <input type="file" accept="image/gif" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onloadend = () => setGifImage(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }} />
                </label>
              )}
            </div>
            {gifImage && (
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={handleSaveCustomGif}
                  className="flex-1 py-2 rounded-xl bg-[var(--app-accent)] text-white text-xs font-bold"
                >
                  Save GIF
                </button>
                <button
                  onClick={() => setGifImage(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white/80 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

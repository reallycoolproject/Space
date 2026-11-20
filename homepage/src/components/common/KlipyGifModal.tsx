import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Sparkles, Check, Loader2, Film } from 'lucide-react';
import { searchKlipyGifs, getKlipyTrendingGifs, getKlipyCategories, type KlipyGifItem, type KlipyCategory } from '../../utils/klipy';

interface KlipyGifModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
  title?: string;
}

const DEFAULT_CATEGORIES = [
  'trending', 'anime', 'cat', 'dance', 'happy', 'cool', 'cyber', 'synthwave', 'lol', 'vibing'
];

export function KlipyGifModal({
  isOpen,
  onClose,
  onSelectGif,
  title = 'Choose Animated GIF'
}: KlipyGifModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<KlipyGifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<KlipyGifItem | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string>('trending');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedGif(null);
      setSearchQuery('');
      setActiveCategory('trending');
      return;
    }

    // Load categories
    getKlipyCategories().then(cats => {
      if (cats && cats.length > 0) {
        setCategories(['trending', ...cats.slice(0, 15).map((c: KlipyCategory) => c.category)]);
      }
    });

    // Load initial trending
    loadGifs('');
  }, [isOpen]);

  const loadGifs = async (query: string) => {
    setLoading(true);
    try {
      const results = query.trim()
        ? await searchKlipyGifs(query, 30)
        : await getKlipyTrendingGifs(30);
      setGifs(results);
    } catch (e) {
      console.error('Failed to load Klipy GIFs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setActiveCategory('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadGifs(val);
    }, 400);
  };

  const handleSelectCategory = (cat: string) => {
    setActiveCategory(cat);
    setSearchQuery('');
    if (cat === 'trending') {
      loadGifs('');
    } else {
      loadGifs(cat);
    }
  };

  const handleConfirm = () => {
    if (selectedGif) {
      onSelectGif(selectedGif.url);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="w-full max-w-2xl h-[min(88dvh,680px)] rounded-3xl overflow-hidden border border-white/20 bg-[var(--app-panel)] shadow-2xl flex flex-col text-[var(--text-primary)]"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(150deg, rgba(20, 28, 55, 0.97) 0%, rgba(10, 14, 28, 0.99) 100%)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shadow-md">
                <Film className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{title}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Categories */}
          <div className="p-4 border-b border-white/10 shrink-0 flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search millions of GIFs..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/40 border border-white/15 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[var(--app-accent)] transition-all font-medium"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                    activeCategory === cat
                      ? 'bg-[var(--app-accent)] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* GIF Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-white/60 gap-3 py-16">
                <Loader2 className="w-7 h-7 animate-spin text-[var(--app-accent)]" />
                <span className="text-sm font-medium">Fetching GIFs...</span>
              </div>
            ) : gifs.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {gifs.map(gif => {
                  const isSelected = selectedGif?.id === gif.id;
                  return (
                    <motion.div
                      key={gif.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedGif(gif)}
                      className={`relative rounded-2xl overflow-hidden cursor-pointer group aspect-square bg-black/30 border transition-all ${
                        isSelected
                          ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)] shadow-lg'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img
                        src={gif.previewUrl || gif.url}
                        alt={gif.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${
                        isSelected ? 'opacity-100 bg-[var(--app-accent)]/20' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {isSelected && (
                          <div className="w-8 h-8 rounded-full bg-[var(--app-accent)] text-white flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/50 py-16">
                <p className="text-sm font-medium">No GIFs found for "{searchQuery}"</p>
                <p className="text-xs text-white/40 mt-1">Try another search term or click a category above.</p>
              </div>
            )}
          </div>

          {/* Footer Preview / Selection Bar */}
          <div className="p-4 border-t border-white/10 shrink-0 bg-white/[0.03] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {selectedGif ? (
                <>
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-[var(--app-accent)] shadow-md">
                    <img src={selectedGif.url} alt="Selected preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{selectedGif.title}</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">Ready to set as avatar</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-white/50">Click on any GIF above to select it.</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedGif}
                className="px-5 py-2.5 rounded-xl bg-[var(--app-accent)] hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed frutiger-btn frutiger-btn-primary flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Select GIF
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

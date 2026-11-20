import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Video, FileText, Download, Search, Filter } from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name?: string;
  size?: string;
  timestamp: Date;
}

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
}

export function MediaGalleryModal({ isOpen, onClose, mediaItems }: MediaGalleryModalProps) {
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'files'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredItems = mediaItems.filter(item => {
    const matchesFilter = filter === 'all' || 
      (filter === 'images' && item.type === 'image') ||
      (filter === 'videos' && item.type === 'video') ||
      (filter === 'files' && item.type === 'file');
    
    const matchesSearch = !searchQuery || 
      (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl h-[80vh] bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-[var(--app-border)] flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Georgia, serif' }}>Shared Media</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b-2 border-[var(--app-border)] flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-[var(--bg-input)] border border-[var(--app-border)] text-[var(--text-input)] placeholder-[var(--text-secondary)] pl-10 pr-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[var(--app-accent)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'images', 'videos', 'files'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                  filter === tab 
                    ? 'frutiger-btn frutiger-btn-primary text-white' 
                    : 'frutiger-btn frutiger-btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
              <Filter className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-base">No media found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative aspect-square bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg overflow-hidden hover:border-[var(--app-accent)] transition-colors cursor-pointer"
                >
                  {item.type === 'image' ? (
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                  ) : item.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--app-panel)]">
                      <Video className="w-8 h-8 text-[var(--text-secondary)]" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--app-panel)] p-4">
                      <FileText className="w-8 h-8 text-[var(--text-secondary)] mb-2" />
                      <p className="text-xs text-[var(--text-secondary)] text-center truncate w-full">{item.name}</p>
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={item.url}
                      download={item.name}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>

                  {/* Timestamp */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs text-white/70">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[var(--app-border)] flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>{filteredItems.length} items</span>
          <span>Total storage: {mediaItems.reduce((acc, item) => acc + (parseFloat(item.size || '0') || 0), 0).toFixed(2)} MB</span>
        </div>
      </motion.div>
    </div>
  );
}

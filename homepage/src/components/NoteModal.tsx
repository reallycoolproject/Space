import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Smile, Clock } from 'lucide-react';
import { searchTracks, type SpotifyTrack } from '../utils/spotify';

export interface NoteData {
  text: string;
  song?: SpotifyTrack;
  gif?: string;
  duration: '1day' | '3days' | '1week' | 'manual';
  expiresAt?: Date;
}

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: NoteData) => void;
  existingNote?: NoteData;
}

export function NoteModal({ isOpen, onClose, onSave, existingNote }: NoteModalProps) {
  const [text, setText] = useState(existingNote?.text || '');
  const [song, setSong] = useState<SpotifyTrack | undefined>(existingNote?.song);
  const [gif, setGif] = useState<string | undefined>(existingNote?.gif);
  const [duration, setDuration] = useState<'1day' | '3days' | '1week' | 'manual'>(
    existingNote?.duration || '1day'
  );
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<SpotifyTrack[]>([]);
  const [searchingSongs, setSearchingSongs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText(existingNote?.text || '');
      setSong(existingNote?.song);
      setGif(existingNote?.gif);
      setDuration(existingNote?.duration || '1day');
    }
  }, [isOpen, existingNote]);

  const handleSearchSongs = async () => {
    if (!songQuery.trim()) return;
    
    setSearchingSongs(true);
    try {
      const results = await searchTracks(songQuery, 8);
      setSongResults(results);
    } catch (error) {
      console.error('Error searching songs:', error);
    } finally {
      setSearchingSongs(false);
    }
  };

  const handleSelectSong = (track: SpotifyTrack) => {
    setSong(track);
    setShowSongSearch(false);
    setSongQuery('');
    setSongResults([]);
  };

  const handleSave = () => {
    if (!text.trim() && !song && !gif) return;

    const expiresAt = duration === 'manual' ? undefined : calculateExpiry(duration);
    
    onSave({
      text: text.trim(),
      song,
      gif,
      duration,
      expiresAt
    });
    
    onClose();
  };

  const calculateExpiry = (duration: '1day' | '3days' | '1week'): Date => {
    const now = new Date();
    switch (duration) {
      case '1day':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '3days':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      case '1week':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      default:
        return now;
    }
  };

  const canSave = (text.trim() && !song && !gif) || (song && !text.trim() && !gif) || (gif && !text.trim() && !song);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-lg bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b-2 border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Georgia, serif' }}>
              {existingNote ? 'Edit Note' : 'Create Note'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--app-surface-hover)] hover:bg-[var(--app-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col gap-4">
            {/* Text Input */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={150}
              className="w-full bg-[var(--app-surface)] border-2 border-[var(--app-border)] rounded-2xl p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20 transition-all resize-none"
              rows={3}
            />

            {/* Character Count */}
            <div className="text-right text-xs text-[var(--text-secondary)]">
              {text.length}/150
            </div>

            {/* Media Options */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (song) {
                    setSong(undefined);
                  } else {
                    setShowSongSearch(true);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium transition-colors ${
                  song
                    ? 'bg-[var(--app-accent)] text-white'
                    : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Music className="w-5 h-5" />
                {song ? 'Song Added' : 'Add Song'}
              </button>
              
              <button
                onClick={() => {
                  if (gif) {
                    setGif(undefined);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium transition-colors ${
                  gif
                    ? 'bg-[var(--app-accent)] text-white'
                    : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Smile className="w-5 h-5" />
                {gif ? 'GIF Added' : 'Add GIF'}
              </button>
            </div>

            {/* Song Search */}
            {showSongSearch && (
              <div className="bg-[var(--app-surface)] rounded-2xl p-4 border-2 border-[var(--app-border)]">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchSongs();
                    }}
                    placeholder="Search for a song..."
                    className="flex-1 bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-xl px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)]"
                  />
                  <button
                    onClick={handleSearchSongs}
                    disabled={searchingSongs}
                    className="px-4 py-2 bg-[var(--app-accent)] text-white rounded-xl font-medium hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
                  >
                    {searchingSongs ? '...' : 'Search'}
                  </button>
                </div>
                
                {songResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                    {songResults.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => handleSelectSong(track)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--app-surface-hover)] cursor-pointer transition-colors"
                      >
                        {track.album.images[0] && (
                          <img
                            src={track.album.images[0].url}
                            alt={track.album.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--text-primary)] truncate">{track.name}</div>
                          <div className="text-sm text-[var(--text-secondary)] truncate">
                            {track.artists.map(a => a.name).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Song */}
            {song && (
              <div className="bg-[var(--app-surface)] rounded-2xl p-4 border-2 border-[var(--app-border)] flex items-center gap-3">
                {song.album.images[0] && (
                  <img
                    src={song.album.images[0].url}
                    alt={song.album.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] truncate">{song.name}</div>
                  <div className="text-sm text-[var(--text-secondary)] truncate">
                    {song.artists.map(a => a.name).join(', ')}
                  </div>
                </div>
                <button
                  onClick={() => setSong(undefined)}
                  className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Selected GIF */}
            {gif && (
              <div className="bg-[var(--app-surface)] rounded-2xl p-4 border-2 border-[var(--app-border)] relative">
                <img src={gif} alt="Selected GIF" className="w-full h-32 object-cover rounded-xl" />
                <button
                  onClick={() => setGif(undefined)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Duration Selection */}
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
              <div className="flex-1 flex gap-2">
                {[
                  { value: '1day', label: '1 Day' },
                  { value: '3days', label: '3 Days' },
                  { value: '1week', label: '1 Week' },
                  { value: 'manual', label: 'Manual' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDuration(option.value as any)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      duration === option.value
                        ? 'frutiger-btn frutiger-btn-primary text-white'
                        : 'frutiger-btn frutiger-btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t-2 border-[var(--app-border)] bg-[var(--app-surface)]">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="w-full px-6 py-3.5 rounded-2xl font-bold text-white frutiger-btn frutiger-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

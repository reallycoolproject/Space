import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Smile, Clock, X } from 'lucide-react';
import { NoteModal, type NoteData } from './NoteModal';

interface FloatingNoteProps {
  note: NoteData | null;
  isOwnProfile: boolean;
  onEdit: (note: NoteData) => void;
  onDelete: () => void;
}

export function FloatingNote({ note, isOwnProfile, onEdit, onDelete }: FloatingNoteProps) {
  const [showModal, setShowModal] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);

  if (!note) return null;

  const isExpired = note.expiresAt && new Date() > note.expiresAt;
  if (isExpired) return null;

  const getTimeRemaining = () => {
    if (!note.expiresAt || note.duration === 'manual') return null;
    
    const now = new Date();
    const diff = note.expiresAt.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return '1h';
  };

  const timeRemaining = getTimeRemaining();

  return (
    <>
      <div
        className="relative cursor-pointer hover:scale-105 transition-transform"
        onClick={() => setShowExpanded(!showExpanded)}
      >
        {/* Note Icon */}
        <div className="w-12 h-12 rounded-full bg-[var(--app-accent)] flex items-center justify-center shadow-lg shadow-[var(--app-accent)]/30">
          {note.song ? (
            <Music className="w-6 h-6 text-white" />
          ) : note.gif ? (
            <Smile className="w-6 h-6 text-white" />
          ) : (
            <Clock className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Time Remaining Badge */}
        {timeRemaining && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--app-surface)] border-2 border-[var(--app-border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
            {timeRemaining}
          </div>
        )}

        {/* Edit/Delete for own profile */}
        {isOwnProfile && (
          <div className="absolute -top-1 -right-1 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              className="w-5 h-5 rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center hover:bg-[var(--app-surface-hover)] transition-colors"
            >
              <Clock className="w-3 h-3 text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
            >
              <X className="w-3 h-3 text-red-500" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded Note View */}
      <AnimatePresence>
        {showExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-14 left-0 w-72 bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Song Info */}
            {note.song && (
              <div className="p-4 border-b border-[var(--app-border)]">
                <div className="flex items-center gap-3">
                  {note.song.album.images[0] && (
                    <img
                      src={note.song.album.images[0].url}
                      alt={note.song.album.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--text-primary)] truncate">{note.song.name}</div>
                    <div className="text-sm text-[var(--text-secondary)] truncate">
                      {note.song.artists.map(a => a.name).join(', ')}
                    </div>
                  </div>
                </div>
                {note.song.preview_url && (
                  <audio
                    controls
                    src={note.song.preview_url}
                    className="w-full mt-3 h-8"
                  />
                )}
              </div>
            )}

            {/* GIF */}
            {note.gif && (
              <div className="border-b border-[var(--app-border)]">
                <img src={note.gif} alt="Note GIF" className="w-full h-48 object-cover" />
              </div>
            )}

            {/* Text */}
            {note.text && (
              <div className="p-4">
                <p className="text-[var(--text-primary)] text-center font-medium">{note.text}</p>
              </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>
                  {note.duration === 'manual' ? 'Manual' : `Expires in ${timeRemaining}`}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExpanded(false);
                }}
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <NoteModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={onEdit}
        existingNote={note}
      />
    </>
  );
}

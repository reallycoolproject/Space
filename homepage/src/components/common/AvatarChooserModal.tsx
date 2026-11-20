import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Film, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { KlipyGifModal } from './KlipyGifModal';

interface AvatarChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onUploadFile: () => void;
  onSelectKlipyGif: (url: string) => void;
  onRemoveAvatar?: () => void;
}

export function AvatarChooserModal({
  isOpen,
  onClose,
  currentAvatar,
  onUploadFile,
  onSelectKlipyGif,
  onRemoveAvatar
}: AvatarChooserModalProps) {
  const [showKlipyModal, setShowKlipyModal] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div 
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            className="w-full max-w-md rounded-3xl overflow-hidden border border-white/20 bg-[var(--app-panel)] shadow-2xl p-6 relative flex flex-col text-[var(--text-primary)]"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(150deg, rgba(22, 33, 62, 0.96) 0%, rgba(12, 17, 32, 0.98) 100%)',
              boxShadow: '0 30px 70px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.25)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Change Profile Picture</h3>
                <p className="text-xs text-white/60">Choose how you would like to set your avatar</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              {/* Option 1: Upload from Device */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUploadFile();
                }}
                className="p-4 rounded-2xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-[var(--app-accent)] transition-all flex items-center gap-4 text-left group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white group-hover:text-[var(--app-accent)] transition-colors">
                    Upload Picture or GIF
                  </h4>
                  <p className="text-xs text-white/60 mt-0.5">
                    Choose from your computer with crop, position & zoom adjustment
                  </p>
                </div>
              </button>

              {/* Option 2: Search Animated GIFs */}
              <button
                type="button"
                onClick={() => setShowKlipyModal(true)}
                className="p-4 rounded-2xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-[var(--app-accent)] transition-all flex items-center gap-4 text-left group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--app-accent)] flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Film className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-white group-hover:text-[var(--app-accent)] transition-colors">
                      Search Animated GIFs
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--app-accent)]/20 text-[var(--app-accent)] border border-[var(--app-accent)]/30">
                      GIF
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-0.5">
                    Search trending animated GIFs and pick your favorite
                  </p>
                </div>
              </button>
            </div>

            {/* Remove Avatar Option */}
            {currentAvatar && onRemoveAvatar && (
              <button
                type="button"
                onClick={() => {
                  onRemoveAvatar();
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Current Avatar
              </button>
            )}
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Nested GIF Modal */}
      <KlipyGifModal
        isOpen={showKlipyModal}
        onClose={() => setShowKlipyModal(false)}
        title="Search Animated GIFs for Profile Picture"
        onSelectGif={(url) => {
          onSelectKlipyGif(url);
          setShowKlipyModal(false);
          onClose();
        }}
      />
    </>
  );
}

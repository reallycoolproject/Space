import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, CornerUpRight, MoreVertical, Link } from 'lucide-react';
import { useState } from 'react';
import type { Message } from '../../types/chat';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  message: Message;
  onForward: () => void;
  onJumpToMessage: () => void;
}

export function ImagePreviewModal({ isOpen, onClose, imageUrl, message, onForward, onJumpToMessage }: ImagePreviewModalProps) {
  const [showOptions, setShowOptions] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `image_${message.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowOptions(false);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Shared Image',
          url: imageUrl
        });
      }
    } catch (e) {
      console.warn('Share not supported', e);
    }
    setShowOptions(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          onClick={onClose}
        />
        
        {/* Controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-primary)] flex items-center justify-center transition-colors shadow-lg backdrop-blur-md border-2 border-[var(--app-border)]">
            <X className="w-6 h-6" />
          </button>

          <div className="relative">
            <button onClick={() => setShowOptions(!showOptions)} className="w-12 h-12 rounded-full bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-primary)] flex items-center justify-center transition-colors shadow-lg backdrop-blur-md border-2 border-[var(--app-border)]">
              <MoreVertical className="w-6 h-6" />
            </button>

            <AnimatePresence>
              {showOptions && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: -10 }} 
                  className="absolute right-0 mt-2 w-48 bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-2xl shadow-2xl py-1 overflow-hidden"
                >
                  <button onClick={handleDownload} className="w-full px-4 py-3 text-left text-base text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] flex items-center gap-3 transition-colors">
                    <Download className="w-5 h-5" /> Download
                  </button>
                  <button onClick={() => { onForward(); setShowOptions(false); }} className="w-full px-4 py-3 text-left text-base text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] flex items-center gap-3 transition-colors">
                    <CornerUpRight className="w-5 h-5" /> Forward
                  </button>
                  <button onClick={handleShare} className="w-full px-4 py-3 text-left text-base text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] flex items-center gap-3 transition-colors">
                    <Share2 className="w-5 h-5" /> Share
                  </button>
                  <div className="h-px w-full bg-[var(--app-border)] my-1"></div>
                  <button onClick={() => { onJumpToMessage(); onClose(); setShowOptions(false); }} className="w-full px-3 py-2.5 text-left text-sm text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10 flex items-center gap-3 transition-colors">
                    <Link className="w-5 h-5" /> Jump to Message
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.9, y: 20 }} 
          className="relative z-0 max-w-full max-h-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-2 border-[var(--app-border)] bg-[var(--app-panel)]"
        >
          <img src={imageUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

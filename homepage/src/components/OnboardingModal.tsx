import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Fingerprint, Lock, User, Upload, Sparkles } from 'lucide-react';
import { AvatarChooserModal } from './common/AvatarChooserModal';

interface OnboardingModalProps {
  isOpen?: boolean;
  onComplete: (displayName: string, avatar?: string) => Promise<void>;
}

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSubmitting(true);
    try {
      await onComplete(displayName.trim(), avatar || undefined);
    } catch (error) {
      console.error('Onboarding failed:', error);
      setIsSubmitting(false);
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 }
    },
    exit: { opacity: 0, scale: 0.95, y: -20 }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-lg bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b-2 border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--app-accent)]" />
              <span className="text-sm font-bold tracking-widest text-[var(--app-accent)] uppercase" style={{ fontFamily: 'Georgia, serif' }}>Profile Setup</span>
            </div>
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-[var(--text-primary)]" style={{ fontFamily: 'Georgia, serif' }}>
            What should we call you?
          </h2>
          <p className="text-[var(--text-secondary)] mt-2 text-base font-medium">
            This is how other users will see you in chats.
          </p>
        </div>

        {/* Content Area */}
        <div className="p-8 relative overflow-hidden bg-[var(--app-panel)]">
          <div className="flex flex-col gap-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Fingerprint className="w-5 h-5 text-[var(--text-secondary)] group-focus-within:text-[var(--app-accent)] transition-colors" />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[var(--app-surface)] border-2 border-[var(--app-border)] pl-12 pr-4 py-4 rounded-2xl text-[var(--text-primary)] font-bold text-lg placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20 transition-all shadow-sm"
                placeholder="e.g. Alex"
                maxLength={32}
                autoFocus
              />
            </div>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center gap-4">
              <motion.div 
                onClick={() => setShowAvatarChooser(true)}
                className="w-24 h-24 rounded-full overflow-hidden border-4 border-[var(--app-border)] shadow-xl bg-[var(--app-surface)] flex items-center justify-center cursor-pointer hover:border-[var(--app-accent)] transition-all relative group"
              >
                {avatar ? (
                  <img src={avatar} alt="Selected" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-[var(--text-secondary)]" style={{ fontFamily: 'Georgia, serif' }}>
                    {displayName[0]?.toUpperCase() || '?'}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center text-white text-xs font-bold">
                  Change
                </div>
              </motion.div>
              
              <input
                type="file"
                accept="image/*,image/gif,.gif"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarChooser(true)}
                  className="px-4 py-2 frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-[var(--app-accent)]" />
                  Choose Avatar (Upload / Search GIFs)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-base text-[var(--text-secondary)]">
                <Lock className="w-4 h-4 text-[var(--app-accent)]" />
                <span>Display name is separate from your @username.</span>
              </div>
              <div className="flex items-center gap-3 text-base text-[var(--text-secondary)]">
                <User className="w-4 h-4 text-[var(--app-accent)]" />
                <span>Visible to everyone you chat with.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t-2 border-[var(--app-border)] bg-[var(--app-surface)]">
          <form onSubmit={handleSubmit}>
            <button
              type="submit"
              disabled={!displayName.trim() || isSubmitting}
              className="w-full px-6 py-3.5 rounded-2xl font-bold text-white frutiger-btn frutiger-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? (
                <span>Setting up your profile...</span>
              ) : (
                <>
                  Complete Setup
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <AvatarChooserModal
        isOpen={showAvatarChooser}
        onClose={() => setShowAvatarChooser(false)}
        currentAvatar={avatar || undefined}
        onUploadFile={() => fileInputRef.current?.click()}
        onSelectKlipyGif={(url) => setAvatar(url)}
        onRemoveAvatar={() => setAvatar(null)}
      />
    </div>
  );
};

export default OnboardingModal;

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Globe, Users, Check, Sparkles, Plus } from 'lucide-react';
import { API_BASE } from '../../config';

export interface EmojiStickerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    name: string;
    url: string;
    kind: 'emoji' | 'sticker';
    animated?: boolean;
    associatedEmoji?: string;
    maker?: { userId?: string; username?: string };
  };
  space?: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    isPublic: boolean;
    isMember?: boolean;
    memberCount?: number;
    inviteCode?: string;
  } | null;
  onJoinSuccess?: (spaceId: string) => void;
  onSaveSticker?: (url: string, maker?: { userId?: string; username?: string }) => void;
}

export function EmojiStickerInfoModal({
  isOpen,
  onClose,
  asset,
  space,
  onJoinSuccess,
  onSaveSticker
}: EmojiStickerInfoModalProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(space?.isMember || false);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSticker, setSavedSticker] = useState(false);

  if (!isOpen) return null;

  const handleJoinSpace = async () => {
    if (!space?.id || isJoining || joined) return;
    setIsJoining(true);
    setJoinError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${space.id}/join-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setJoined(true);
        window.dispatchEvent(new CustomEvent('space-joined', { detail: { spaceId: space.id } }));
        window.dispatchEvent(new Event('spaces-updated'));
        if (onJoinSuccess) onJoinSuccess(space.id);
      } else {
        setJoinError(data.message || 'Could not join this Space');
      }
    } catch (e: any) {
      setJoinError(e.message || 'Network error joining Space');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyName = () => {
    navigator.clipboard.writeText(`:${asset.name}:`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSaveSticker && asset.url) {
      onSaveSticker(asset.url, asset.maker);
      setSavedSticker(true);
      setTimeout(() => setSavedSticker(false), 2000);
    }
  };

  const isPublicSpace = space?.isPublic ?? false;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/20 bg-[var(--app-panel)] shadow-2xl relative flex flex-col text-[var(--text-primary)]"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(145deg, rgba(22, 33, 62, 0.95) 0%, rgba(15, 20, 35, 0.98) 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}
        >
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.04]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--app-accent)]" />
              <span className="text-xs font-bold tracking-wider uppercase text-white/80">
                {asset.kind === 'sticker' ? 'Custom Sticker' : 'Custom Emoji'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Asset Preview Section */}
          <div className="p-6 flex flex-col items-center justify-center text-center bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="relative mb-3 group">
              <div className="w-24 h-24 rounded-2xl bg-black/40 border border-white/15 p-2 flex items-center justify-center shadow-inner overflow-hidden">
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="max-w-full max-h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-1.5">
              <span>:{asset.name}:</span>
            </h3>

            <button
              onClick={handleCopyName}
              className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1"
            >
              {copied ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Copied :{asset.name}:
                </span>
              ) : (
                <span>Click to copy name</span>
              )}
            </button>
          </div>

          {/* Space Source Information Card */}
          <div className="px-6 pb-6 flex flex-col gap-3">
            {space ? (
              <div className="p-4 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-sm flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[var(--app-accent)] to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md border border-white/20">
                    {space.icon ? (
                      <img src={space.icon} alt={space.name} className="w-full h-full object-cover" />
                    ) : (
                      space.name[0]?.toUpperCase() || 'S'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{space.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isPublicSpace ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <Globe className="w-3 h-3" /> Public Space
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Lock className="w-3 h-3" /> Private / Invite Only
                        </span>
                      )}
                      {space.memberCount !== undefined && (
                        <span className="text-[11px] text-white/50 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {space.memberCount} members
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {space.description && (
                  <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                    {space.description}
                  </p>
                )}

                {/* Status or Join Action */}
                {isPublicSpace ? (
                  <div>
                    {joined ? (
                      <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        You are a member of this space
                      </div>
                    ) : (
                      <button
                        onClick={handleJoinSpace}
                        disabled={isJoining}
                        className="w-full py-2.5 rounded-xl bg-[var(--app-accent)] hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 frutiger-btn frutiger-btn-primary"
                      >
                        {isJoining ? 'Joining Space...' : 'Join this space'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>This {asset.kind} is from a space that's private / invite only</span>
                  </div>
                )}

                {joinError && (
                  <p className="text-xs text-red-400 text-center font-medium">{joinError}</p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/60 text-center">
                Space details are currently unavailable
              </div>
            )}

            {/* Sticker Save Option */}
            {asset.kind === 'sticker' && onSaveSticker && (
              <button
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {savedSticker ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved to Stickers
                  </span>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Save Sticker
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

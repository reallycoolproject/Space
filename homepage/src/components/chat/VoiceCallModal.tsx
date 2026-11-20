import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Volume2, Users, MessageSquare, Video, VideoOff } from 'lucide-react';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  callerAvatar?: string;
  isVideo?: boolean;
}

export function VoiceCallModal({ isOpen, onClose, callerName, callerAvatar, isVideo = false }: VoiceCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');

  useEffect(() => {
    if (isOpen) {
      setCallStatus('connecting');
      const timer = setTimeout(() => setCallStatus('connected'), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: number;
    if (isOpen && callStatus === 'connected') {
      interval = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-lg bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-[var(--app-border)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--app-accent)] flex items-center justify-center text-[#10201d] font-semibold overflow-hidden">
              {callerAvatar ? <img src={callerAvatar} className="w-full h-full object-cover" /> : callerName[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-[var(--text-primary)] font-bold text-lg" style={{ fontFamily: 'Georgia, serif' }}>{callerName}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{callStatus === 'connecting' ? 'Connecting...' : callStatus === 'connected' ? formatDuration(callDuration) : 'Call ended'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
              <Users className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          {isVideo && !isVideoOff ? (
              <div className="w-full aspect-video bg-[var(--app-surface)] rounded-lg flex items-center justify-center border border-[var(--app-border)]">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-[var(--app-accent)] flex items-center justify-center text-[#10201d] text-3xl font-semibold mx-auto mb-4">
                  {callerName[0].toUpperCase()}
                </div>
                <p className="text-[var(--text-secondary)]">Video stream</p>
              </div>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-[var(--app-accent)] flex items-center justify-center text-[#10201d] text-4xl font-semibold">
              {callerName[0].toUpperCase()}
            </div>
          )}

          {callStatus === 'connecting' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex items-center gap-2"
            >
              <div className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 border-t-2 border-[var(--app-border)] flex items-center justify-center gap-4">
          {isVideo && (
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'frutiger-btn frutiger-btn-danger text-white' : 'frutiger-btn frutiger-btn-secondary text-[var(--text-primary)]'}`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'frutiger-btn frutiger-btn-danger text-white' : 'frutiger-btn frutiger-btn-secondary text-[var(--text-primary)]'}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <button
            onClick={() => {
              setCallStatus('ended');
              setTimeout(onClose, 500);
            }}
            className="w-14 h-14 rounded-full frutiger-btn frutiger-btn-danger text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button className="w-14 h-14 rounded-full frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center justify-center transition-all">
            <Volume2 className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

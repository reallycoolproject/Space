import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, Camera, Smile, X, Mic, Send } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { EmojiGifPicker, type Sticker } from './EmojiGifPicker';
import { useVoiceRecorder } from '../../calls/useVoiceRecorder';
import { VoiceRecorderBar } from './VoiceRecorderBar';

const replyPreview = (text: string, limit = 120) => {
  const excerpt = Array.from(text);
  return excerpt.length > limit ? `${excerpt.slice(0, limit).join('')}…` : text;
};

interface ChatInputProps {
  onSendMessage: (text: string, attachments: any[]) => void;
  onSendVoiceMessage?: (payload: { audioBlob: Blob; audioBase64: string; durationMs: number; waveform: number[] }) => Promise<void> | void;

  showGifPicker: boolean;
  setShowGifPicker: (val: boolean) => void;
  onGifSelect: (url: string) => void;
  onStickerSelect?: (sticker: Sticker) => void;
  stickerMaker?: { userId: string; username: string };
  customEmojis?: any[];
  customStickers?: any[];
  customAssetsError?: string;

  disabled?: boolean;
  replyingTo?: import('../../types/chat').Message | null;
  replyingToText?: string;
  setReplyingTo?: (msg: import('../../types/chat').Message | null) => void;
  socket?: Socket | null;
  roomId?: string;
}

export function ChatInput({
  onSendMessage,
  onSendVoiceMessage,
  showGifPicker, setShowGifPicker, onGifSelect, onStickerSelect,
  disabled, replyingTo, replyingToText, setReplyingTo, socket, roomId, stickerMaker,
  customEmojis, customStickers, customAssetsError
}: ChatInputProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [attachments, setAttachments] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'document' }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);

  const recorder = useVoiceRecorder();
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState<boolean>(() => {
    return localStorage.getItem('show_formatting_toolbar') === 'true';
  });

  useEffect(() => {
    const handleToolbarChange = () => {
      setShowFormattingToolbar(localStorage.getItem('show_formatting_toolbar') === 'true');
    };
    window.addEventListener('storage', handleToolbarChange);
    window.addEventListener('formatting_toolbar_toggle', handleToolbarChange);
    return () => {
      window.removeEventListener('storage', handleToolbarChange);
      window.removeEventListener('formatting_toolbar_toggle', handleToolbarChange);
    };
  }, []);

  const handleSendVoice = async () => {
    if (isSendingVoice) return;
    setIsSendingVoice(true);
    try {
      const result = await recorder.stop();
      if (result && onSendVoiceMessage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          void onSendVoiceMessage({
            audioBlob: result.blob,
            audioBase64: base64,
            durationMs: result.durationMs,
            waveform: result.waveform
          });
        };
        reader.readAsDataURL(result.blob);
      }
    } catch (e) {
      console.error('Failed to stop/send voice message:', e);
    } finally {
      setIsSendingVoice(false);
    }
  };

  useEffect(() => {
    if (replyingTo) messageInputRef.current?.focus();
  }, [replyingTo]);

  // Typing indicator
  useEffect(() => {
    if (inputMessage.length > 0 && socket && roomId) {
      if (!typingActiveRef.current) {
        socket.emit('typing:start', { roomId });
        typingActiveRef.current = true;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { roomId });
        typingActiveRef.current = false;
      }, 1000);
    } else if (socket && roomId) {
      if (typingActiveRef.current) {
        socket.emit('typing:stop', { roomId });
        typingActiveRef.current = false;
      }
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingActiveRef.current && socket && roomId) {
        socket.emit('typing:stop', { roomId });
        typingActiveRef.current = false;
      }
    };
  }, [inputMessage, socket, roomId]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() && attachments.length === 0) return;
    onSendMessage(inputMessage, attachments);
    setInputMessage('');
    setAttachments([]);
  };

  const formatSelection = (prefix: string, suffix = prefix, quoteLines = false) => {
    const input = messageInputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    const content = quoteLines && selected
      ? selected.split('\n').map(line => `> ${line}`).join('\n')
      : selected || (quoteLines ? '' : 'text');
    const insertion = `${prefix}${content}${suffix}`;
    setInputMessage(value => `${value.slice(0, start)}${insertion}${value.slice(end)}`);
    requestAnimationFrame(() => {
      input.focus();
      const selectionStart = start + prefix.length;
      input.setSelectionRange(selectionStart, selectionStart + content.length);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: typeof attachments = [];
    Array.from(files).forEach(file => {
      const type = file.type.startsWith('image/') ? 'image' 
                 : file.type.startsWith('video/') ? 'video'
                 : file.type.startsWith('audio/') ? 'audio' : 'document';
      newAttachments.push({ file, preview: URL.createObjectURL(file), type });
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const camInput = document.getElementById('cam-input') as HTMLInputElement;
    if (camInput) camInput.value = '';
  };

  const handleCameraStart = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera is not supported on this browser/network (HTTPS is usually required on mobile).");
        document.getElementById('cam-input')?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (e) {
      console.warn('Webcam stream unavailable, falling back to file picker', e);
      document.getElementById('cam-input')?.click();
    }
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const preview = URL.createObjectURL(file);
          setAttachments(prev => [...prev, { file, preview, type: 'image' }]);
        }
      }, 'image/jpeg');
    }
    closeCamera();
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  return (
    <div className="p-3 pt-1 z-20 shrink-0 sticky bottom-0 relative bg-[var(--app-bg)] border-t border-[var(--app-border)] w-full min-w-0 max-w-full">
      <EmojiGifPicker
        isOpen={showGifPicker}
        anchorRef={emojiBtnRef}
        onSelectGif={onGifSelect}
        onSelectEmoji={(emoji) => setInputMessage(prev => prev + emoji)}
        onSelectSticker={onStickerSelect}
        stickerMaker={stickerMaker}
        customEmojis={customEmojis}
        customStickers={customStickers}
        customAssetsError={customAssetsError}
        onClose={() => setShowGifPicker(false)}
      />

      <AnimatePresence>
        {replyingTo && (
          <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 48 }} exit={{ opacity: 0, y: 10, height: 0 }} className="mb-2 flex h-12 shrink-0 items-center justify-between overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3">
            <div className="min-w-0">
              <p className="text-[var(--app-accent)] text-xs font-bold mb-1">Replying to {replyingTo.senderName}</p>
              <p className="max-w-[min(34rem,65vw)] truncate text-sm text-[var(--text-secondary)] italic">
                {replyingToText ? replyPreview(replyingToText) : 'Message'}
              </p>
            </div>
            <button onClick={() => setReplyingTo && setReplyingTo(null)} className="w-6 h-6 rounded-full bg-[var(--app-surface-hover)] hover:bg-[var(--app-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-4 flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative shrink-0 w-24 h-24 rounded-2xl bg-[var(--app-surface)] border-2 border-[var(--app-border)] overflow-hidden group shadow-md">
                {att.type === 'image' && <img src={att.preview} className="w-full h-full object-cover" />}
                {att.type !== 'image' && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-[var(--text-secondary)]">
                    <Paperclip className="w-6 h-6 mb-1" />
                    <span className="text-[10px] truncate w-full">{att.file.name}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showFormattingToolbar && (
        <div role="toolbar" aria-label="Message formatting" className="mb-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {[
            { label: 'Bold', display: 'B', prefix: '**' },
            { label: 'Italic', display: 'I', prefix: '*' },
            { label: 'Underline', display: 'U', prefix: '__' },
            { label: 'Strikethrough', display: 'S', prefix: '~~' },
            { label: 'Inline code', display: '</>', prefix: '`' },
            { label: 'Spoiler', display: 'Spoiler', prefix: '||' }
          ].map(format => (
            <button key={format.label} type="button" disabled={disabled} onClick={() => formatSelection(format.prefix)} title={format.label} aria-label={format.label} className="rounded-md px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40">{format.display}</button>
          ))}
          <button type="button" disabled={disabled} onClick={() => formatSelection('> ', '', true)} title="Block quote" aria-label="Block quote" className="rounded-md px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40">Quote</button>
          <button type="button" disabled={disabled} onClick={() => formatSelection('```\n', '\n```')} title="Code block" aria-label="Code block" className="rounded-md px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40">Code block</button>
        </div>
      )}

      {recorder.error && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <span>{recorder.error}</span>
          <button type="button" onClick={recorder.cancel} className="text-red-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <motion.div className="glass-panel rounded-2xl p-2 flex items-center gap-2 relative min-h-[56px] shadow-lg border border-[var(--app-border)] focus-within:border-[var(--app-accent)] transition-all w-full min-w-0 max-w-full overflow-hidden">
        <VoiceRecorderBar
          isRecording={recorder.isRecording}
          isPaused={recorder.isPaused}
          durationMs={recorder.durationMs}
          levels={recorder.levels}
          onPauseResume={recorder.togglePause}
          onCancel={recorder.cancel}
          onSend={() => void handleSendVoice()}
          disabled={isSendingVoice}
        />

        <>
          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <input type="file" accept="image/*" capture="environment" id="cam-input" className="hidden" onChange={handleFileUpload} />
          
          <div className="flex gap-1.5 shrink-0 ml-1">
            <button onClick={() => fileInputRef.current?.click()} aria-label="Attach file" data-paint-id="chat-attach-btn" className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
            <button onClick={handleCameraStart} aria-label="Open camera" data-paint-id="chat-camera-btn" className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10 transition-colors">
              <Camera className="w-5 h-5" />
            </button>
          </div>
          
          <textarea
            ref={messageInputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!disabled && (inputMessage.trim() || attachments.length > 0)) {
                  handleSendMessage();
                }
              }
            }}
            placeholder="Type a message..."
            disabled={disabled}
            rows={Math.min(5, Math.max(1, inputMessage.split('\n').length))}
            className="max-h-32 min-h-11 flex-1 min-w-0 resize-none overflow-y-auto bg-transparent px-3 py-3 text-base text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none disabled:opacity-50"
          />

          <div className="flex gap-2 shrink-0 mr-1">
            {onSendVoiceMessage && !inputMessage.trim() && attachments.length === 0 && (
              <button
                type="button"
                onClick={() => void recorder.start()}
                disabled={disabled || recorder.isRecording}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10 transition-colors shrink-0"
                title="Record voice message"
                aria-label="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button ref={emojiBtnRef} onClick={() => setShowGifPicker(!showGifPicker)} aria-label="Choose emoji" data-paint-id="chat-emoji-btn" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showGifPicker ? 'text-[var(--app-accent)] bg-[var(--app-accent)]/20' : 'text-[var(--text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10'}`}>
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={handleSendMessage}
              disabled={disabled || (!inputMessage.trim() && attachments.length === 0)}
              aria-label="Send message"
              data-paint-id="chat-send-btn"
              className="h-10 px-4 sm:px-6 rounded-[14px] frutiger-btn frutiger-btn-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex shrink-0 items-center justify-center gap-1.5 active:scale-95"
            >
              <Send className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </>
      </motion.div>

      {/* Camera Live Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl p-6 max-w-lg w-full flex flex-col items-center relative shadow-2xl">
              <button onClick={closeCamera} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] hover:text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Capture Photo</h3>
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 relative border border-[var(--app-border)]">
                <video 
                  ref={(el) => {
                    if (el) {
                      videoRef.current = el;
                      if (cameraStream && el.srcObject !== cameraStream) {
                        el.srcObject = cameraStream;
                        el.play().catch(() => {});
                      }
                    }
                  }}
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex gap-4 w-full">
                <button onClick={closeCamera} className="flex-1 py-3 rounded-xl frutiger-btn frutiger-btn-secondary text-white font-semibold transition-colors">
                  Cancel
                </button>
                <button onClick={handleSnapPhoto} className="flex-1 py-3 rounded-xl frutiger-btn frutiger-btn-primary text-white font-semibold transition-colors flex items-center justify-center gap-2">
                  <Camera className="w-4 h-4" /> Snap Photo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

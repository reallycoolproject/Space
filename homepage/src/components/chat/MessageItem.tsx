import { useState, useEffect, memo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, CornerUpRight, Languages, Play, Pause, Video, FileText, Download, Smile, ShieldAlert, Unlock, Flag, X, Phone, PhoneIncoming, PhoneOff, Star, Sparkles } from 'lucide-react';
import type { Message, Reaction, UserBadge } from '../../types/chat';
import { decryptText } from '../../utils/crypto';
import { getSentMessageFromDB, getSentMessageMemory } from '../../utils/db';
import { API_BASE } from '../../config';
import { UserBadgesList } from '../common/ProfileBadge';
import { useCallOptional } from '../../calls/CallContext';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { getTwemojiUrl, UNIFORM_EMOJI_REGEX, isOnlyEmojis } from '../../utils/twemoji';
import { fetchAssetInfo, getCachedAssetInfo, type SpaceAssetInfo } from '../../utils/emojiCache';
import { EmojiStickerInfoModal } from './EmojiStickerInfoModal';

const translationLanguages = [
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['ar', 'Arabic'],
  ['hi', 'Hindi']
] as const;
const supportedTranslationLanguages = new Set<string>(translationLanguages.map(([code]) => code));
const replyPreview = (text: string, limit = 120) => {
  const excerpt = Array.from(text);
  return excerpt.length > limit ? `${excerpt.slice(0, limit).join('')}…` : text;
};
const getPreferredTranslationLanguage = () => {
  const saved = localStorage.getItem('space_translation_language');
  const browserLanguage = navigator.language.split('-')[0];
  return saved && supportedTranslationLanguages.has(saved)
    ? saved
    : supportedTranslationLanguages.has(browserLanguage)
      ? browserLanguage
      : 'en';
};

function SpoilerText({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      aria-label={revealed ? 'Hide spoiler' : 'Reveal spoiler'}
      onClick={() => setRevealed(value => !value)}
      className={`rounded px-1 transition-colors ${revealed ? 'bg-black/10 text-inherit' : 'bg-[var(--text-primary)] text-transparent hover:bg-black/40'}`}
    >
      {children}
    </button>
  );
}

export type CustomEmoji = {
  id: string;
  name: string;
  url: string;
  spaceId: string;
  spaceName: string;
  spaceIcon?: string;
  spaceIsPublic?: boolean;
};

function AsyncCustomEmoji({
  spaceId,
  name,
  isJumbo,
  onEmojiClick
}: {
  spaceId: string;
  name: string;
  isJumbo?: boolean;
  onEmojiClick?: (emoji: CustomEmoji) => void;
}) {
  const [assetInfo, setAssetInfo] = useState<SpaceAssetInfo | null>(() => getCachedAssetInfo(spaceId, name, 'emoji') || null);

  useEffect(() => {
    if (!assetInfo) {
      fetchAssetInfo(spaceId, name, 'emoji').then(info => {
        if (info) setAssetInfo(info);
      });
    }
  }, [spaceId, name, assetInfo]);

  if (!assetInfo?.asset?.url) {
    return <span className="text-xs text-[var(--text-secondary)] italic">:{name}:</span>;
  }

  const customEmoji: CustomEmoji = {
    id: assetInfo.asset.id,
    name,
    url: assetInfo.asset.url,
    spaceId,
    spaceName: assetInfo.space.name,
    spaceIcon: assetInfo.space.icon,
    spaceIsPublic: assetInfo.space.isPublic
  };

  return (
    <button
      type="button"
      onClick={() => onEmojiClick?.(customEmoji)}
      className="inline-block p-0.5 rounded hover:bg-white/10 transition-colors align-text-bottom cursor-pointer select-none"
      title={`:${name}: · ${assetInfo.space.name}`}
    >
      <img
        src={assetInfo.asset.url}
        alt={`:${name}:`}
        className={`${isJumbo ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-5 w-5'} object-contain inline-block`}
      />
    </button>
  );
}

const renderInlineMarkdown = (
  text: string,
  customEmojis: CustomEmoji[] = [],
  onEmojiClick?: (emoji: CustomEmoji) => void,
  isJumbo = false
): ReactNode[] => {
  const tokens = /(\|\|.+?\|\||\*\*\*.+?\*\*\*|\*\*.+?\*\*|__.+?__|~~.+?~~|`[^`]+`|\*[^*\n]+\*|:sp[a-fA-F0-9]{24}_[a-zA-Z0-9_]{1,32}:|:[a-zA-Z0-9_]{1,32}:|https?:\/\/[^\s<>]+|(?:\uD83C[\uDDE6-\uDDFF]){2}|[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}](?:[\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}]|\u200D[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}](?:[\uFE00-\uFE0F\u{1F3FB}-\u{1F3FF}])?)*)/gu;
  return text.split(tokens).filter(Boolean).map((token, index) => {
    // Check Unicode emoji -> Uniform Twemoji SVG
    if (UNIFORM_EMOJI_REGEX.test(token)) {
      return (
        <img
          key={index}
          src={getTwemojiUrl(token)}
          alt={token}
          draggable={false}
          loading="lazy"
          className={`${isJumbo ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-5 w-5 align-[-0.2em]'} object-contain inline-block mx-0.5 select-none pointer-events-none`}
        />
      );
    }

    // Check qualified Space Custom Emoji (:sp[spaceId]_[name]:)
    const qualifiedEmoji = token.match(/^:sp([a-fA-F0-9]{24})_([a-zA-Z0-9_]{1,32}):$/);
    if (qualifiedEmoji) {
      const spaceId = qualifiedEmoji[1];
      const emojiName = qualifiedEmoji[2];
      const local = customEmojis.find(asset =>
        asset.name.toLowerCase() === emojiName.toLowerCase() &&
        asset.spaceId.toLowerCase() === spaceId.toLowerCase()
      );
      if (local) {
        return (
          <button
            key={index}
            type="button"
            onClick={() => onEmojiClick?.(local)}
            className="inline-block p-0.5 rounded hover:bg-white/10 transition-colors align-text-bottom cursor-pointer select-none"
            title={`:${local.name}: · ${local.spaceName}`}
          >
            <img
              src={local.url}
              alt={`:${local.name}:`}
              className={`${isJumbo ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-5 w-5'} object-contain inline-block`}
            />
          </button>
        );
      } else {
        return (
          <AsyncCustomEmoji
            key={index}
            spaceId={spaceId}
            name={emojiName}
            isJumbo={isJumbo}
            onEmojiClick={onEmojiClick}
          />
        );
      }
    }

    // Check shortcode custom emoji (:name:)
    const plainEmoji = token.match(/^:([a-zA-Z0-9_]{1,32}):$/);
    if (plainEmoji) {
      const emojiName = plainEmoji[1];
      const local = customEmojis.find(asset => asset.name.toLowerCase() === emojiName.toLowerCase());
      if (local) {
        return (
          <button
            key={index}
            type="button"
            onClick={() => onEmojiClick?.(local)}
            className="inline-block p-0.5 rounded hover:bg-white/10 transition-colors align-text-bottom cursor-pointer select-none"
            title={`:${local.name}: · ${local.spaceName}`}
          >
            <img
              src={local.url}
              alt={`:${local.name}:`}
              className={`${isJumbo ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-5 w-5'} object-contain inline-block`}
            />
          </button>
        );
      }
    }

    if (token.startsWith('||') && token.endsWith('||')) return <SpoilerText key={index}>{token.slice(2, -2)}</SpoilerText>;
    if (token.startsWith('***') && token.endsWith('***')) return <strong key={index}><em>{token.slice(3, -3)}</em></strong>;
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('__') && token.endsWith('__')) return <u key={index}>{token.slice(2, -2)}</u>;
    if (token.startsWith('~~') && token.endsWith('~~')) return <del key={index}>{token.slice(2, -2)}</del>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index} className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em] break-all [word-break:break-all] whitespace-pre-wrap max-w-full">{token.slice(1, -1)}</code>;
    if (token.startsWith('*') && token.endsWith('*')) return <em key={index}>{token.slice(1, -1)}</em>;
    if (/^https?:\/\//i.test(token)) {
      try {
        const url = new URL(token);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return <a key={index} href={url.href} target="_blank" rel="noopener noreferrer" className="text-[var(--app-accent)] underline underline-offset-2 break-all [word-break:break-all]">{token}</a>;
        }
      } catch {
        return token;
      }
    }
    return token;
  });
};

const renderMarkdown = (
  text: string,
  customEmojis: CustomEmoji[] = [],
  onEmojiClick?: (emoji: CustomEmoji) => void,
  isJumbo = false
): ReactNode[] => {
  const rendered: ReactNode[] = [];
  let codeLines: string[] | null = null;
  for (const [index, line] of text.split('\n').entries()) {
    if (line.trimStart().startsWith('```')) {
      if (codeLines === null) codeLines = [];
      else {
        rendered.push(<pre key={`code-${index}`} className="my-2 max-w-full overflow-x-auto rounded-xl border border-[var(--app-border)] bg-black/20 p-3 font-mono text-sm"><code>{codeLines.join('\n')}</code></pre>);
        codeLines = null;
      }
      continue;
    }
    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }
    if (line.startsWith('> ')) {
      rendered.push(<blockquote key={`quote-${index}`} className="my-1 border-l-2 border-[var(--app-accent)] pl-3 text-[var(--text-secondary)]">{renderInlineMarkdown(line.slice(2), customEmojis, onEmojiClick, isJumbo)}</blockquote>);
      continue;
    }
    rendered.push(<div key={`line-${index}`} className="min-h-[1em] break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full overflow-hidden">{renderInlineMarkdown(line, customEmojis, onEmojiClick, isJumbo)}</div>);
  }
  if (codeLines !== null) rendered.push(<pre key="code-open" className="my-2 max-w-full overflow-x-auto rounded-xl border border-[var(--app-border)] bg-black/20 p-3 font-mono text-sm"><code>{codeLines.join('\n')}</code></pre>);
  return rendered;
};

interface MessageItemProps {
  message: Message;
  decryptedContent?: string;
  isMine: boolean;
  privateKey: CryptoKey | null;
  onDelete: (message: Message) => void;
  onForward: (message: Message, decryptedText: string) => void;
  onReply?: (message: Message, decryptedText: string) => void;
  onEdit: (message: Message, newText: string) => void;
  onImageClick?: (url: string, message: Message) => void;
  onProfileClick?: (userId: string, username?: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onSaveSticker?: (url: string, maker?: { userId?: string; username?: string }) => void;
  onUnblockUser?: (userId: string) => Promise<void>;
  onReportUser?: (userId: string) => Promise<void>;
  senderAvatar?: string;
  senderBadges?: UserBadge[];
  senderMemberNumber?: number;
  currentUserId?: string;
  isUploading?: boolean;
  painterRole?: string;
  customEmojis?: CustomEmoji[];
}

export const MessageItem = memo(function MessageItem({ message, isMine, privateKey, decryptedContent, onDelete, onForward, onReply, onEdit, onImageClick, onProfileClick, onReact, onSaveSticker, onUnblockUser, onReportUser, senderAvatar, senderBadges, senderMemberNumber, currentUserId, isUploading, painterRole, customEmojis = [] }: MessageItemProps) {
  const call = useCallOptional();
  const [decryptedText, setDecryptedText] = useState(decryptedContent || '[Decrypting...]');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [showTranslationConsent, setShowTranslationConsent] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState(getPreferredTranslationLanguage);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [stickerDetailsOpen, setStickerDetailsOpen] = useState(false);
  const [showBlockNotice, setShowBlockNotice] = useState(false);
  const [isBlockActionRunning, setIsBlockActionRunning] = useState(false);
  const [blockActionError, setBlockActionError] = useState('');

  const [favoriteGifs, setFavoriteGifs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorite-gifs') || '[]');
    } catch {
      return [];
    }
  });

  const [infoModalAsset, setInfoModalAsset] = useState<any | null>(null);
  const [infoModalSpace, setInfoModalSpace] = useState<any | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    const handleFavUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setFavoriteGifs(e.detail);
        return;
      }
      try {
        setFavoriteGifs(JSON.parse(localStorage.getItem('favorite-gifs') || '[]'));
      } catch {}
    };
    window.addEventListener('favorite-gifs-updated', handleFavUpdate);
    return () => window.removeEventListener('favorite-gifs-updated', handleFavUpdate);
  }, []);

  const handleToggleFavoriteGif = async (url: string) => {
    const isFav = favoriteGifs.includes(url);
    const updated = isFav ? favoriteGifs.filter(u => u !== url) : [url, ...favoriteGifs.filter(u => u !== url)];
    setFavoriteGifs(updated);
    localStorage.setItem('favorite-gifs', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('favorite-gifs-updated', { detail: updated }));

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE}/api/auth/favorite-gifs`, {
          method: isFav ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url })
        });
      }
    } catch (e) {
      console.warn('Failed to sync favorite GIF to server:', e);
    }
  };

  const handleEmojiClick = async (emoji: CustomEmoji) => {
    setInfoModalAsset({
      name: emoji.name,
      url: emoji.url,
      kind: 'emoji'
    });
    setInfoModalSpace({
      id: emoji.spaceId,
      name: emoji.spaceName || 'Space',
      icon: emoji.spaceIcon || '',
      isPublic: emoji.spaceIsPublic ?? false
    });
    setIsInfoModalOpen(true);

    if (emoji.spaceId) {
      const fresh = await fetchAssetInfo(emoji.spaceId, emoji.name, 'emoji');
      if (fresh?.space) {
        setInfoModalSpace(fresh.space);
      }
    }
  };

  const handleStickerClick = async (parsedData: any) => {
    setInfoModalAsset({
      name: parsedData.text || 'Custom Sticker',
      url: parsedData.mediaUrl,
      kind: 'sticker',
      maker: parsedData.stickerMaker
    });

    const spaceId = parsedData.spaceId || (message as any).spaceId;
    setInfoModalSpace(spaceId ? {
      id: spaceId,
      name: parsedData.spaceName || 'Space',
      icon: parsedData.spaceIcon || '',
      isPublic: parsedData.spaceIsPublic ?? false
    } : null);
    setIsInfoModalOpen(true);

    if (spaceId) {
      const fresh = await fetchAssetInfo(spaceId, parsedData.text || '', 'sticker', parsedData.mediaUrl);
      if (fresh?.space) {
        setInfoModalSpace(fresh.space);
      }
    }
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);

    const timer = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const diff = touchStartX - touchEndX;
    const swipeThreshold = 50;

    if (Math.abs(diff) > swipeThreshold) {
      if (isMine && diff < 0) {
        // Swipe right on sent message - reply
        if (onReply && decryptedText !== '[Decrypting...]' && decryptedText !== '[Encrypted Message]') {
          onReply(message, decryptedText);
        }
      } else if (!isMine && diff > 0) {
        // Swipe left on received message - reply
        if (onReply && decryptedText !== '[Decrypting...]' && decryptedText !== '[Encrypted Message]') {
          onReply(message, decryptedText);
        }
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (message.isSystemMessage) {
      setDecryptedText(message.content);
      if (message.systemType && message.systemType !== 'call') {
        const noticeKey = `seen-block-notice-${message.id}`;
        if (!sessionStorage.getItem(noticeKey)) {
          sessionStorage.setItem(noticeKey, 'true');
          setShowBlockNotice(true);
        }
      }
      return () => { isMounted = false; };
    }

    // Check synchronous memory cache first
    const memCache = getSentMessageMemory(message.id) || (message.clientMsgId ? getSentMessageMemory(message.clientMsgId) : null);
    if (memCache) {
      if (isMounted) setDecryptedText(memCache);
      return;
    }

    const processContent = async () => {
      let isE2EEWrapper = false;
      let e2eeData: any = null;

      if (message.content.startsWith('{')) {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed.e2ee || parsed.v === 3) {
            isE2EEWrapper = true;
            e2eeData = parsed;
          }
        } catch(e) {}
      }

      if (isMine) {
        let cached = await getSentMessageFromDB(message.senderId, message.id);
        if (!cached && message.clientMsgId) {
          cached = await getSentMessageFromDB(message.senderId, message.clientMsgId);
        }
        if (cached) {
          if (isMounted) setDecryptedText(cached);
          return;
        }

        // For sent messages, decrypt ciphertextForSender
        if (isE2EEWrapper && e2eeData?.v === 3 && privateKey) {
          try {
            const dec = await decryptText(message.content, privateKey, currentUserId);
            if (isMounted) setDecryptedText(dec);
            return;
          } catch(e) {}
        }

        if (isE2EEWrapper && e2eeData?.s && privateKey) {
          try {
            const dec = await decryptText(e2eeData.s, privateKey);
            if (isMounted) setDecryptedText(dec);
            return;
          } catch(e) {}
        }

        if (message.content.startsWith('{') && !isE2EEWrapper) {
          if (isMounted) setDecryptedText(message.content);
          return;
        }

        if (isMounted) setDecryptedText('[Decrypting...]');
        return;
      }

      if (!privateKey) {
        if (message.content.startsWith('{') && !isE2EEWrapper) {
          if (isMounted) setDecryptedText(message.content);
        } else {
          if (isMounted) setDecryptedText('[Encrypted Message]');
        }
        return;
      }

      // For received messages, decrypt ciphertextForRecipient
      const targetCiphertext = isE2EEWrapper && e2eeData?.v !== 3 ? e2eeData.r : message.content;

      try {
        const dec = await decryptText(targetCiphertext, privateKey, currentUserId);
        if (isMounted) {
          if (/[\x00-\x08\x0E-\x1F]/.test(dec)) {
            setDecryptedText(message.content.startsWith('{') && !isE2EEWrapper ? message.content : '[Encrypted Message]');
          } else {
            setDecryptedText(dec);
          }
        }
      } catch (error) {
        if (isMounted) {
          setDecryptedText(message.content.startsWith('{') && !isE2EEWrapper ? message.content : '[Encrypted Message]');
        }
      }
    };

    processContent();
    return () => { isMounted = false; };
  }, [message.content, privateKey, message.id, message.clientMsgId, message.senderId, isMine, currentUserId]);

  const parseMessageContent = (decrypted: string) => {
    if (decrypted === '[Encrypted Message]' || decrypted === '[Decrypting...]') return { text: decrypted };
    
    // If it's still encrypted JSON, try to parse it
    if (decrypted.startsWith('{')) {
      try {
        const obj = JSON.parse(decrypted);
        if (obj.text !== undefined || obj.attachments || obj.mediaUrl) return obj;
        // If it's encrypted JSON with e2ee, show as encrypted
        if (obj.e2ee) return { text: '[Encrypted Message]' };
        return { text: decrypted };
      } catch {
        return { text: decrypted };
      }
    }
    
    try {
      const obj = JSON.parse(decrypted);
      if (obj.text !== undefined || obj.attachments || obj.mediaUrl) return obj;
      return { text: decrypted };
    } catch {
      return { text: decrypted };
    }
  };

  const parsed = parseMessageContent(decryptedText);
  const messageDate = new Date(message.timestamp);
  const messageDateTime = Number.isNaN(messageDate.getTime()) ? undefined : messageDate.toISOString();
  const canUnblock = message.systemType === 'you-blocked' || message.systemType === 'blocked-send-own';

  useEffect(() => {
    setTranslatedText('');
    setTranslationError('');
    setShowTranslation(false);
    setShowTranslationConsent(false);
  }, [message.id, parsed.text]);

  const handleBlockNoticeAction = async (action: 'unblock' | 'report') => {
    if (!message.systemTargetUserId) return;
    setIsBlockActionRunning(true);
    setBlockActionError('');
    try {
      if (action === 'unblock') await onUnblockUser?.(message.systemTargetUserId);
      else await onReportUser?.(message.systemTargetUserId);
      setShowBlockNotice(false);
    } catch (error) {
      setBlockActionError(error instanceof Error ? error.message : 'This action could not be completed.');
    } finally {
      setIsBlockActionRunning(false);
    }
  };

  const requestTranslation = async () => {
    if (translatedText) {
      setShowTranslation(true);
      return;
    }
    if (!parsed.text || parsed.text.startsWith('[')) return;
    setShowTranslation(true);
    setTranslationError('');
    setIsTranslating(true);
    try {
      const res = await fetch(`${API_BASE}/api/messages/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ text: parsed.text, targetLang: translationLanguage })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || typeof data.translatedText !== 'string' || !data.translatedText.trim()) {
        throw new Error(data.message || 'Could not translate this message. Try again.');
      }
      setTranslatedText(data.translatedText);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : 'Could not translate this message. Try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateToggle = async (retry = false) => {
    if (showTranslation && !showTranslationConsent && !retry) {
      setShowTranslation(false);
      return;
    }
    if (translatedText) {
      setShowTranslation(true);
      return;
    }
    if (!parsed.text || parsed.text.startsWith('[')) return;
    if (localStorage.getItem('space_translation_provider_acknowledged') !== 'true') {
      setShowTranslation(true);
      setShowTranslationConsent(true);
      return;
    }
    await requestTranslation();
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditValue(parsed.text || '');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsEditing(false);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editValue.trim() && editValue !== parsed.text) {
        onEdit(message, editValue);
      }
      setIsEditing(false);
    }
  };

  const isCallEvent =
    message.systemType === 'call' ||
    Boolean(message.callMeta) ||
    (message.isSystemMessage && /call/i.test(message.content || '')) ||
    (message.senderId === 'system' && /call/i.test(message.content || ''));

  if (isCallEvent) {
    const meta = (message.callMeta || {}) as Record<string, any>;
    const isVideo = meta.media === 'video' || /video/i.test(message.content || '');
    const isMissed = meta.outcome === 'missed' || /missed/i.test(message.content || '');
    const isDeclined = meta.outcome === 'declined' || /declined/i.test(message.content || '');
    const isCanceled = meta.outcome === 'canceled' || /canceled/i.test(message.content || '');
    const isStarted = meta.outcome === 'started' || /started/i.test(message.content || '');
    const isCompleted = meta.outcome === 'completed' || (!isMissed && !isDeclined && !isCanceled && !isStarted);

    let title = isVideo ? 'Video Call' : 'Voice Call';
    if (isStarted) title = isVideo ? 'Video Call Started' : 'Voice Call Started';
    else if (isMissed) title = isVideo ? 'Missed Video Call' : 'Missed Call';
    else if (isDeclined) title = 'Call Declined';
    else if (isCanceled) title = 'Call Canceled';
    else if (meta.outcome === 'disconnected') title = 'Call Disconnected';
    else if (isCompleted) title = isVideo ? 'Video Call Ended' : 'Voice Call Ended';

    const formatCallDuration = (seconds?: number) => {
      if (!seconds || seconds <= 0) {
        const match = message.content?.match(/(\d+h\s*)?(\d+m\s*)?(\d+s)/);
        return match ? match[0] : '';
      }
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins === 0) return `${secs}s`;
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    };

    const durationStr = formatCallDuration(meta.durationSeconds);
    const IconComponent = isMissed ? PhoneIncoming : isDeclined || isCanceled ? PhoneOff : isVideo ? Video : Phone;
    const iconColor = isMissed
      ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
      : isDeclined || isCanceled
      ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
      : isStarted
      ? 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30 animate-pulse'
      : 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center px-4 py-2.5">
        <div className="relative overflow-hidden flex items-center gap-3.5 rounded-2xl border border-[var(--glass-border)] bg-gradient-to-r from-[var(--app-surface)] via-[var(--app-panel)] to-[var(--app-surface)] backdrop-blur-xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:border-[var(--app-accent)]/50 transition-all max-w-md w-full">
          {/* Frutiger Top Gloss Shine */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${iconColor}`}>
            <IconComponent className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[var(--text-primary)] truncate">{title}</span>
              {durationStr && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--app-surface)] text-[var(--text-secondary)] border border-[var(--app-border)] shadow-xs shrink-0">
                  ⏱ {durationStr}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {message.content && !message.content.startsWith('http')
                ? message.content
                : isCompleted && durationStr
                ? `Call lasted ${durationStr}`
                : isStarted
                ? 'Call in progress'
                : new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>

          {message.roomId && (
            <button
              type="button"
              onClick={() => {
                if (call) {
                  call.callBack(message.roomId || '', meta.media || 'audio');
                }
              }}
              disabled={Boolean(call?.activeCall)}
              title={isStarted ? 'Join Call' : 'Call Back'}
              className="shrink-0 px-3.5 py-1.5 rounded-xl frutiger-btn frutiger-btn-primary text-white text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              <span>{isStarted ? 'Join' : 'Call'}</span>
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  if (message.isSystemMessage) {

    return (
      <>
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center px-4 py-2">
          <div className="max-w-xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-center shadow-sm">
            <div className="flex justify-center mb-1"><ShieldAlert className="w-4 h-4 text-[var(--app-accent-secondary)]" /></div>
            <p className="text-sm text-[var(--text-secondary)]">{message.content}</p>
            {message.systemTargetUserId && (
              <div className="mt-2.5 flex justify-center gap-2">
                {canUnblock && (
                  <button 
                    type="button" 
                    onClick={() => void handleBlockNoticeAction('unblock')} 
                    className="frutiger-btn frutiger-btn-primary px-3 py-1 text-xs font-bold text-white rounded-lg inline-flex items-center gap-1 shadow-sm"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Unblock
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => void handleBlockNoticeAction('report')} 
                  className="frutiger-btn frutiger-btn-secondary px-3 py-1 text-xs font-semibold text-[var(--text-primary)] rounded-lg inline-flex items-center gap-1 shadow-sm"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                  Report
                </button>
              </div>
            )}
          </div>
        </motion.div>
        <AnimatePresence>
          {showBlockNotice && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => setShowBlockNotice(false)}>
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} role="dialog" aria-modal="true" aria-labelledby={`block-notice-title-${message.id}`} className="w-full max-w-md rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent-secondary)]/15 text-[var(--app-accent-secondary)]"><ShieldAlert className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 id={`block-notice-title-${message.id}`} className="text-base font-semibold text-[var(--text-primary)]">{canUnblock ? 'User blocked' : 'Messages unavailable'}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{message.content}</p>
                  </div>
                  <button type="button" aria-label="Close notice" onClick={() => setShowBlockNotice(false)} className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X className="w-4 h-4" /></button>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => void handleBlockNoticeAction('report')} disabled={isBlockActionRunning} className="frutiger-btn frutiger-btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"><Flag className="w-4 h-4" />Report</button>
                  {canUnblock && <button type="button" onClick={() => void handleBlockNoticeAction('unblock')} disabled={isBlockActionRunning} className="frutiger-btn frutiger-btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Unlock className="w-4 h-4" />Unblock</button>}
                  {!canUnblock && <button type="button" onClick={() => setShowBlockNotice(false)} className="frutiger-btn frutiger-btn-primary rounded-md px-3 py-2 text-sm font-bold text-white">Got it</button>}
                </div>
                {blockActionError && <p role="alert" className="mt-3 text-right text-xs text-red-400">{blockActionError}</p>}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      id={`message-${message.id}`}
      className="chat-message-row group w-full max-w-full overflow-hidden px-2 py-1.5 rounded-md"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative flex w-full min-w-0 max-w-full gap-3">
        <button
          type="button"
          onClick={() => onProfileClick?.(message.senderId, message.senderName)}
          className="mt-0.5 w-10 h-10 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] text-white font-bold text-sm flex items-center justify-center hover:ring-2 hover:ring-[var(--app-accent)]/60"
          title={`View ${message.senderName}'s profile`}
        >
          {senderAvatar ? <img src={senderAvatar} alt="" className="w-full h-full object-cover" /> : message.senderName.slice(0, 1).toUpperCase()}
        </button>
        <div className="relative flex flex-col flex-1 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => onProfileClick?.(message.senderId, message.senderName)}
              className="text-sm font-semibold cursor-pointer hover:underline underline-offset-2 transition-all"
              style={{
                color: 'var(--chat-sender-color, var(--text-secondary))',
                fontFamily: 'var(--chat-sender-font, inherit)'
              }}
            >
              {message.senderName}
            </button>
            <time className="text-[11px] text-[var(--text-secondary)]" dateTime={messageDateTime}>
              {Number.isNaN(messageDate.getTime()) ? '' : messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {message.edited ? ' · edited' : ''}
            </time>
          </div>
        
        {(() => {
          const replyObj = parsed.replyTo || message.replyTo;
          if (!replyObj) return null;
          return (
            <div 
              onClick={() => {
                const el = document.getElementById(`message-${replyObj.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.animate([
                    { backgroundColor: 'rgba(139, 92, 246, 0.4)' },
                    { backgroundColor: 'transparent' }
                  ], { duration: 1500 });
                }
              }}
              className={`mb-1.5 flex items-center gap-2 text-xs p-2 rounded-xl bg-black/30 border border-white/10 ${isMine ? 'flex-row-reverse' : 'flex-row'} cursor-pointer hover:bg-black/40 transition-colors`}
            >
              <CornerUpRight className={`w-3.5 h-3.5 text-[var(--app-accent)] shrink-0 ${isMine ? 'scale-x-[-1]' : ''}`} />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[var(--app-accent)] text-[11px]">Replying to {replyObj.senderName}</span>
                <span className="max-w-[min(34rem,65vw)] truncate italic text-white/80 text-[11px]">{replyPreview(replyObj.text || replyObj.content || 'Encrypted content')}</span>
              </div>
            </div>
          );
        })()}

        {/* Floating Hover Action Bar */}
        <div className={`absolute -top-4 ${isMine ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-all flex items-center bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-lg px-2 py-1 shadow-lg z-30 gap-1`}>
          {onReply && (
            <button onClick={() => onReply(message, parsed.text || (parsed.mediaType ? `[${parsed.mediaType.toUpperCase()}]` : 'Attachment'))} className="p-1.5 rounded-lg hover:bg-[var(--app-surface-hover)] transition-colors" title="Reply">
              <CornerUpRight className="w-4 h-4 scale-x-[-1]" />
            </button>
          )}
          {onReact && (
            <div className="relative">
              <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="p-1.5 rounded-lg hover:bg-[var(--app-surface-hover)] transition-colors" title="React">
                <Smile className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showReactionPicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className={`absolute top-full mt-2 ${isMine ? 'right-0' : 'left-0'} bg-[var(--app-panel)] border-2 border-[var(--app-border)] rounded-lg p-2 shadow-lg z-40 flex items-center gap-1`}
                  >
                    {commonEmojis.slice(0, showAllReactions ? commonEmojis.length : 5).map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(message.id, emoji);
                          setShowReactionPicker(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                    {!showAllReactions && <button
                      onClick={() => {
                        setShowAllReactions(true);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-colors shrink-0 text-[#9CA3AF]"
                      title="Show more reactions"
                    >
                      +
                    </button>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {isMine && (
            <button onClick={handleEditClick} className="p-1.5 rounded-full hover:bg-[var(--app-surface-hover)] transition-colors" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {isMine && (
            <button onClick={() => onDelete(message)} className="p-1.5 rounded-full hover:bg-red-500/20 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onForward(message, decryptedText)} className="p-1.5 rounded-full hover:bg-[var(--app-surface-hover)] transition-colors" title="Forward">
            <CornerUpRight className="w-4 h-4" />
          </button>
          {parsed.text && !parsed.text.startsWith('[') && (
            <button type="button" onClick={() => void handleTranslateToggle()} disabled={isTranslating} className={`p-1.5 rounded-full hover:bg-[var(--app-accent)]/20 transition-colors disabled:opacity-50 ${showTranslation ? 'text-[var(--app-accent)] bg-[var(--app-accent)]/10' : 'text-[var(--text-secondary)] hover:text-[var(--app-accent)]'}`} title="Translate message" aria-label="Translate message">
              <Languages className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className={`flex items-center gap-2 min-w-0 max-w-full overflow-hidden ${isMine ? 'flex-row-reverse justify-end' : 'flex-row'}`}>
          {isUploading && (
            <div className={`w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ${isMine ? 'order-1' : 'order-0'}`} />
          )}
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.12 }}
            className={`chat-message-content px-1 py-1 relative min-w-0 max-w-full overflow-hidden break-words border-0 ${
              isMine
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-primary)]'
            } ${isUploading ? 'opacity-70' : ''}`}
            data-painter-role={painterRole}
          >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-0 w-full max-w-full">
              <textarea 
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="bg-[var(--bg-input)] text-[var(--text-input)] border-2 border-[var(--border-input)] rounded-2xl p-4 w-full focus:outline-none text-base resize-none overflow-hidden custom-scrollbar"
                rows={Math.max(2, editValue.split('\n').length)}
              />
              <span className="text-xs text-[var(--text-secondary)] text-center font-medium">Press Enter to Save • Esc to Cancel</span>
            </div>
          ) : (
            <>
              {(() => {
                if (!parsed.text) return null;
                const trimmed = parsed.text.trim();
                const isStandaloneGif = /^https?:\/\/\S+\.gif(\?\S*)?$/i.test(trimmed) ||
                  /^https?:\/\/(static\.|media\.)?klipy\.com\/\S+$/i.test(trimmed) ||
                  /^https?:\/\/(media\.)?giphy\.com\/media\/\S+$/i.test(trimmed);

                if (isStandaloneGif) {
                  const isFavorited = favoriteGifs.includes(trimmed);
                  return (
                    <div className="rounded-2xl overflow-hidden border-2 border-[var(--app-border)] max-w-md shadow-md relative group my-1">
                      <img
                        src={trimmed}
                        alt="GIF"
                        className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => onImageClick && onImageClick(trimmed, message)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavoriteGif(trimmed);
                        }}
                        className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-md ${
                          isFavorited
                            ? 'bg-yellow-500 text-black opacity-100 scale-105'
                            : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'
                        }`}
                        title={isFavorited ? 'Remove from favorites' : 'Star to favorites'}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  );
                }

                const onlyEmojisInfo = isOnlyEmojis(parsed.text);
                const isJumbo = onlyEmojisInfo.isOnly && onlyEmojisInfo.count <= 6;

                return (
                  <div className={`text-base leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full overflow-hidden ${
                    parsed.text.startsWith('[') ? 'text-gray-500 italic text-sm' : ''
                  }`}>
                    {renderMarkdown(parsed.text, customEmojis, handleEmojiClick, isJumbo)}
                  </div>
                );
              })()}
              
              {/* Media Rendering */}
              {parsed.mediaUrl && parsed.mediaType === 'audio' && (
                <div className="mt-3 w-full max-w-[340px]">
                  <VoiceMessagePlayer
                    src={parsed.mediaUrl}
                    durationMs={parsed.durationMs}
                    waveform={parsed.waveform}
                    isMine={isMine}
                  />
                </div>
              )}

              {parsed.mediaUrl && parsed.mediaType === 'gif' && (() => {
                const isFavorited = favoriteGifs.includes(parsed.mediaUrl);
                return (
                  <div className="mt-3 rounded-2xl overflow-hidden border-2 border-[var(--app-border)] max-w-md shadow-md relative group">
                    <img
                      src={parsed.mediaUrl}
                      alt="GIF"
                      className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => onImageClick && onImageClick(parsed.mediaUrl, message)}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavoriteGif(parsed.mediaUrl);
                      }}
                      className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md backdrop-blur-md ${
                        isFavorited
                          ? 'bg-yellow-500 text-black opacity-100 scale-105'
                          : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'
                      }`}
                      title={isFavorited ? 'Remove from favorites' : 'Star to favorites'}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                );
              })()}

              {parsed.mediaUrl && parsed.mediaType === 'sticker' && (
                <div className="mt-3 max-w-[220px]">
                  <button
                    type="button"
                    onClick={() => handleStickerClick(parsed)}
                    className="block text-left p-1 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer"
                    title="Click for sticker & space details"
                  >
                    <img
                      src={parsed.mediaUrl}
                      alt={parsed.text || 'Sticker'}
                      className="w-full h-auto object-contain cursor-pointer hover:scale-105 transition-transform"
                    />
                  </button>
                </div>
              )}

              {parsed.attachments && parsed.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {parsed.attachments.map((att: any, i: number) => (
                    <div key={i} className="max-w-[280px]">
                      {att.mediaType === 'image' ? (
                        <div className="rounded-2xl overflow-hidden border-2 border-[var(--app-border)] cursor-pointer hover:opacity-90 transition-opacity shadow-md" onClick={() => onImageClick && onImageClick(att.mediaUrl, message)}>
                          <img src={att.mediaUrl} className="w-full h-auto object-cover" />
                        </div>
                      ) : att.mediaType === 'audio' ? (
                        <div className="w-full max-w-[320px] bg-[var(--bg-input)] rounded-2xl p-4 flex items-center gap-4 border-2 border-[var(--border-input)] shadow-md">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const audioEl = document.getElementById(`audio-att-${message.id}-${i}`) as HTMLAudioElement;
                              if (audioEl) {
                                if (isPlayingAudio) {
                                  audioEl.pause();
                                  setIsPlayingAudio(false);
                                } else {
                                  audioEl.play().then(() => setIsPlayingAudio(true)).catch((err) => {
                                    console.error('Audio play failed:', err);
                                  });
                                }
                              }
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${isMine ? 'bg-white/20 text-white' : 'bg-[var(--app-accent)] text-[#10201d]'}`}
                          >
                            {isPlayingAudio ? <Pause className="w-5 h-5 fill-current ml-0.5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                          </button>
                          <audio
                            id={`audio-att-${message.id}-${i}`}
                            src={att.mediaUrl}
                            onEnded={() => setIsPlayingAudio(false)}
                            onPause={() => setIsPlayingAudio(false)}
                            onPlay={() => setIsPlayingAudio(true)}
                            onError={() => console.error('Audio load error')}
                            className="hidden"
                          />
                          <div className="flex-1 flex flex-col justify-center min-w-0">
                            <div className="text-sm font-semibold truncate">{att.fileName || 'Audio File'}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{(att.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <a href={att.mediaUrl} download={att.fileName} className="w-10 h-10 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] flex items-center justify-center transition-colors shrink-0">
                            <Download className="w-5 h-5 text-[var(--text-secondary)]" />
                          </a>
                        </div>
                      ) : (
                        <div className="bg-[var(--bg-input)] rounded-2xl p-4 flex items-center gap-4 border-2 border-[var(--border-input)] shadow-md">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/20' : 'bg-[var(--app-accent)]/20'}`}>
                            {att.mediaType === 'video' ? <Video className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{att.fileName}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{(att.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <a href={att.mediaUrl} download={att.fileName} className="w-10 h-10 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] flex items-center justify-center transition-colors shrink-0">
                            <Download className="w-5 h-5 text-[var(--text-secondary)]" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {showTranslation && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 pt-2 border-t border-[#2a2a3a] overflow-hidden">
                    {isTranslating ? (
                      <span className="text-xs text-gray-500 italic flex items-center gap-2">Translating...</span>
                    ) : showTranslationConsent ? (
                      <div className="space-y-2">
                        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                          To translate this message, its text will be sent to MyMemory, an external translation service. Your original message stays unchanged.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-xs text-[var(--text-secondary)]">
                            Translate to{' '}
                            <select
                              value={translationLanguage}
                              onChange={event => {
                                setTranslationLanguage(event.target.value);
                                localStorage.setItem('space_translation_language', event.target.value);
                              }}
                              className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[var(--text-primary)]"
                              aria-label="Translation language"
                            >
                              {translationLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.setItem('space_translation_provider_acknowledged', 'true');
                              setShowTranslationConsent(false);
                              void requestTranslation();
                            }}
                            className="rounded-md bg-[var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Translate
                          </button>
                          <button type="button" onClick={() => { setShowTranslation(false); setShowTranslationConsent(false); }} className="rounded-md px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : translationError ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-rose-500" role="alert">
                        <span>{translationError}</span>
                        <button type="button" onClick={() => void handleTranslateToggle(true)} className="font-semibold underline underline-offset-2">
                          Try again
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Translation
                          <select
                            value={translationLanguage}
                            onChange={event => {
                              setTranslationLanguage(event.target.value);
                              localStorage.setItem('space_translation_language', event.target.value);
                              setTranslatedText('');
                              setTranslationError('');
                              setShowTranslation(false);
                            }}
                            className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-1.5 py-1 text-[10px] font-medium normal-case tracking-normal text-[var(--text-primary)]"
                            aria-label="Translation language"
                          >
                            {translationLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                          </select>
                        </label>
                        <p className="text-sm leading-relaxed text-[var(--text-primary)]">{translatedText}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          </motion.div>

          {/* Reactions Display */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(
                message.reactions.reduce((acc: Record<string, Reaction[]>, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r);
                  return acc;
                }, {})
              ).map(([emoji, reactors]) => (
                <button
                  key={emoji}
                  onClick={() => onReact && onReact(message.id, emoji)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border shadow-lg ${
                    reactors.some(r => r.userId === currentUserId)
                      ? 'bg-[var(--app-accent)]/30 border-[var(--app-accent)] text-white scale-105'
                      : 'bg-black/40 border-white/20 text-white/80 hover:bg-black/50 hover:scale-105'
                  } transition-all duration-200`}
                >
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="text-xs font-semibold opacity-90">{reactors.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-[#9CA3AF] opacity-70">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMine && (
            <div className="flex items-center gap-1">
              {message.readBy && message.readBy.length > 0 ? (
                <span className="text-[10px] text-[#10b981]">Read ✓✓</span>
              ) : message.deliveredTo && message.deliveredTo.length > 1 ? (
                <span className="text-[10px] text-[#6366f1]">Delivered ✓✓</span>
              ) : (
                <span className="text-[10px] text-[#9CA3AF]">Sent ✓</span>
              )}
            </div>
          )}
          {message.edited && (
            <span className="text-[10px] text-[#9CA3AF] opacity-50 italic">(edited)</span>
          )}
        </div>
        </div>
      </div>

      <EmojiStickerInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        asset={infoModalAsset || { name: 'Asset', url: '', kind: 'emoji' }}
        space={infoModalSpace}
        onSaveSticker={onSaveSticker}
      />
    </motion.div>
  );
});

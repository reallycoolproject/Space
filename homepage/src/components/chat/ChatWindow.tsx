import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Users, Hash, Info, MessageCircle, Image as ImageIcon, Sliders, X, Bell, BellOff, Phone, Video, PhoneOff, PhoneIncoming } from 'lucide-react';
import { API_BASE } from '../../config';
import { encryptText, encryptMessagePayload, encryptGroupMessagePayload } from '../../utils/crypto';
import { cacheSentMessageMemory, saveSentMessageToDB } from '../../utils/db';
import type { Message } from '../../types/chat';
import type { User, ActiveContext } from '../../types/chat';
import type { Socket } from 'socket.io-client';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { GroupInfoModal } from './GroupInfoModal';
import { GroupMemberSidebar } from './GroupMemberSidebar';
import { ImagePreviewModal } from './ImagePreviewModal';
import { DeleteMessageModal, ForwardMessageModal } from './CustomModals';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeCustomization } from '../../contexts/ThemeContext';
import { ImageCropModal, type CropResult } from '../common/ImageCropModal';
import { useCallOptional } from '../../calls/CallContext';
import type { CallMedia } from '../../calls/types';

const isEncryptedEnvelope = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2ee === true || parsed?.v === 2 || parsed?.v === 3;
  } catch {
    return false;
  }
};


interface ChatWindowProps {
  activeContext: ActiveContext;
  setActiveContext: (context: ActiveContext) => void;
  user: any;
  friends: User[];
  nicknames?: Record<string, string>;
  privateKey?: CryptoKey | null;
  socket?: Socket | null;
  onViewProfile?: (profile: any) => void;
  onMessagesChange?: (messages: any[], roomId: string) => void;
  isMobile: boolean;
  spaces?: any[];
  acceptedUsers?: string[];
}

export function ChatWindow({
  activeContext, setActiveContext, user, friends, nicknames, privateKey, socket, onViewProfile, onMessagesChange, isMobile, spaces = []
}: ChatWindowProps) {
  const { isPrivateKeyReady, keyInitializationError, retryKeyInitialization, logout, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [customSpaceEmojis, setCustomSpaceEmojis] = useState<Array<{ id: string; name: string; url: string; spaceId: string; spaceName: string }>>([]);
  const [customSpaceStickers, setCustomSpaceStickers] = useState<Array<{ id: string; name: string; url: string; associatedEmoji?: string; spaceId: string; spaceName: string }>>([]);
  const [customSpaceAssetError, setCustomSpaceAssetError] = useState('');

  useEffect(() => {
    if (!token) return;
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void fetch(`${API_BASE}/api/spaces/assets/available`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      }).then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load Space assets.');
        setCustomSpaceEmojis(data.emojis || []);
        setCustomSpaceStickers(data.stickers || []);
        setCustomSpaceAssetError('');
      }).catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Could not load Space assets', error);
        setCustomSpaceAssetError(error instanceof Error ? error.message : 'Could not load Space assets.');
      });
    };
    refresh();
    window.addEventListener('space-assets-updated', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('space-assets-updated', refresh);
    };
  }, [token]);

  // Modals & Reply
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<{ message: Message, text: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ message: Message, text: string } | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string, message: Message } | null>(null);

  // Group Chat State
  const [showMembersSidebar, setShowMembersSidebar] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [allowMemberAdds, setAllowMemberAdds] = useState(false);
  const [allowMemberEditInfo, setAllowMemberEditInfo] = useState(false);
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPublicKeys, setGroupPublicKeys] = useState<Record<string, string>>({});
  const [groupSecurityMessage, setGroupSecurityMessage] = useState('');
  const [groupKeyStatus, setGroupKeyStatus] = useState<'checking' | 'ready' | 'blocked' | 'error' | null>(null);
  const [isRefreshingGroupKeys, setIsRefreshingGroupKeys] = useState(false);
  const [isRetryingKeySetup, setIsRetryingKeySetup] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Admin' | 'Member'>('Member');
  const [groupCreatedBy, setGroupCreatedBy] = useState<string>('');
  const [groupCreatedByUsername, setGroupCreatedByUsername] = useState<string>('');
  const [groupCreatedByAvatar, setGroupCreatedByAvatar] = useState<string>('');
  const [groupCreatedAt, setGroupCreatedAt] = useState<Date | undefined>(undefined);

  // Uploading state
  const [uploadingMessages, setUploadingMessages] = useState<Set<string>>(new Set());

  // Typing & Online Status
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timestamp: number }>>({});
  const readQueuedRef = useRef<Set<string>>(new Set());
  
  // One-time message request state
  const [pendingMessageRequest, setPendingMessageRequest] = useState<any>(null);

  // Theme & Chat Wallpaper
  const { getWallpaper, setWallpaper, chatStyles, setChatStyle, clearChatStyles } = useThemeCustomization();
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showChatAppearance, setShowChatAppearance] = useState(false);
  const [isConversationMuted, setIsConversationMuted] = useState(false);
  const activeWallpaper = getWallpaper(activeContext.id ? String(activeContext.id) : undefined);

  const call = useCallOptional();
  const [roomCall, setRoomCall] = useState<any>(null);

  const currentRoomId = useMemo(() => {
    if (activeContext.type === 'dms' && activeContext.id && user?.userId) {
      return [user.userId, activeContext.id].sort().join('_');
    }
    return activeContext.id ? String(activeContext.id) : '';
  }, [activeContext.type, activeContext.id, user?.userId]);

  useEffect(() => {
    if (!currentRoomId || (activeContext.type === 'dms' && activeContext.id === user?.userId)) {
      setRoomCall(null);
      return;
    }
    let active = true;
    const loadRoomCall = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/calls/room/${encodeURIComponent(currentRoomId)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (active && data.ok) {
          setRoomCall(data.call || null);
        }
      } catch {
        // silent
      }
    };
    void loadRoomCall();

    if (!socket) return;
    const handleCallStarted = (payload: any) => {
      if (payload?.call?.roomId === currentRoomId) setRoomCall(payload.call);
    };
    const handleCallUpdated = (payload: any) => {
      if (payload?.call?.roomId === currentRoomId) setRoomCall(payload.call);
    };
    const handleCallEnded = (payload: any) => {
      if (payload?.callId === roomCall?.id || payload?.call?.roomId === currentRoomId) setRoomCall(null);
    };

    socket.on('call:started', handleCallStarted);
    socket.on('call:updated', handleCallUpdated);
    socket.on('call:ended', handleCallEnded);

    return () => {
      active = false;
      socket.off('call:started', handleCallStarted);
      socket.off('call:updated', handleCallUpdated);
      socket.off('call:ended', handleCallEnded);
    };
  }, [currentRoomId, activeContext.type, activeContext.id, user?.userId, socket, roomCall?.id]);

  useEffect(() => {
    const muteKey = activeContext.id
      ? `space_muted_${activeContext.type === 'dms' ? 'dm' : 'group'}_${activeContext.id}`
      : '';
    setIsConversationMuted(Boolean(muteKey && localStorage.getItem(muteKey) === 'true'));
  }, [activeContext.id, activeContext.type]);

  // Fetch online status of friend when opening DM
  useEffect(() => {
    if (activeContext.type === 'dms' && activeContext.id && user?.userId) {
      // Check if friend is online via socket
      if (socket) {
        socket.emit('check_online_status', { userId: activeContext.id });
      }
    }
  }, [activeContext, socket, user]);

  // Memoize messages list to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages]);

  // Memoize typing users to prevent unnecessary re-renders
  const memoizedTypingUsers = useMemo(() => typingUsers, [typingUsers]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeContextRef = useRef(activeContext);
  const groupKeyRequestRef = useRef(0);
  useEffect(() => { activeContextRef.current = activeContext; }, [activeContext]);

  // Optimize scroll to bottom with requestAnimationFrame
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messageContainerRef.current) {
        messageContainerRef.current.scrollTo({
          top: messageContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [memoizedMessages.length, scrollToBottom]);

  // Notify parent of messages changes for reporting
  useEffect(() => {
    if (onMessagesChange) {
      const isDms = activeContext.type === 'dms';
      const roomId = isDms && user?.userId && activeContext.id 
        ? [user.userId, activeContext.id].sort().join('_') 
        : (activeContext.id || '');
      if (roomId) {
        onMessagesChange(messages, roomId);
      }
    }
  }, [messages, activeContext, user?.userId, onMessagesChange]);

  // Load Messages & Setup Room
  useEffect(() => {
    if (socket && activeContext.id && user?.userId && isPrivateKeyReady) {
      const isDms = activeContext.type === 'dms';
      const roomId = isDms ? [user.userId, activeContext.id].sort().join('_') : String(activeContext.id);

      setMessages(prev => prev.filter(message => message.roomId === roomId));
      const joinRoom = () => socket.emit('join_room', { roomId });
      joinRoom();
      socket.on('connect', joinRoom);

      // Load messages
      fetch(`${API_BASE}/api/messages/${roomId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => {
        console.log('Messages response:', data);
        if (data.ok) {
          setMessages(prev => {
            const mergedMessages = new Map<string, Message>();
            data.messages.forEach((message: Message) => mergedMessages.set(message.clientMsgId || message.id, message));
            prev.forEach(message => {
              const key = message.clientMsgId || message.id;
              if (!mergedMessages.has(key)) mergedMessages.set(key, message);
            });
            return Array.from(mergedMessages.values()).sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
          });
        }
      })
      .catch(console.error);

      // Load pending message requests for DMs
      if (isDms) {
        fetch(`${API_BASE}/api/auth/messages/requests`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.requests) {
            // Find request for this specific user
            const requestForUser = data.requests.find((r: any) => 
              r.senderId === activeContext.id || r.recipientUserId === activeContext.id
            );
            if (requestForUser && requestForUser.status === 'pending') {
              setPendingMessageRequest(requestForUser);
            } else {
              setPendingMessageRequest(null);
            }
          }
        })
        .catch(console.error);
      }

      if (!isDms) {
        const groupKeyRequestId = ++groupKeyRequestRef.current;
        setGroupKeyStatus('checking');
        fetch(`${API_BASE}/api/groups/${activeContext.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
          if (groupKeyRequestId !== groupKeyRequestRef.current) return;
          if (data.ok && data.group) {
            // Backend already populates member details, use them directly
            // Only fallback to friends list if backend didn't provide details
            const membersWithDetails = data.group.members.map((m: any) => {
              // If backend already provided details, use them
              if (m.username && m.displayName) {
                return { ...m, nickname: data.group.nicknames?.[m.userId] || '' };
              }
              // Otherwise fallback to friends list
              const friend = friends.find(f => f.userId === m.userId);
              const isMe = m.userId === user.userId;
              return {
                ...m,
                username: isMe ? user.username : (friend?.username || 'Unknown'),
                displayName: isMe ? user.displayName : friend?.displayName,
                avatar: isMe ? user.avatar : friend?.avatar,
                nickname: data.group.nicknames?.[m.userId] || ''
              };
            });
            setGroupMembers(membersWithDetails);
            setAllowMemberAdds(data.group.allowMemberAdds === true);
            setAllowMemberEditInfo(data.group.allowMemberEditInfo === true);
            setGroupDescription(data.group.description || '');
            setGroupPublicKeys(Object.fromEntries(membersWithDetails.filter((member: any) => member.publicKey).map((member: any) => [member.userId, member.publicKey])));
            const membersMissingKeys = membersWithDetails.filter((member: any) => !member.userId || !member.publicKey);
            setGroupKeyStatus(membersMissingKeys.length ? 'blocked' : 'ready');
            setGroupSecurityMessage(membersMissingKeys.length
              ? `Waiting for keys from ${membersMissingKeys.map((member: any) => member.displayName || member.username || member.userId).join(', ')}. Those members need to sign in once to publish an encryption key.`
              : '');
            const myRole = data.group.members.find((m: any) => m.userId === user.userId)?.role || 'Member';
            console.log('My role:', myRole);
            setCurrentUserRole(myRole);
            setGroupCreatedBy(data.group.createdBy);
            setGroupCreatedAt(data.group.createdAt);

            // Find owner details for display
            const owner = data.group.members.find((m: any) => m.role === 'Owner');
            console.log('Owner member:', owner);
            if (owner) {
              setGroupCreatedByUsername(owner.username || owner.displayName || owner.userId);
              setGroupCreatedByAvatar(owner.avatar || '');
            }
          }
        })
        .catch(error => {
          if (groupKeyRequestId !== groupKeyRequestRef.current) return;
          console.error('Failed to load group encryption keys:', error);
          setGroupKeyStatus('error');
          setGroupSecurityMessage('Could not load group members or encryption keys. Check your connection and try again.');
        });
      } else {
        setAllowMemberAdds(false);
        setAllowMemberEditInfo(false);
        setGroupDescription('');
        groupKeyRequestRef.current += 1;
        setGroupMembers([]);
        setGroupPublicKeys({});
        setGroupSecurityMessage('');
        setGroupKeyStatus(null);
        setGroupCreatedBy('');
        setGroupCreatedByUsername('');
        setGroupCreatedByAvatar('');
        setGroupCreatedAt(undefined);
      }

      return () => {
        groupKeyRequestRef.current += 1;
        socket.off('connect', joinRoom);
      };
    } else {
      groupKeyRequestRef.current += 1;
      setMessages([]);
      setGroupMembers([]);
      setAllowMemberAdds(false);
      setAllowMemberEditInfo(false);
      setGroupDescription('');
      setGroupPublicKeys({});
      setGroupSecurityMessage('');
      setGroupKeyStatus(null);
    }
  }, [activeContext, socket, user?.userId, isPrivateKeyReady]);

  useEffect(() => {
    if (!user?.userId || !activeContext.id || messages.length === 0 || localStorage.getItem('readReceipts') === 'false') return;
    messages
      .filter(message => message.senderId !== user.userId && !message.readBy?.includes(user.userId) && !String(message.id).startsWith('temp-'))
      .forEach(message => {
        if (readQueuedRef.current.has(message.id)) return;
        readQueuedRef.current.add(message.id);
        fetch(`${API_BASE}/api/messages/${message.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).catch(() => undefined);
      });
  }, [messages, activeContext.id, user?.userId]);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;
    
    const reconnectRoom = () => {
      const currentContext = activeContextRef.current;
      if (!currentContext.id || !user?.userId) return;
      const roomId = currentContext.type === 'dms'
        ? [user.userId, currentContext.id].sort().join('_')
        : String(currentContext.id);
      socket.emit('join_room', { roomId });
    };
    socket.on('connect', reconnectRoom);
    
    const handleReceive = (message: Message) => {
      console.log('Received message via socket:', message);
      const currentContext = activeContextRef.current;
      let activeRoomId = 'dms';

      if (currentContext.type === 'dms' && currentContext.id && user?.userId) {
        activeRoomId = [user.userId, currentContext.id].sort().join('_');
      } else if (currentContext.type === 'space' && currentContext.id) {
        activeRoomId = currentContext.id;
      }

      console.log('Message roomId:', message.roomId, 'Active roomId:', activeRoomId);

      if (!message.roomId || message.roomId === activeRoomId) {
        setMessages(prev => {
          // If we already appended an optimistic message, update its DB ID.
          if (message.clientMsgId) {
            const existingOpt = prev.find(m => m.clientMsgId === message.clientMsgId);
            if (existingOpt) {
              return prev.map(m => m.clientMsgId === message.clientMsgId ? { ...m, ...message, id: message.id } : m);
            }
          }
          if (prev.some(m => m.id === message.id)) return prev;

          // Mark as delivered for current user if not sender
          if (message.senderId !== user?.userId && message.id) {
            fetch(`${API_BASE}/api/messages/${message.id}/delivered`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }).catch(console.error);
          }

          return [...prev, message];
        });
      }
    };

    const handleEdited = (data: { id: string, content: string }) => {
      console.log('Message edited:', data);
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content } : m));
    };

    const handleDeleted = (data: { id: string }) => {
      console.log('Message deleted:', data);
      setMessages(prev => prev.filter(m => m.id !== data.id));
    };

    const handleTypingIndicator = (data: { userId: string; username: string; isTyping: boolean }) => {
      if (data.userId === user?.userId) return; // Don't show own typing status
      setTypingUsers(prev => {
        if (data.isTyping) {
          return { ...prev, [data.userId]: { username: data.username, timestamp: Date.now() } };
        } else {
          const { [data.userId]: _, ...rest } = prev;
          return rest;
        }
      });
    };

    const handleReacted = (data: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
    };

    const handleDelivered = (data: { messageId: string; deliveredTo: string[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, deliveredTo: data.deliveredTo } : m));
    };

    const handleRead = (data: { messageId: string; readBy: string[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, readBy: data.readBy } : m));
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('typing:indicator', handleTypingIndicator);
    socket.on('message:reacted', handleReacted);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:read', handleRead);

    return () => {
      socket.off('connect', reconnectRoom);
      socket.off('message:receive', handleReceive);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('typing:indicator', handleTypingIndicator);
      socket.off('message:reacted', handleReacted);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:read', handleRead);
    };
  }, [socket, user]);

  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup typing indicators after 3 seconds of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const cleaned: Record<string, { username: string; timestamp: number }> = {};
        Object.entries(prev).forEach(([userId, data]) => {
          if (now - data.timestamp < 3000) {
            cleaned[userId] = data;
          }
        });
        return cleaned;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const getGroupKeyRecipients = async () => {
    if (!activeContext.id) throw new Error('No group is selected.');
    if (user?.publicKey) {
      const keyResponse = await fetch(`${API_BASE}/api/auth/user/public-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ publicKey: user.publicKey })
      });
      const keyData = await keyResponse.json();
      if (!keyResponse.ok || !keyData.ok) throw new Error(keyData.message || 'Could not register your encryption key.');
    }

    const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.group) throw new Error(data.message || 'Could not check group encryption keys.');

    const members = data.group.members || [];
    const keys: Record<string, string> = {};
    members.forEach((member: any) => {
      if (member.userId && member.publicKey) keys[member.userId] = member.publicKey;
    });
    const missingMembers = members.filter((member: any) => !member.userId || !keys[member.userId]);
    setGroupMembers(members);
    setGroupPublicKeys(keys);
    setGroupKeyStatus(missingMembers.length ? 'blocked' : 'ready');
    setGroupSecurityMessage(missingMembers.length
      ? `Waiting for keys from ${missingMembers.map((member: any) => member.displayName || member.username || member.userId).join(', ')}. Those members need to sign in once to publish an encryption key.`
      : '');
    return { members, keys, missingMembers };
  };

  // Send Logic
  const handleSendMessage = async (inputMessage: string, attachments: any[]) => {
    if (!inputMessage.trim() && attachments.length === 0) return;
    if (!socket || !user) return;

    let recipientPubKey = '';
    if (activeContext.type === 'dms' && activeContext.id) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/user/${activeContext.id}/public-key`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.ok) recipientPubKey = data.publicKey;
      } catch (e) { console.error(e) }
    }
    
    try {
      const clientMsgId = Date.now().toString() + Math.random().toString();
      const payload = JSON.stringify({
        text: inputMessage,
        replyTo: replyingTo ? { id: replyingTo.message.id, senderName: replyingTo.message.senderName, text: replyingTo.text } : undefined,
        attachments: await Promise.all(attachments.map(async (att) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({
              mediaType: att.type,
              mediaUrl: reader.result, // base64 temporarily
              fileName: att.file.name,
              fileSize: att.file.size
            });
            reader.readAsDataURL(att.file);
          });
        }))
      });

      let encryptedContent = payload;
      if (activeContext.type === 'space' && privateKey) {
        const { members, keys, missingMembers } = await getGroupKeyRecipients();
        if (members.length === 0 || missingMembers.length > 0) {
          setGroupKeyStatus('blocked');
          setGroupSecurityMessage(`Message held for privacy. Missing keys: ${missingMembers.map((member: any) => member.displayName || member.username || member.userId).join(', ') || 'group membership is still loading'}.`);
          return;
        }
        try {
          encryptedContent = await encryptGroupMessagePayload(payload, keys);
        } catch (e) {
          console.error('Group encryption failed', e);
          setGroupKeyStatus('error');
          setGroupSecurityMessage('Encryption failed. Please try again.');
          return;
        }
      } else if (recipientPubKey && user?.publicKey && privateKey) {
        try {
          const dualCipher = await encryptMessagePayload(payload, user.publicKey, recipientPubKey);
          encryptedContent = JSON.stringify({ e2ee: true, r: dualCipher.ciphertextForRecipient, s: dualCipher.ciphertextForSender });
        } catch (e) {
          encryptedContent = payload;
        }
      } else if (recipientPubKey && privateKey) {
        try {
          const forRecipient = await encryptText(payload, recipientPubKey);
          encryptedContent = forRecipient;
        } catch (e) {
          encryptedContent = payload;
        }
      }

      if (!isEncryptedEnvelope(encryptedContent)) {
        console.error('Message blocked: no recipient encryption key is available');
        return;
      }

      let roomId = 'dms';
      if (activeContext.type === 'dms' && activeContext.id && user?.userId) {
        roomId = [user.userId, activeContext.id].sort().join('_');
      } else if (activeContext.type === 'space' && activeContext.id) {
        roomId = activeContext.id;
      }

      const replyToId = replyingTo?.message?.id;
      const newMessage: Message = {
        id: clientMsgId, // temporary
        clientMsgId,
        roomId,
        senderId: user?.userId || '',
        senderName: user?.username || 'Unknown',
        content: encryptedContent,
        timestamp: new Date(),
        replyTo: replyToId
      };

      // Mark as uploading if has attachments
      const hasAttachments = attachments.length > 0;
      if (hasAttachments) {
        setUploadingMessages(prev => new Set(prev).add(clientMsgId));
      }

      // Save locally FIRST using clientMsgId and memory cache so `MessageItem` decrypts instantly
      cacheSentMessageMemory(clientMsgId, payload);
      saveSentMessageToDB(user.userId, clientMsgId, payload);

      setMessages(prev => [...prev, newMessage]);
      setReplyingTo(null);

      try {
        const res = await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ roomId, content: encryptedContent, clientMsgId, replyTo: replyToId })
        });
        const data = await res.json();
        if (data.ok && data.message) {
          cacheSentMessageMemory(data.message.id, payload);
          saveSentMessageToDB(user.userId, data.message.id, payload);
        } else {
          setMessages(prev => {
            const withoutFailed = prev.filter(message => message.id !== clientMsgId && message.clientMsgId !== clientMsgId);
            if (!data.systemMessage || withoutFailed.some(message => message.id === data.systemMessage.id)) return withoutFailed;
            return [...withoutFailed, data.systemMessage];
          });
        }
      } catch (err) {
        console.error('Failed to post message', err);
        setMessages(prev => prev.filter(message => message.id !== clientMsgId && message.clientMsgId !== clientMsgId));
      } finally {
        // Remove from uploading state
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(clientMsgId);
          return newSet;
        });
      }
    } catch (e) {
      console.error('Encryption failed', e);
    }
  };

  const sendMediaMessage = async (media: {
    mediaUrl: string;
    mediaType: string;
    text?: string;
    fileName?: string;
    fileSize?: number;
    stickerMaker?: { userId?: string; username?: string };
    durationMs?: number;
    waveform?: number[];
    voiceMessage?: boolean;
  }) => {
    if (!socket || !user) return;
    const payload = JSON.stringify({ text: '', ...media });

    let recipientPubKey = '';
    if (activeContext.type === 'dms' && activeContext.id) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/user/${activeContext.id}/public-key`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.ok) recipientPubKey = data.publicKey;
      } catch (e) { console.error(e) }
    }

    let encryptedContent = payload;
    if (activeContext.type === 'space' && privateKey) {
      let groupKeys: Record<string, string>;
      try {
        const { members, keys, missingMembers } = await getGroupKeyRecipients();
        if (members.length === 0 || missingMembers.length > 0) {
          setGroupKeyStatus('blocked');
          setGroupSecurityMessage(`Media held for privacy. Missing keys: ${missingMembers.map((member: any) => member.displayName || member.username || member.userId).join(', ') || 'group membership is still loading'}.`);
          return;
        }
        groupKeys = keys;
      } catch (error) {
        setGroupKeyStatus('error');
        setGroupSecurityMessage(error instanceof Error ? error.message : 'Could not check group encryption keys.');
        return;
      }
      try {
        encryptedContent = await encryptGroupMessagePayload(payload, groupKeys);
      } catch (e) {
        console.error('Group media encryption failed', e);
        setGroupKeyStatus('error');
        setGroupSecurityMessage('Media encryption failed. Please try again.');
        return;
      }
    } else if (recipientPubKey && user?.publicKey && privateKey) {
      try {
        const dualCipher = await encryptMessagePayload(payload, user.publicKey, recipientPubKey);
        encryptedContent = JSON.stringify({ e2ee: true, r: dualCipher.ciphertextForRecipient, s: dualCipher.ciphertextForSender });
      } catch (e) {
        console.error('Dual encryption failed, falling back to single encryption:', e);
        const forRecipient = await encryptText(payload, recipientPubKey);
        encryptedContent = forRecipient;
      }
    } else if (recipientPubKey && privateKey) {
      try {
        const forRecipient = await encryptText(payload, recipientPubKey);
        encryptedContent = forRecipient;
      } catch (e) {
        console.error('Single encryption failed:', e);
        encryptedContent = payload;
      }
    } else {
      console.warn('Encryption prerequisites not met:', { hasRecipientKey: !!recipientPubKey, hasSenderKey: !!user?.publicKey, hasPrivateKey: !!privateKey });
    }

    if (!isEncryptedEnvelope(encryptedContent)) {
      console.error('Media message blocked: no recipient encryption key is available');
      return;
    }

    try {
      const roomId = activeContext.type === 'dms' && activeContext.id && user?.userId
        ? [user.userId, activeContext.id].sort().join('_')
        : (activeContext.id || 'dms');

      const clientMsgId = Date.now().toString() + Math.random().toString();
      const newMessage: Message = {
        id: clientMsgId,
        clientMsgId,
        roomId,
        senderId: user?.userId || '',
        senderName: user?.username || 'Unknown',
        content: encryptedContent,
        timestamp: new Date()
      };

      // Mark as uploading for stickers/media
      setUploadingMessages(prev => new Set(prev).add(clientMsgId));

      cacheSentMessageMemory(clientMsgId, payload);
      saveSentMessageToDB(user.userId, clientMsgId, payload);

      setMessages(prev => [...prev, newMessage]);

      try {
        const res = await fetch(`${API_BASE}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ roomId, content: encryptedContent, clientMsgId })
        });
        const data = await res.json();
        if (data.ok && data.message) {
          cacheSentMessageMemory(data.message.id, payload);
          saveSentMessageToDB(user.userId, data.message.id, payload);
        }
      } catch (err) {
        console.error('Failed to post media message', err);
      } finally {
        // Remove from uploading state
        setUploadingMessages(prev => {
          const newSet = new Set(prev);
          newSet.delete(clientMsgId);
          return newSet;
        });
      }
    } catch (e) {
      console.error('Send media failed', e);
    }
  };

  const handleSendVoiceMessage = async (payload: { audioBlob: Blob; audioBase64: string; durationMs: number; waveform: number[] }) => {
    await sendMediaMessage({
      mediaUrl: payload.audioBase64,
      mediaType: 'audio',
      voiceMessage: true,
      durationMs: payload.durationMs,
      waveform: payload.waveform,
      fileName: `voice_${Date.now()}.webm`,
      fileSize: Math.round((payload.audioBase64.length * 3) / 4)
    });
  };

  // Actions
  const handleEditMessage = useCallback(async (message: Message, newText: string) => {
    try {
      if (activeContext.type !== 'dms') return;
      // Get recipient public key
      const res = await fetch(`${API_BASE}/api/auth/user/${activeContext.id}/public-key`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!data.ok) return;

      const payload = JSON.stringify({ text: newText });
      const encryptedContent = await encryptText(payload, data.publicKey);
      
      const updateRes = await fetch(`${API_BASE}/api/messages/${message.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ content: encryptedContent })
      });
      const updateData = await updateRes.json();
      if (updateData.ok && user) {
        saveSentMessageToDB(user.userId, message.id, payload);
      }
    } catch (e) { console.error(e); }
  }, [activeContext, user]);

  const handleDeleteConfirm = useCallback(async (forEveryone: boolean) => {
    if (!deleteMessage) return;
    try {
      if (forEveryone) {
        await fetch(`${API_BASE}/api/messages/${deleteMessage.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        // Local delete for me
        setMessages(prev => prev.filter(m => m.id !== deleteMessage.id));
      }
    } catch (e) { console.error(e); }
    setDeleteMessage(null);
  }, [deleteMessage]);

  const handleDeleteMsg = useCallback((msg: Message) => setDeleteMessage(msg), []);
  const handleForwardMsg = useCallback((msg: Message, txt: string) => setForwardMessage({ message: msg, text: txt }), []);
  const handleReplyMsg = useCallback((msg: Message, text: string) => setReplyingTo({ message: msg, text }), []);
  const handleImageClick = useCallback((url: string, msg: Message) => setPreviewImage({ url, message: msg }), []);

  const handleReactMessage = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ emoji })
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: data.reactions } : m));
      }
    } catch (e) {
      console.error('Failed to react to message', e);
    }
  }, []);

  const handleSaveSticker = useCallback((url: string, maker?: { userId?: string; username?: string }) => {
    const saved = JSON.parse(localStorage.getItem('custom-stickers') || '[]');
    const normalized = saved.map((sticker: any) => typeof sticker === 'string' ? { url: sticker } : sticker);
    if (!normalized.some((sticker: any) => sticker.url === url)) {
      normalized.push({ url, makerId: maker?.userId, makerUsername: maker?.username });
      localStorage.setItem('custom-stickers', JSON.stringify(normalized));
      window.dispatchEvent(new Event('saved-stickers-updated'));
    }
  }, []);

  const getSenderAvatar = useCallback((senderId: string) => {
    if (senderId === user?.userId) return user?.avatar;
    if (activeContext.type === 'space') return groupMembers.find(member => member.userId === senderId)?.avatar;
    return friends.find(friend => friend.userId === senderId)?.avatar;
  }, [activeContext.type, friends, groupMembers, user?.avatar, user?.userId]);

  const getSenderBadges = useCallback((senderId: string) => {
    if (senderId === user?.userId) return user?.badges;
    if (activeContext.type === 'space') return groupMembers.find(member => member.userId === senderId)?.badges;
    return friends.find(friend => friend.userId === senderId)?.badges;
  }, [activeContext.type, friends, groupMembers, user?.badges, user?.userId]);

  const getSenderMemberNumber = useCallback((senderId: string) => {
    if (senderId === user?.userId) return user?.memberNumber;
    if (activeContext.type === 'space') return groupMembers.find(member => member.userId === senderId)?.memberNumber;
    return friends.find(friend => friend.userId === senderId)?.memberNumber;
  }, [activeContext.type, friends, groupMembers, user?.memberNumber, user?.userId]);

  const refreshGroupKeys = useCallback(async (announceReady = false) => {
    if (activeContext.type !== 'space' || !activeContext.id) return;
    const groupKeyRequestId = ++groupKeyRequestRef.current;
    setIsRefreshingGroupKeys(true);
    setGroupKeyStatus('checking');
    if (announceReady) {
      setGroupSecurityMessage('Checking encryption keys for all group members...');
    }
    try {
      if (user?.publicKey) {
        const keyResponse = await fetch(`${API_BASE}/api/auth/user/public-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ publicKey: user.publicKey })
        });
        const keyData = await keyResponse.json();
        if (!keyResponse.ok || !keyData.ok) throw new Error(keyData.message || 'Could not register your encryption key.');
      }
      if (groupKeyRequestId !== groupKeyRequestRef.current) return;
      const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.group) throw new Error(data.message || 'Could not refresh member keys.');
      if (groupKeyRequestId !== groupKeyRequestRef.current) return;
      {
        const members = data.group.members.map((member: any) => ({
          ...member,
          nickname: data.group.nicknames?.[member.userId] || ''
        }));
        setGroupMembers(members);
        setCurrentUserRole(members.find((member: any) => member.userId === user?.userId)?.role || 'Member');
        setAllowMemberAdds(data.group.allowMemberAdds === true);
        setAllowMemberEditInfo(data.group.allowMemberEditInfo === true);
        setGroupDescription(data.group.description || '');
        
        // Get public keys from members who have them
        const keys: Record<string, string> = {};
        members.forEach((member: any) => {
          if (member.publicKey && member.userId) {
            keys[member.userId] = member.publicKey;
          }
        });
        
        setGroupPublicKeys(keys);
        
        // Update security message based on key availability
        const membersWithoutKeys = members.filter((member: any) => !member.publicKey).length;
        if (membersWithoutKeys === 0) {
          setGroupKeyStatus('ready');
          setGroupSecurityMessage(announceReady ? `Encryption ready. All ${members.length} members have keys.` : '');
        } else {
          const missingNames = members.filter((member: any) => !member.publicKey).map((member: any) => member.displayName || member.username || member.userId);
          setGroupKeyStatus('blocked');
          setGroupSecurityMessage(`Waiting for keys from ${missingNames.join(', ')}. Those members need to sign in once to publish an encryption key.`);
        }
      }
    } catch (e) {
      if (groupKeyRequestId !== groupKeyRequestRef.current) return;
      console.error('Failed to refresh group keys:', e);
      setGroupKeyStatus('error');
      setGroupSecurityMessage(e instanceof Error ? e.message : 'Failed to refresh keys. Please try again.');
    } finally {
      if (groupKeyRequestId === groupKeyRequestRef.current) setIsRefreshingGroupKeys(false);
    }
  }, [activeContext.id, activeContext.type, user?.publicKey, user?.userId]);

  useEffect(() => {
    if (!socket || activeContext.type !== 'space' || !activeContext.id) return;
    const handleMembersUpdated = (event: { groupId: string }) => {
      if (event.groupId === activeContext.id) void refreshGroupKeys(false);
    };
    const handleSettingsUpdated = (event: { groupId: string; allowMemberAdds: boolean; allowMemberEditInfo?: boolean; name?: string; description?: string }) => {
      if (event.groupId !== activeContext.id) return;
      setAllowMemberAdds(event.allowMemberAdds);
      if (event.allowMemberEditInfo !== undefined) setAllowMemberEditInfo(event.allowMemberEditInfo);
      if (event.description !== undefined) setGroupDescription(event.description);
      if (event.name !== undefined && event.name !== activeContext.name) setActiveContext({ ...activeContext, name: event.name });
    };
    socket.on('group:members-updated', handleMembersUpdated);
    socket.on('group:settings-updated', handleSettingsUpdated);
    return () => {
      socket.off('group:members-updated', handleMembersUpdated);
      socket.off('group:settings-updated', handleSettingsUpdated);
    };
  }, [socket, activeContext.id, activeContext.type, refreshGroupKeys]);

  if (!activeContext.id && activeContext.type === 'dms') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 text-center relative h-full bg-[var(--app-bg)]">
        <div className="w-12 h-12 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center mb-5">
          <MessageCircle className="w-5 h-5 text-[var(--app-accent)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Your conversations</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">
          Choose a recent message or start a conversation with a friend.
        </p>
        {friends.length > 0 ? (
          <div className="w-full max-w-md divide-y divide-[var(--app-border)] border-y border-[var(--app-border)] text-left">
            {friends.slice(0, 4).map(friend => (
              <button key={friend.userId} onClick={() => setActiveContext({ type: 'dms', id: friend.userId })} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--app-surface-hover)]">
                <span className="w-9 h-9 rounded-full bg-[var(--app-accent)]/15 text-[var(--app-accent)] flex items-center justify-center font-semibold overflow-hidden">
                  {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{nicknames?.[friend.userId] || friend.displayName || friend.username}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">@{friend.username}</span>
                </span>
                <MessageCircle className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">Add friends to start a direct message.</p>
        )}
      </div>
    );
  }
  // Key loading gatekeeper - prevent decryption before private key is ready
  if (!isPrivateKeyReady && activeContext.id) {
    const needsPasswordRecovery = Boolean(keyInitializationError && (keyInitializationError.includes('Sign out and sign in') || keyInitializationError.includes('Check your password')));
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative h-full" aria-live="polite">
        <div className="w-12 h-12 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center mb-4">
          <MessageCircle className="w-5 h-5 text-[var(--app-accent)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{keyInitializationError ? 'Secure setup needs attention' : 'Setting up encryption'}</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-md">
          {keyInitializationError || 'Loading your device key and confirming its public key with Space.'}
        </p>
        {keyInitializationError && (
          <button
            type="button"
            onClick={async () => {
              if (needsPasswordRecovery) {
                logout();
                return;
              }
              setIsRetryingKeySetup(true);
              await retryKeyInitialization();
              setIsRetryingKeySetup(false);
            }}
            disabled={isRetryingKeySetup}
            className="rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-[#10201d] disabled:opacity-60"
          >
            {isRetryingKeySetup ? 'Retrying...' : needsPasswordRecovery ? 'Return to sign in' : 'Retry secure setup'}
          </button>
        )}
      </div>
    );
  }

  const isDms = activeContext.type === 'dms';
  const isSavedMessages = isDms && activeContext.id === user?.userId;
  const friend = isDms && !isSavedMessages ? friends.find(f => f.userId === activeContext.id) : null;
  const displayName = friend ? (nicknames?.[friend.userId] || friend.displayName || friend.username) : null;
  const chatTitle = isSavedMessages
    ? 'Saved Messages'
    : isDms
    ? (displayName || 'Conversation')
    : (activeContext.name || spaces?.find(s => s.id === activeContext.id)?.name || 'Space');

  // Check if this is a one-time message conversation
  const isOneTimeMessage = isDms && !isSavedMessages && activeContext.id && 
    localStorage.getItem(`oneTimeMessage_${activeContext.id}`) === 'true';

  return (
    <div className="h-full w-full min-w-0 max-w-full flex flex-col bg-transparent text-[var(--text-primary)] overflow-hidden font-sans" data-chat-room={activeContext.id || 'saved-messages'}>
      {/* Chat Header */}
      <div className="min-h-16 px-3 sm:px-6 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel)] shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {isMobile && (
            <button
              type="button"
              onClick={() => setActiveContext({ type: 'dms' })}
              aria-label="Back to conversations"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] active:scale-90 transition-all shrink-0 -ml-1 touch-manipulation"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity min-w-0 flex-1 overflow-hidden" onClick={() => {
            if (isSavedMessages) {
              // Don't open profile for saved messages
            } else if (isDms && friend && onViewProfile) {
              onViewProfile(friend);
            } else if (!isDms) {
              setShowGroupInfoModal(true);
            }
          }}>
            {isSavedMessages ? (
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--app-accent)]/20 flex items-center justify-center shadow-sm">
                <MessageCircle className="w-4.5 h-4.5 text-[var(--app-accent)]" />
              </div>
            ) : isDms && friend ? (
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden">
                  {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--app-accent)]/20 flex items-center justify-center shadow-sm">
                <Hash className="w-4.5 h-4.5 text-[var(--app-accent)]" />
              </div>
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              <h2 className="text-[var(--text-primary)] font-semibold text-sm truncate">{chatTitle}</h2>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">{isDms ? 'Direct message · End-to-end encrypted' : `${groupMembers.length} members · End-to-end encrypted`}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activeContext.id && !isSavedMessages && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (call) call.startCall(currentRoomId, 'audio');
                }}
                disabled={Boolean(call?.activeCall)}
                title="Start Voice Call"
                aria-label="Start Voice Call"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-emerald-400 transition-colors disabled:opacity-40"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (call) call.startCall(currentRoomId, 'video');
                }}
                disabled={Boolean(call?.activeCall)}
                title="Start Video Call"
                aria-label="Start Video Call"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-indigo-400 transition-colors disabled:opacity-40"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          {!isDms && (
            <button onClick={() => setShowMembersSidebar(value => !value)} title="Members" aria-label="Toggle member list" className={`w-9 h-9 rounded-lg flex items-center justify-center ${showMembersSidebar ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'}`}>
              <Users className="w-4 h-4" />
            </button>
          )}
          {activeContext.id && !isSavedMessages && (
            <button
              type="button"
              onClick={() => {
                const next = !isConversationMuted;
                setIsConversationMuted(next);
                localStorage.setItem(`space_muted_${isDms ? 'dm' : 'group'}_${activeContext.id}`, String(next));
              }}
              title={isConversationMuted ? 'Unmute conversation notifications' : 'Mute conversation notifications'}
              aria-label={isConversationMuted ? 'Unmute conversation notifications' : 'Mute conversation notifications'}
              aria-pressed={isConversationMuted}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
            >
              {isConversationMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setShowWallpaperModal(true)}
            title="Chat wallpaper & background"
            aria-label="Chat wallpaper"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          {isDms && !isSavedMessages && (
            <button
              onClick={() => setShowChatAppearance(true)}
              title="Personalize this conversation"
              aria-label="Personalize this conversation"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => isDms && friend ? onViewProfile?.(friend) : setShowGroupInfoModal(true)} title={isDms ? 'View profile' : 'Space details'} aria-label={isDms ? 'View profile' : 'Space details'} className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]">
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Call Banner */}
      {roomCall && roomCall.status !== 'ended' && (
        <div className="w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-emerald-600/30 border-b border-emerald-500/40 px-4 py-2.5 flex items-center justify-between text-xs font-medium text-emerald-200 backdrop-blur-md shrink-0 z-10 shadow-inner">
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399] shrink-0" />
            <span className="font-bold text-emerald-100 truncate">{roomCall.kind === 'group' ? 'Group Call in Progress' : 'Call in Progress'}</span>
            <span className="text-emerald-300/80 shrink-0">({roomCall.participants?.length || 1} participant{roomCall.participants?.length === 1 ? '' : 's'})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {call?.activeCall?.id === roomCall.id ? (
              <button
                type="button"
                onClick={() => call?.expandCall()}
                className="px-3 py-1 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 border border-emerald-400/40 font-bold transition shadow-sm"
              >
                View Call
              </button>
            ) : (
              <button
                type="button"
                onClick={() => call?.joinRoomCall(roomCall.id)}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold transition shadow-md"
              >
                Join Call
              </button>
            )}
          </div>
        </div>
      )}

      {/* One-Time Message Banner */}
      {isOneTimeMessage && (
        <div className="w-full min-w-0 max-w-full overflow-hidden bg-[var(--app-accent)]/10 border-b border-[var(--app-accent)]/30 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 text-sm min-w-0 truncate">
            <Info className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
            <p className="text-[var(--app-accent)] truncate">
              This is a one-time message conversation. You can send one message every 3 days.
            </p>
          </div>
        </div>
      )}

      {/* Pending Message Request Banner */}
      {pendingMessageRequest && (
        <div className="w-full min-w-0 max-w-full overflow-hidden bg-[var(--app-accent)]/10 border-b border-[var(--app-accent)]/30 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-4 min-w-0 max-w-full">
            <div className="flex items-center gap-2 text-sm min-w-0 flex-1 truncate">
              <MessageCircle className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
              <p className="text-[var(--app-accent)] truncate">
                {pendingMessageRequest.senderId === user?.userId 
                  ? 'You sent a one-time message request. Waiting for response.' 
                  : 'You have a pending one-time message request.'}
              </p>
            </div>
            {pendingMessageRequest.senderId !== user?.userId && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={async () => {
                    try {
                      const roomId = [user?.userId, pendingMessageRequest.senderId].sort().join('_');
                      const response = await fetch(`${API_BASE}/api/auth/conversations/${roomId}/decline`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ blockUser: false })
                      });
                      const data = await response.json();
                      if (data.ok) {
                        setPendingMessageRequest(null);
                        setActiveContext({ type: 'dms', id: undefined });
                      }
                    } catch (e) {
                      console.error('Failed to decline request:', e);
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_BASE}/api/auth/messages/request/action`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ requestId: pendingMessageRequest.id, action: 'accept' })
                      });
                      const data = await response.json();
                      if (data.ok) {
                        setPendingMessageRequest(null);
                        // Reload messages to get the conversation with the original message
                        const roomId = [user?.userId, pendingMessageRequest.senderId].sort().join('_');
                        fetch(`${API_BASE}/api/messages/${roomId}`, {
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                        })
                        .then(res => res.json())
                        .then(data => {
                          if (data.ok) {
                            setMessages(data.messages);
                          }
                        })
                        .catch(console.error);
                      }
                    } catch (e) {
                      console.error('Failed to accept request:', e);
                    }
                  }}
                  className="px-3 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Accept
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0 max-w-full w-full bg-[var(--app-bg)] relative z-10 border-0 border-l border-[var(--app-border)]">
        {/* Chat Wallpaper Background Layer */}
        {activeWallpaper && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div 
              className="w-full h-full bg-cover bg-center transition-all duration-300"
              style={{
                backgroundImage: `url(${activeWallpaper.url})`,
                filter: `blur(${activeWallpaper.blur || 0}px)`,
                transform: `scale(${activeWallpaper.zoom || 1}) translate(${activeWallpaper.panX || 0}%, ${activeWallpaper.panY || 0}%)`,
                opacity: 1 - ((activeWallpaper.dim || 0) / 100),
              }}
            />
            {activeWallpaper.texture && (
              <div 
                className="absolute inset-0 bg-repeat opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              />
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative z-10">
          {/* Message Stream */}
          <div ref={messageContainerRef} className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 max-w-full relative z-0 bg-transparent ${isMobile ? 'px-2 py-3 space-y-1 no-scrollbar' : 'px-4 py-6 space-y-1 custom-scrollbar'}`}>
            {memoizedMessages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                customEmojis={customSpaceEmojis}
                isMine={message.senderId === user?.userId}
                painterRole={isDms ? (message.senderId === user?.userId ? 'dm-own-bubble' : 'dm-other-bubble') : (message.senderId === user?.userId ? 'group-own-bubble' : 'group-other-bubble')}
                privateKey={privateKey || null}
                onDelete={handleDeleteMsg}
                onForward={handleForwardMsg}
                onReply={handleReplyMsg}
                onEdit={handleEditMessage}
                onImageClick={handleImageClick}
                onReact={handleReactMessage}
                onSaveSticker={handleSaveSticker}
                onUnblockUser={async (targetUserId) => {
                  const response = await fetch(`${API_BASE}/api/auth/friends/unblock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ targetUserId })
                  });
                  const data = await response.json();
                  if (!response.ok || !data.ok) throw new Error(data.message || 'Could not unblock this user.');
                  window.alert('User unblocked. You are no longer blocked, but you will need to become friends again before sending DMs.');
                }}
                onReportUser={async (targetUserId) => {
                  const response = await fetch(`${API_BASE}/api/v1/reports`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ reportedUserId: targetUserId, reason: 'Unwanted contact', details: 'Reported from a blocked direct message.' })
                  });
                  const data = await response.json();
                  if (!response.ok || !data.ok) throw new Error(data.message || 'Could not submit this report.');
                }}
                senderAvatar={getSenderAvatar(message.senderId)}
                senderBadges={getSenderBadges(message.senderId)}
                senderMemberNumber={getSenderMemberNumber(message.senderId)}
                currentUserId={user?.userId}
                isUploading={uploadingMessages.has(message.id) || uploadingMessages.has(message.clientMsgId || '')}
                onProfileClick={async (userId, username) => {
                  if (onViewProfile) {
                    if (userId === user?.userId) return onViewProfile(user);
                    // Try to find in friends first
                    const f = friends.find(f => f.userId === userId);
                    if (f) return onViewProfile(f);
                    const member = groupMembers.find(groupMember => groupMember.userId === userId);
                    if (member) return onViewProfile(member);
                    // If not in friends, fetch it
                    try {
                      const res = await fetch(`${API_BASE}/api/auth/search?q=${encodeURIComponent(username || message.senderName)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }});
                      const data = await res.json();
                      if (data.ok && data.users.length) onViewProfile(data.users[0]);
                    } catch (error) {
                      console.error('Failed to load profile:', error);
                    }
                  }
                }}
              />
            ))}
            {Object.keys(memoizedTypingUsers).length > 0 && (
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[var(--app-accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span>{Object.values(memoizedTypingUsers).map(t => t.username).join(', ')} {Object.keys(memoizedTypingUsers).length === 1 ? 'is' : 'are'} typing...</span>
                </div>
              </div>
            )}
            {groupSecurityMessage && groupKeyStatus !== 'ready' && activeContext.type === 'space' && (
              <div className={`mx-3 mb-3 rounded-lg border px-3 py-2 text-xs ${groupKeyStatus === 'checking' ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent)]/10 text-[var(--text-primary)]' : 'border-red-500/30 bg-red-500/10 text-red-200'}`} role="status" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <span>{groupSecurityMessage}</span>
                  <button type="button" onClick={() => void refreshGroupKeys(true)} disabled={isRefreshingGroupKeys} className="shrink-0 rounded-md border border-current/30 px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-50">
                    {isRefreshingGroupKeys ? 'Checking...' : 'Check keys again'}
                  </button>
                </div>
              </div>
            )}
            {memoizedMessages.length === 0 && (
              <div className="min-h-[280px] h-full text-center text-[var(--text-secondary)] flex flex-col items-center justify-center px-6">
                <div className="w-12 h-12 mb-4 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[var(--app-accent)]" />
                </div>
                <p className="text-base font-semibold text-[var(--text-primary)]">No messages yet</p>
                <p className="text-sm mt-1">Send an encrypted message to start the conversation.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendVoiceMessage={handleSendVoiceMessage}
        showGifPicker={showGifPicker}
        setShowGifPicker={setShowGifPicker}
        onGifSelect={(url) => { console.log('GIF select callback:', url); sendMediaMessage({ mediaUrl: url, mediaType: 'gif' }); setShowGifPicker(false); }}
        onStickerSelect={(sticker) => { sendMediaMessage({ text: sticker.name || sticker.associatedEmoji || 'Sticker', mediaUrl: sticker.url, mediaType: 'sticker', spaceId: sticker.spaceId, spaceName: sticker.spaceName, stickerMaker: { userId: sticker.makerId, username: sticker.makerUsername } } as any); setShowGifPicker(false); }}
        customEmojis={customSpaceEmojis}
        customStickers={customSpaceStickers}
        customAssetsError={customSpaceAssetError}
        stickerMaker={{ userId: user?.userId || '', username: user?.username || '' }}
        disabled={activeContext.type === 'request'}
        replyingTo={replyingTo ? replyingTo.message : null}
        replyingToText={replyingTo ? replyingTo.text : ''}
        setReplyingTo={(val) => setReplyingTo(val ? { message: val, text: '' } : null)}
        socket={socket}
        roomId={activeContext.type === 'dms' && activeContext.id && user?.userId ? [user.userId, activeContext.id].sort().join('_') : activeContext.id || 'dms'}
      />
      </div>

      <AnimatePresence>
        {showMembersSidebar && !isDms && (
          <GroupMemberSidebar
            members={groupMembers}
            currentUserRole={currentUserRole}
            currentUserId={user?.userId || ''}
            onClose={() => setShowMembersSidebar(false)}
            onViewProfile={onViewProfile}
            onKickMember={async (userId) => {
              try {
                const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/kick`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify({ targetUserId: userId })
                });
                const data = await response.json();
                if (!response.ok || !data.ok) throw new Error(data.message || 'Could not remove this member.');
                setGroupMembers(prev => prev.filter(m => m.userId !== userId));
              } catch (error) {
                throw error instanceof Error ? error : new Error('Could not remove this member.');
              }
            }}
            onUpdateRole={async (userId, newRole) => {
              try {
                const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/roles`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify({ targetUserId: userId, newRole })
                });
                const data = await response.json();
                if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update this member role.');
                setGroupMembers(prev => prev.map(m => {
                  if (m.userId === userId) return { ...m, role: newRole };
                  if (newRole === 'Owner' && m.userId === user?.userId) return { ...m, role: 'Admin' };
                  return m;
                }));
                if (newRole === 'Owner') setCurrentUserRole('Admin');
              } catch (error) {
                throw error instanceof Error ? error : new Error('Could not update this member role.');
              }
            }}
            onSetNickname={async (userId, nickname) => {
              const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/nickname`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ targetUserId: userId, nickname })
              });
              const data = await response.json();
              if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save this nickname.');
              setGroupMembers(prev => prev.map(member => member.userId === userId
                ? { ...member, nickname: nickname.trim() }
                : member
              ));
            }}
          />
        )}
      </AnimatePresence>
      </div>

      {/* Modals */}
      <DeleteMessageModal 
        isOpen={!!deleteMessage} 
        onClose={() => setDeleteMessage(null)}
        isMine={deleteMessage?.senderId === user?.userId}
        onConfirm={handleDeleteConfirm}
      />
      
      <ForwardMessageModal 
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        friends={friends}
        messageText={forwardMessage?.text || ''}
      />
      {previewImage && (
        <ImagePreviewModal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          message={previewImage.message}
          onForward={() => {
            const txt = previewImage.url;
            setForwardMessage({ message: previewImage.message, text: txt });
            setPreviewImage(null);
          }}
          onJumpToMessage={() => {
            document.getElementById(`message-${previewImage.message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setPreviewImage(null);
          }}
        />
      )}

      <GroupInfoModal
        isOpen={showGroupInfoModal}
        onClose={() => setShowGroupInfoModal(false)}
        groupName={activeContext.name || 'Group Chat'}
        groupDescription={groupDescription}
        groupId={activeContext.id || ''}
        createdBy={groupCreatedBy}
        createdByAvatar={groupCreatedByAvatar}
        createdByUsername={groupCreatedByUsername}
        createdByUserId={groupCreatedBy}
        createdAt={groupCreatedAt}
        memberCount={groupMembers.length}
        currentMemberIds={groupMembers.map(member => member.userId)}
        currentUserRole={currentUserRole}
        allowMemberAdds={allowMemberAdds}
        allowMemberEditInfo={allowMemberEditInfo}
        friends={friends}
        onAddMembers={async (memberIds) => {
          const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ memberIds })
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not add friends to this group.');
          await refreshGroupKeys(false);
        }}
        onSetAllowMemberAdds={async (allow) => {
          const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ allowMemberAdds: allow })
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update group invite permissions.');
          setAllowMemberAdds(data.allowMemberAdds);
        }}
        onSetAllowMemberEditInfo={async (allow) => {
          const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ allowMemberEditInfo: allow })
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update group permissions.');
          setAllowMemberEditInfo(data.allowMemberEditInfo);
        }}
        onUpdateGroupDetails={async details => {
          const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(details)
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update group details.');
          setGroupDescription(data.description || '');
          setActiveContext({ ...activeContext, name: data.name });
        }}
        onShowMembers={() => setShowMembersSidebar(true)}
        onViewProfile={(userId) => {
          const ownerMember = groupMembers.find(m => m.userId === userId);
          if (ownerMember && onViewProfile) onViewProfile(ownerMember);
        }}
        onLeaveGroup={async () => {
            const response = await fetch(`${API_BASE}/api/groups/${activeContext.id}/leave`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not leave this group.');
            setActiveContext({ type: 'dms' });
        }}
        onReportGroup={async () => {
          if (!groupCreatedBy) return;
          const details = window.prompt(`Describe the group owner's behavior you want to report in ${activeContext.name || 'this group'}:`);
          if (!details?.trim()) return;
          try {
            const response = await fetch(`${API_BASE}/api/v1/reports`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({
                reportedUserId: groupCreatedBy,
                reason: 'Group owner conduct',
                details: `Group: ${activeContext.name || activeContext.id}\n${details.trim()}`
              })
            });
            const data = await response.json();
            if (!data.ok) throw new Error(data.message || 'Report could not be submitted.');
            setShowGroupInfoModal(false);
            window.alert('Report submitted. Thank you for helping keep Space safe.');
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Report could not be submitted.');
          }
        }}
      />

      {/* Chat Wallpaper Cropper Modal */}
      {showChatAppearance && activeContext.id && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowChatAppearance(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dm-appearance-title"
            className="w-full max-w-md space-y-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5 text-[var(--text-primary)] shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="dm-appearance-title" className="text-base font-bold">This conversation only</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">These bubble styles override your global theme and Painter Mode for this DM.</p>
              </div>
              <button type="button" onClick={() => setShowChatAppearance(false)} aria-label="Close conversation appearance" className="rounded-lg p-2 hover:bg-[var(--app-surface-hover)]">
                <X className="h-4 w-4" />
              </button>
            </header>
            {(['dm-other-bubble', 'dm-own-bubble'] as const).map((role, index) => {
              const style = chatStyles[activeContext.id!]?.[role] || {};
              const label = index === 0 ? 'Their messages' : 'Your messages';
              const fallback = index === 0 ? '#334155' : '#0288d1';
              return (
                <div key={role} className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <label className="flex items-center justify-between gap-3 text-xs">
                    <span>Bubble color</span>
                    <input
                      type="color"
                      aria-label={`${label} bubble color`}
                      value={style.backgroundColor?.startsWith('#') ? style.backgroundColor : fallback}
                      onChange={event => setChatStyle(activeContext.id!, role, { ...style, backgroundColor: event.target.value, backgroundGradient: '' })}
                      className="h-8 w-10 cursor-pointer rounded border border-[var(--app-border)] bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-xs">
                    <span>Text color</span>
                    <input
                      type="color"
                      aria-label={`${label} text color`}
                      value={style.textColor?.startsWith('#') ? style.textColor : '#ffffff'}
                      onChange={event => setChatStyle(activeContext.id!, role, { ...style, textColor: event.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-[var(--app-border)] bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-xs">
                    <span>Bubble gradient</span>
                    <select
                      value={style.backgroundGradient || ''}
                      onChange={event => setChatStyle(activeContext.id!, role, { ...style, backgroundGradient: event.target.value, backgroundColor: '' })}
                      className="max-w-48 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-2 py-1.5 text-xs text-[var(--text-input)]"
                    >
                      <option value="">Solid color</option>
                      <option value="linear-gradient(135deg, #ff7e5f, #feb47b)">Warm sunset</option>
                      <option value="linear-gradient(135deg, #2193b0, #6dd5ed)">Ocean</option>
                      <option value="linear-gradient(135deg, #7f00ff, #e100ff)">Violet</option>
                      <option value="linear-gradient(135deg, var(--app-accent), var(--app-accent-hover))">Current accent</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0">Roundness</span>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      value={parseInt(style.borderRadius || '16px', 10)}
                      onChange={event => setChatStyle(activeContext.id!, role, { ...style, borderRadius: `${event.target.value}px` })}
                      className="min-w-0 flex-1 accent-[var(--app-accent)]"
                    />
                    <span className="w-10 text-right text-[var(--text-secondary)]">{parseInt(style.borderRadius || '16px', 10)}px</span>
                  </label>
                </div>
              );
            })}
            <label className="flex items-center justify-between gap-3 text-xs">
              <span>Wallpaper</span>
              <button type="button" onClick={() => { setShowChatAppearance(false); setShowWallpaperModal(true); }} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 font-semibold text-white">
                Customize wallpaper
              </button>
            </label>
            <footer className="flex justify-between border-t border-[var(--app-border)] pt-4">
              <button type="button" onClick={() => clearChatStyles(activeContext.id!)} className="text-xs font-semibold text-rose-500 hover:underline">Reset conversation styles</button>
              <button type="button" onClick={() => setShowChatAppearance(false)} className="rounded-lg bg-[var(--app-surface-hover)] px-4 py-2 text-xs font-semibold">Done</button>
            </footer>
          </section>
        </div>
      )}
      <ImageCropModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        mode="wallpaper"
        initialImage={activeWallpaper?.url || ''}
        targetTitle={`Wallpaper for ${chatTitle}`}
        onApply={(result: CropResult) => {
          if (activeContext.id) {
            setWallpaper(String(activeContext.id), {
              url: result.url,
              zoom: result.zoom,
              panX: result.panX,
              panY: result.panY,
              dim: result.dim || 0,
              blur: result.blur || 0,
              texture: !!result.texture
            });
          }
        }}
      />
    </div>
  );
}

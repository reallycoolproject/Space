import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { io, Socket } from 'socket.io-client'
import { Settings, X, Menu, Search, MessageCircle, Bell, UserCheck, UserPlus, Users, Hash, Plus, CheckCircle2, UserX, Globe2, Video } from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary'

import SettingsModal from './SettingsModal'
import type { User, ActiveContext } from '../types/chat'
import { ChatWindow } from './chat/ChatWindow'
import { SpaceView } from './spaces/SpaceView'
import { GroupChatCreationModal } from './chat/GroupChatCreationModal'
import { UserProfileModal } from './UserProfileModal'
import { useDeviceDetection } from '../hooks/useDeviceDetection'
import { API_BASE, SOCKET_URL } from '../config'
import { decryptText } from '../utils/crypto'
import { CallProvider } from '../calls/CallContext'
import { CallOverlay } from '../calls/CallOverlay'
import VoiceVideoCall from '../calls/VoiceVideoCall'
import { useThemeCustomization } from '../contexts/ThemeContext'

const formatConversationTime = (value: string | Date) => {
  const date = new Date(value)
  const today = new Date()
  const isSameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  if (isSameDay) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const daysAgo = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000)
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const parseSpaceInviteCode = (input: string) => {
  const value = input.trim()
  if (!value) return ''
  try {
    const url = new URL(value)
    const queryCode = url.searchParams.get('invite')
    if (queryCode) return queryCode.trim()
    const pathSegments = url.pathname.split('/').filter(Boolean)
    return pathSegments.at(-1) || ''
  } catch {
    const queryMatch = /[?&]invite=([^&#]+)/i.exec(value)
    if (queryMatch) return decodeURIComponent(queryMatch[1]).trim()
    return value.replace(/^(?:invite|code):\s*/i, '').trim()
  }
}

const SPACE_DISCOVERY_CATEGORIES = ['Gaming', 'Music', 'Education', 'Science', 'Entertainment', 'Technology', 'Art & Design', 'Other']

interface PublicSpaceCard {
  id: string
  name: string
  description: string
  icon: string
  banner: string
  category: string
  tags: string[]
  memberCount: number
  channelCount: number
}

interface PublicSpacePreview extends Omit<PublicSpaceCard, 'channelCount'> {
  channels: Array<{ id: string; name: string; type: string; topic: string; category: string }>
}

export default function Dashboard() {
  const { user, setUser, privateKey, isAuthenticated, token } = useAuth()
  const notificationStorageKey = `space_message_notifications_${user?.userId || 'guest'}`
  const { isMobile } = useDeviceDetection()
  const [activeContext, setActiveContext] = useState<ActiveContext>({ type: 'dms' })
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [friends, setFriends] = useState<User[]>([])
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null)
  const [messageRequests, setMessageRequests] = useState<any[]>([])
  const [friendRequests, setFriendRequests] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false)
  const [notificationTab, setNotificationTab] = useState<'all' | 'mentions'>('all')
  const [messageJump, setMessageJump] = useState<{ messageId: string; threadId?: string } | null>(null)
  const [messageNotifications, setMessageNotifications] = useState<Array<{ id: string; roomId: string; senderId: string; senderName: string; groupName?: string; type?: 'message' | 'mention'; messageId?: string; createdAt: string; readAt?: string }>>(() => {
    try {
      const saved = localStorage.getItem(notificationStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showFriendsPanel, setShowFriendsPanel] = useState(false)
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false)
  const [addFriendsSearchQuery, setAddFriendsSearchQuery] = useState('')
  const [addFriendsSearchResults, setAddFriendsSearchResults] = useState<any[]>([])
  const [isAddFriendsSearching, setIsAddFriendsSearching] = useState(false)
  const [friendsTab, setFriendsTab] = useState<'online' | 'all' | 'requests' | 'blocked'>('all')
  const [mainView, setMainView] = useState<'chat' | 'friends'>('chat')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { isPainterMode } = useThemeCustomization()

  useEffect(() => {
    if (isPainterMode) {
      setIsSettingsOpen(false)
    }
  }, [isPainterMode])
  useEffect(() => {
    const handleOpenVoice = (event: any) => {
      const detail = event?.detail;
      if (detail && detail.spaceId && detail.channelId) {
        setActiveContext({ type: 'server', id: detail.spaceId, channelId: detail.channelId });
        setMainView('chat');
      }
    };
    window.addEventListener('space:open-voice', handleOpenVoice);
    return () => window.removeEventListener('space:open-voice', handleOpenVoice);
  }, []);

  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [oneTimeMessageModal, setOneTimeMessageModal] = useState<{ userId: string; username: string } | null>(null)
  const [oneTimeMessageContent, setOneTimeMessageContent] = useState('')
  const [userCooldowns, setUserCooldowns] = useState<{ targetUserId: string; lastSent: Date }[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [blockedUserProfiles, setBlockedUserProfiles] = useState<User[]>([])
  const [acceptedUsers, setAcceptedUsers] = useState<string[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [conversationSearchQuery, setConversationSearchQuery] = useState('')
  const [spaces, setSpaces] = useState<any[]>([])
  const [communitySpaces, setCommunitySpaces] = useState<any[]>([])
  const [showGroupCreation, setShowGroupCreation] = useState(false)
  const [showSpaceEntry, setShowSpaceEntry] = useState(false)
  const [showPublicSpaceExplorer, setShowPublicSpaceExplorer] = useState(false)
  const [publicSpaces, setPublicSpaces] = useState<PublicSpaceCard[]>([])
  const [isLoadingPublicSpaces, setIsLoadingPublicSpaces] = useState(false)
  const [publicSpaceQuery, setPublicSpaceQuery] = useState('')
  const [publicSpaceCategory, setPublicSpaceCategory] = useState('')
  const [previewSpace, setPreviewSpace] = useState<PublicSpacePreview | null>(null)
  const [isLoadingSpacePreview, setIsLoadingSpacePreview] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDescription, setNewSpaceDescription] = useState('')
  const [spaceCreationScope, setSpaceCreationScope] = useState<'friends' | 'community'>('friends')
  const [newSpaceCategory, setNewSpaceCategory] = useState('Gaming')
  const [newSpaceTags, setNewSpaceTags] = useState('')
  const [newSpaceIsPublic, setNewSpaceIsPublic] = useState(false)
  const [newSpaceIcon, setNewSpaceIcon] = useState<File | null>(null)
  const [spaceInviteCode, setSpaceInviteCode] = useState('')
  const [spaceEntryError, setSpaceEntryError] = useState('')
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const widgetJoinAttemptRef = useRef('')

  useEffect(() => {
    const dismissStatusMenu = (event: PointerEvent) => {
      if (event.target instanceof Node && !statusMenuRef.current?.contains(event.target)) {
        setIsStatusMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismissStatusMenu)
    return () => document.removeEventListener('pointerdown', dismissStatusMenu)
  }, [])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const updatePresence = async (status: 'active' | 'inactive' | 'dnd') => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE}/api/auth/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!data.ok) throw new Error(data.message || 'Could not update status')
      setUser({ ...user, status })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update status', 'error')
    } finally {
      setIsStatusMenuOpen(false)
    }
  }

  const loadFriends = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/friends`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      const data = await response.json()
      if (data.ok) setFriends(data.friends)
    } catch (e) { console.error(e) }
  }

  const loadMessageNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load notifications.')
      const visibleNotifications = data.notifications.filter((notification: { roomId: string; groupName?: string }) => {
        const type = notification.groupName ? 'group' : 'dm';
        return localStorage.getItem(`space_muted_${type}_${notification.roomId}`) !== 'true';
      })
      setMessageNotifications(visibleNotifications)
      localStorage.setItem(notificationStorageKey, JSON.stringify(visibleNotifications))
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/conversations`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      const data = await response.json()
      if (data.ok) {
        const withPreviews = await Promise.all(data.conversations.map(async (conversation: any) => {
          const lastMessage = conversation.lastMessage
          if (!lastMessage?.content) return conversation
          if (lastMessage.isSystemMessage) {
            return { ...conversation, lastMessage: { ...lastMessage, preview: lastMessage.content } }
          }

          let preview = lastMessage.senderId === user?.userId ? 'You sent a message' : 'Encrypted message'
          if (privateKey) {
            try {
              let ciphertext = lastMessage.content
              const envelope = JSON.parse(lastMessage.content)
              if (envelope.e2ee) {
                ciphertext = (envelope.s || envelope.r) ? (lastMessage.senderId === user?.userId ? envelope.s : envelope.r) : lastMessage.content
              }
              const plaintext = await decryptText(ciphertext, privateKey, user?.userId)
              const payload = JSON.parse(plaintext)
              if (typeof payload.text === 'string' && payload.text.trim()) preview = payload.text.trim()
              else if (payload.mediaType === 'image') preview = 'Photo'
              else if (payload.mediaType === 'video') preview = 'Video'
              else if (payload.mediaType === 'audio') preview = 'Audio message'
              else if (payload.mediaType === 'gif') preview = 'GIF'
              else if (payload.mediaType === 'sticker') preview = 'Sticker'
              else if (payload.fileName) preview = payload.fileName
              else preview = 'Attachment'
            } catch {
              if (lastMessage.senderId !== user?.userId) preview = 'Encrypted message'
            }
          }
          return { ...conversation, lastMessage: { ...lastMessage, preview } }
        }))
        setConversations(withPreviews)
      }
    } catch (e) { console.error(e) }
  }

  const loadSpaces = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/groups/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await response.json();
      if (data.ok) setSpaces(data.groups || []);
    } catch (error) { console.error('Failed to load groups', error); }
  }

  const loadCommunitySpaces = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/me`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load Spaces.')
      setCommunitySpaces(data.spaces || [])
    } catch (error) {
      console.error('Failed to load Spaces:', error)
    }
  }

  const loadPublicSpaces = async (query = '', category = '') => {
    setIsLoadingPublicSpaces(true)
    setSpaceEntryError('')
    try {
      const search = new URLSearchParams()
      if (query.trim()) search.set('q', query.trim())
      if (category) search.set('category', category)
      const queryString = search.size ? `?${search.toString()}` : ''
      const response = await fetch(`${API_BASE}/api/spaces/explore${queryString}`, { headers: { Authorization: 'Bearer ' + (token || '') } })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load public Spaces.')
      setPublicSpaces(data.spaces || [])
      setShowPublicSpaceExplorer(true)
    } catch (error) {
      setSpaceEntryError(error instanceof Error ? error.message : 'Could not load public Spaces.')
    } finally {
      setIsLoadingPublicSpaces(false)
    }
  }

  const previewPublicSpace = async (spaceId: string) => {
    setIsLoadingSpacePreview(true)
    setSpaceEntryError('')
    try {
      const response = await fetch(`${API_BASE}/api/spaces/explore/${spaceId}`, { headers: { Authorization: 'Bearer ' + (token || '') } })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not preview this Space.')
      setPreviewSpace(data.space)
    } catch (error) {
      setSpaceEntryError(error instanceof Error ? error.message : 'Could not preview this Space.')
    } finally {
      setIsLoadingSpacePreview(false)
    }
  }

  const joinPublicSpace = async (spaceId: string) => {
    setIsCreatingSpace(true)
    setSpaceEntryError('')
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/join-public`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (token || '') }
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not join this Space.')
      setCommunitySpaces(previous => previous.some(space => String(space._id) === String(data.space._id)) ? previous : [...previous, data.space])
      setActiveContext({ type: 'server', id: String(data.space._id), name: data.space.name })
      setMainView('chat')
      setShowSpaceEntry(false)
      setShowPublicSpaceExplorer(false)
      setPreviewSpace(null)
    } catch (error) {
      setSpaceEntryError(error instanceof Error ? error.message : 'Could not join this Space.')
    } finally {
      setIsCreatingSpace(false)
    }
  }

  useEffect(() => {
      const spaceId = new URLSearchParams(window.location.search).get('joinSpace')
      if (!spaceId || !user || !token || widgetJoinAttemptRef.current === spaceId) return
      widgetJoinAttemptRef.current = spaceId
      const joinFromWidget = async () => {
        setIsCreatingSpace(true)
        try {
          const response = await fetch(`${API_BASE}/api/spaces/${encodeURIComponent(spaceId)}/join-public`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          })
          const data = await response.json()
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not join this Space.')
          setCommunitySpaces(previous => previous.some(space => String(space._id) === String(data.space._id)) ? previous : [...previous, data.space])
          setActiveContext({ type: 'server', id: String(data.space._id), name: data.space.name })
          setMainView('chat')
        } catch (error) {
          setSpaceEntryError(error instanceof Error ? error.message : 'Could not join this Space.')
          setShowSpaceEntry(true)
        } finally {
          const currentUrl = new URL(window.location.href)
          currentUrl.searchParams.delete('joinSpace')
          window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
          setIsCreatingSpace(false)
        }
      }
      void joinFromWidget()
  })

  const createSpace = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newSpaceName.trim()) return
    setIsCreatingSpace(true)
    setSpaceEntryError('')
    try {
      const response = await fetch(`${API_BASE}/api/spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({
          name: newSpaceName.trim(),
          description: newSpaceDescription.trim(),
          scope: spaceCreationScope,
          isPublic: spaceCreationScope === 'community' && newSpaceIsPublic,
          category: spaceCreationScope === 'community' ? newSpaceCategory : 'Other',
          tags: spaceCreationScope === 'community' ? newSpaceTags.split(',').map(tag => tag.trim()).filter(Boolean) : []
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create Space.')
      if (newSpaceIcon) {
        try {
          const iconForm = new FormData()
          iconForm.append('kind', 'icon')
          iconForm.append('file', newSpaceIcon)
          const iconResponse = await fetch(`${API_BASE}/api/spaces/${data.space._id}/assets/upload`, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + (token || '') },
            body: iconForm
          })
          const iconData = await iconResponse.json()
          if (!iconResponse.ok || !iconData.ok) throw new Error(iconData.message || 'Space was created, but its icon could not be uploaded.')
          data.space.icon = iconData.icon
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Space was created, but its icon could not be uploaded.', 'error')
        }
      }
      setCommunitySpaces(previous => [...previous, data.space])
      setActiveContext({ type: 'server', id: String(data.space._id), name: data.space.name })
      setMainView('chat')
      setNewSpaceName('')
      setNewSpaceDescription('')
      setNewSpaceTags('')
      setNewSpaceIcon(null)
      setNewSpaceIsPublic(false)
      setShowSpaceEntry(false)
    } catch (error) {
      setSpaceEntryError(error instanceof Error ? error.message : 'Could not create Space.')
    } finally {
      setIsCreatingSpace(false)
    }
  }

  const joinSpace = async (event: React.FormEvent) => {
    event.preventDefault()
    const code = parseSpaceInviteCode(spaceInviteCode)
    if (!code) {
      setSpaceEntryError('Paste an invite link or enter its code.')
      return
    }
    setIsCreatingSpace(true)
    setSpaceEntryError('')
    try {
      const response = await fetch(`${API_BASE}/api/spaces/join/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not join this Space.')
      setCommunitySpaces(previous => previous.some(space => String(space._id) === String(data.space._id)) ? previous : [...previous, data.space])
      setActiveContext({ type: 'server', id: String(data.space._id), name: data.space.name })
      setMainView('chat')
      setSpaceInviteCode('')
      setShowSpaceEntry(false)
    } catch (error) {
      setSpaceEntryError(error instanceof Error ? error.message : 'Could not join this Space.')
    } finally {
      setIsCreatingSpace(false)
    }
  }

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite')
    if (!invite) return
    setSpaceInviteCode(invite)
    setShowSpaceEntry(true)
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  const createGroup = async (name: string, memberIds: string[]) => {
    const response = await fetch(`${API_BASE}/api/groups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ name, memberIds })
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Unable to create group');
    setSpaces(prev => [...prev, data.group]);
    setShowGroupCreation(false);
    setActiveContext({ type: 'space', id: String(data.group._id), name: data.group.name });
    setMainView('chat');
  }

  const loadNicknames = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      const data = await response.json()
      if (data.ok && data.user.nicknames) {
        const nicknameMap: Record<string, string> = {};
        data.user.nicknames.forEach((n: any) => {
          nicknameMap[n.userId] = n.nickname;
        });
        setNicknames(nicknameMap);
      }

      const loadBlockedUsers = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/auth/friends/blocked`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
          })
          const data = await response.json()
          if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to load blocked users.')
          setBlockedUserProfiles(data.users || [])
          setBlockedUsers((data.users || []).map((blockedUser: User) => blockedUser.userId))
        } catch (error) {
          console.error('Failed to load blocked users:', error)
        }
      }
      await loadBlockedUsers()
      if (data.ok && data.user.oneTimeMessageCooldowns) {
        setUserCooldowns(data.user.oneTimeMessageCooldowns);
      }
      if (data.ok && data.user.oneTimeMessageAcceptedUsers) {
        setAcceptedUsers(data.user.oneTimeMessageAcceptedUsers);
      }
    } catch (e) { console.error(e) }
  }

  const checkCooldownForUser = (targetUserId: string): { isOnCooldown: boolean; remainingTime?: number } => {
    const cooldownPeriod = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    const existingCooldown = userCooldowns.find(
      (c) => c.targetUserId === targetUserId && Date.now() - new Date(c.lastSent).getTime() < cooldownPeriod
    );
    
    if (existingCooldown) {
      const timeRemaining = cooldownPeriod - (Date.now() - new Date(existingCooldown.lastSent).getTime());
      return { isOnCooldown: true, remainingTime: timeRemaining };
    }
    
    return { isOnCooldown: false };
  }

  const handleUnblockUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/friends/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ targetUserId: userId })
      });
      const data = await response.json();
      if (data.ok) {
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        setBlockedUserProfiles(prev => prev.filter(blockedUser => blockedUser.userId !== userId));
        showToast('User unblocked', 'success');
      } else {
        showToast(data.message || 'Failed to unblock user', 'error');
      }
    } catch (e) {
      console.error('Failed to unblock user:', e);
      showToast('Failed to unblock user', 'error');
    }
  }

  const getDisplayName = (friend: User) => {
    return nicknames[friend.userId] || friend.displayName || friend.username;
  };

  const handleAcceptFriendRequest = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/friends/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId })
      })
      const data = await response.json()
      if (data.ok) {
        setFriendRequests(prev => prev.filter(req => req.userId !== userId))
        loadFriends()
      }
    } catch (e) {
      console.error('Failed to accept friend request:', e)
    }
  }

  const handleRejectFriendRequest = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/friends/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ requesterUserId: userId })
      })
      const data = await response.json()
      if (data.ok) {
        setFriendRequests(prev => prev.filter(r => r.userId !== userId))
      }
    } catch (e) {
      console.error('Failed to reject friend request:', e)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await response.json()
      if (data.ok) {
        setSearchResults(data.users || [])
      }
    } catch (e) {
      console.error('Search failed:', e)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const searchUsersForAddFriends = async (query: string) => {
    if (!query || query.length < 2) {
      setAddFriendsSearchResults([])
      return
    }
    setIsAddFriendsSearching(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      const data = await response.json()
      if (data.ok) {
        setAddFriendsSearchResults(data.users || [])
      }
    } catch (e) {
      console.error('Search failed:', e)
      setAddFriendsSearchResults([])
    } finally {
      setIsAddFriendsSearching(false)
    }
  }

  const handleSendOneTimeMessage = async (recipientUserId: string, recipientUsername: string) => {
    setOneTimeMessageModal({ userId: recipientUserId, username: recipientUsername });
    setOneTimeMessageContent('');
  }

  const handleSendOneTimeMessageSubmit = async () => {
    if (!oneTimeMessageModal || !oneTimeMessageContent.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/messages/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ recipientUserId: oneTimeMessageModal.userId, content: oneTimeMessageContent })
      });
      const data = await response.json();
      if (data.ok) {
        showToast('One-time message sent!', 'success');
        setOneTimeMessageModal(null);
        setOneTimeMessageContent('');
        // Open chat with the user
        setActiveContext({ type: 'dms', id: oneTimeMessageModal.userId });
        setMainView('chat');
      } else {
        showToast(data.message || 'Failed to send message', 'error');
      }
    } catch (e) {
      console.error('Failed to send one-time message:', e);
      showToast('Failed to send message', 'error');
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (addFriendsSearchQuery) searchUsersForAddFriends(addFriendsSearchQuery)
    }, 300)
    return () => clearTimeout(debounceTimer)
  }, [addFriendsSearchQuery])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    const newSocket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('token') }
    })
    setSocket(newSocket)

    const loadOnlineUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/online`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        const data = await response.json()
        if (data.ok) {
          setOnlineUsers(data.users);
        }
      } catch (e) { console.error('Failed to load online users:', e) }
    }

    const loadRequests = async () => {
      try {
        const [friendsRes, messagesRes] = await Promise.all([
          fetch(`${API_BASE}/api/auth/friends/pending`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch(`${API_BASE}/api/auth/messages/requests`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        ])
        
        const friendsData = await friendsRes.json()
        const messagesData = await messagesRes.json()

        if (friendsData.ok) {
          setFriendRequests(friendsData.requests)
        }
        if (messagesData.ok) setMessageRequests(messagesData.requests)
      } catch (e) { console.error(e) }
    }

    loadOnlineUsers()
    loadFriends()
    loadConversations()
    loadMessageNotifications()
    loadSpaces()
    loadCommunitySpaces()
    loadNicknames()
    loadRequests()

    newSocket.on('user:online', (onlineUser: User) => setOnlineUsers(prev => {
      if (prev.some(u => u.userId === onlineUser.userId)) return prev;
      return [...prev, onlineUser]
    }))
    const handleUserStatus = (data: { userId: string; online: boolean }) => {
      if (data.online) {
        loadOnlineUsers();
      } else {
        setOnlineUsers(prev => prev.filter(onlineUser => onlineUser.userId !== data.userId));
      }
    }
    newSocket.on('user:status', handleUserStatus)
    const handleConversationMessage = (message: any) => {
      const participantIds = String(message.roomId || '').split('_');
      if (participantIds.length === 2 && participantIds.includes(user.userId)) loadConversations();
    }
    newSocket.on('message:receive', handleConversationMessage)
    newSocket.on('conversation:message', handleConversationMessage)
    const handleConversationRead = (receipt: any) => {
      setConversations(prev => prev.map(conversation =>
        conversation.roomId === receipt.roomId && conversation.lastMessage?.id === receipt.messageId
          ? { ...conversation, lastMessage: { ...conversation.lastMessage, readBy: receipt.readBy } }
          : conversation
      ));
    }
    newSocket.on('message:read', handleConversationRead)
    const handleNewNotification = (notification: { id: string; roomId: string; senderId: string; senderName: string; groupName?: string; type?: 'message' | 'mention'; messageId?: string; createdAt?: string; readAt?: string }) => {
      if (notification.senderId === user.userId) return
      const muteType = notification.groupName ? 'group' : 'dm'
      if (localStorage.getItem(`space_muted_${muteType}_${notification.roomId}`) === 'true') return

      const entry = { ...notification, createdAt: notification.createdAt || new Date().toISOString() }
      setMessageNotifications(previous => {
        const next = [entry, ...previous.filter(item => item.id !== entry.id)].slice(0, 100)
        localStorage.setItem(notificationStorageKey, JSON.stringify(next))
        return next
      })

      if ((user as any).status === 'dnd' || localStorage.getItem('messageNotifications') === 'false') return
      if (localStorage.getItem('soundEnabled') !== 'false') {
        const audio = new Audio('/notification.mp3')
        void audio.play().catch(error => console.error('Could not play notification sound:', error))
      }
      if (localStorage.getItem('desktopNotifications') === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const desktop = new Notification(notification.senderName, {
          body: notification.groupName ? `New message in ${notification.groupName}` : 'New direct message',
          icon: '/favicon.ico'
        })
        desktop.onclick = () => {
          window.focus()
          setActiveContext({ type: notification.groupName ? 'space' : 'dms', id: notification.groupName ? notification.roomId : notification.roomId.split('_').find(id => id !== user.userId) })
          setMainView('chat')
          desktop.close()
        }
      }
    }
    newSocket.on('notification:new', handleNewNotification)
    newSocket.on('user:offline', (offlineUserId: string) => setOnlineUsers(prev => prev.filter(u => u.userId !== offlineUserId)))
    newSocket.on('message_request_received', (data: any) => setMessageRequests(prev => [...prev, data]))
    newSocket.on('message_request_accepted', (data: any) => {
      // Open the chat with the recipient when request is accepted
      setActiveContext({ type: 'dms', id: data.recipientId });
      setMainView('chat');
      // Add to accepted users list
      setAcceptedUsers(prev => [...prev, data.recipientId]);
      // Remove from message requests
      setMessageRequests(prev => prev.filter(r => r.senderId !== user?.userId || r.recipientUserId !== data.recipientId));
      showToast(`${data.recipientName} accepted your message request`);
    })
    newSocket.on('one_time_accepted', (data: any) => {
      // Reload conversations when one-time message is accepted
      loadConversations();
      // Remove from message requests
      setMessageRequests(prev => prev.filter(r => r.senderId !== data.senderId));
      showToast(`One-time message accepted`);
    })
    newSocket.on('friend_request_received', (data: any) => {
      setFriendRequests(prev => [...prev, data])
      if (localStorage.getItem('friendRequestNotifications') !== 'false' && (user as any)?.status !== 'dnd') {
        showToast(`New friend request from ${data.displayName || data.username}`)
      }
    })
    newSocket.on('friend_request_accepted', (data: any) => {
      loadFriends()
      setFriendRequests(prev => prev.filter(r => r.userId !== data.userId))
    })
    newSocket.on('friend_request_declined', (data: any) => {
      setFriendRequests(prev => prev.filter(r => r.userId !== data.userId))
    })
    newSocket.on('friend_status_changed', (data: any) => {
      setFriends(prev => prev.map(f => f.userId === data.userId ? { ...f, status: data.status } : f))
      setOnlineUsers(prev => prev.map(u => u.userId === data.userId ? { ...u, status: data.status } : u))
    })
    newSocket.on('user_activity_changed', (data: any) => {
      setFriends(prev => prev.map(f => f.userId === data.userId ? { ...f, customActivity: data.customActivity } : f))
      setOnlineUsers(prev => prev.map(u => u.userId === data.userId ? { ...u, customActivity: data.customActivity } : u))
    })
    newSocket.on('friend_removed', () => {
      loadFriends()
      loadConversations()
    })
    const handleProfileUpdated = (data: any) => {
      setFriends(prev => prev.map(f => f.userId === data.userId ? { ...f, ...data } : f));
      setOnlineUsers(prev => prev.map(u => u.userId === data.userId ? { ...u, ...data } : u));
      setSelectedProfile((prev: any) => prev && prev.userId === data.userId ? { ...prev, ...data } : prev);
      setConversations(prev => prev.map(c => {
        if (c.user?.userId === data.userId) return { ...c, user: { ...c.user, ...data } };
        if (c.otherUser?.userId === data.userId) return { ...c, otherUser: { ...c.otherUser, ...data } };
        return c;
      }));
      if (user?.userId === data.userId) {
        setUser((prev: any) => prev ? { ...prev, ...data } : prev);
      }
    };
    newSocket.on('user:profile-updated', handleProfileUpdated);
    newSocket.on('group:created', loadSpaces)
    newSocket.on('group:settings-updated', loadSpaces)
    newSocket.on('group:members-updated', loadSpaces)
    const handleGroupMemberRemoved = (data: { groupId: string }) => {
      setSpaces(prev => prev.filter(group => String(group._id) !== data.groupId))
      setActiveContext(current => current.type === 'space' && current.id === data.groupId ? { type: 'dms' } : current)
    }
    newSocket.on('group:member-removed', handleGroupMemberRemoved)
    newSocket.on('group:member_left', loadSpaces)
    const handleGroupMemberAdded = (data: { name?: string }) => {
      loadSpaces()
      showToast(`You were added to ${data.name || 'a group chat'}`)
    }
    newSocket.on('group:member-added', handleGroupMemberAdded)
    newSocket.on('space:member-removed', (data: { spaceId: string }) => {
      setCommunitySpaces(previous => previous.filter(space => String(space._id) !== data.spaceId))
      setActiveContext(current => current.type === 'server' && current.id === data.spaceId ? { type: 'dms' } : current)
    })
    const handleSpaceDeleted = (data: { spaceId: string }) => {
      setCommunitySpaces(previous => previous.filter(space => String(space._id) !== data.spaceId))
      setActiveContext(current => current.type === 'server' && current.id === data.spaceId ? { type: 'dms' } : current)
    }
    newSocket.on('space:deleted', handleSpaceDeleted)

    return () => {
      newSocket.off('group:created', loadSpaces);
      newSocket.off('group:settings-updated', loadSpaces);
      newSocket.off('group:members-updated', loadSpaces);
      newSocket.off('group:member-removed', handleGroupMemberRemoved);
      newSocket.off('group:member_left', loadSpaces);
      newSocket.off('group:member-added', handleGroupMemberAdded);
      newSocket.off('space:member-removed');
      newSocket.off('space:deleted', handleSpaceDeleted);
      newSocket.off('message:receive', handleConversationMessage);
      newSocket.off('conversation:message', handleConversationMessage);
      newSocket.off('message:read', handleConversationRead);
      newSocket.off('notification:new', handleNewNotification);
      newSocket.off('user:profile-updated', handleProfileUpdated);
      newSocket.off('user:status', handleUserStatus);
      newSocket.disconnect();
    }
  }, [isAuthenticated, user])

  // Automatically hide sidebar on mobile when context changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [activeContext, isMobile])

  // Clear unread count when active DM conversation is open
  useEffect(() => {
    if (activeContext.type === 'dms' && activeContext.id) {
      setConversations(prev => prev.map(c => {
        if (c.otherUser?.userId === activeContext.id && (c.unreadCount > 0 || !c.lastMessage?.readBy?.includes(user?.userId))) {
          return {
            ...c,
            unreadCount: 0,
            lastMessage: c.lastMessage ? { ...c.lastMessage, readBy: [...(c.lastMessage.readBy || []), user?.userId] } : c.lastMessage
          };
        }
        return c;
      }));
    }
  }, [activeContext.type, activeContext.id, user?.userId]);
  useEffect(() => {
  }, [activeContext, isMobile])

  if (!isAuthenticated) return null

  const directMessageItems = [...conversations, ...friends.filter(friend => !conversations.some(conversation => conversation.otherUser?.userId === friend.userId))]
    .filter(item => {
      const person = item.roomId !== undefined ? item.otherUser : item;
      const query = conversationSearchQuery.trim().toLowerCase();
      const searchableName = `${nicknames[person?.userId] || person?.displayName || ''} ${person?.username || ''}`.toLowerCase();
      return Boolean(person) && (!query || searchableName.includes(query));
    })
    .sort((a, b) => new Date(b.lastMessage?.timestamp || 0).getTime() - new Date(a.lastMessage?.timestamp || 0).getTime());
  const visibleMessageNotifications = messageNotifications.filter(notification =>
    !notification.groupName || localStorage.getItem(`space_muted_group_${notification.roomId}`) !== 'true'
  )
  const filteredNotifications = notificationTab === 'mentions'
    ? visibleMessageNotifications.filter(notification => notification.type === 'mention')
    : visibleMessageNotifications
  const unreadMessageNotifications = visibleMessageNotifications.filter(notification => !notification.readAt).length
  const unreadMentionNotifications = visibleMessageNotifications.filter(notification => notification.type === 'mention' && !notification.readAt).length
  const totalUnreadDMs = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (Number(c.unreadCount) || (c.lastMessage && c.lastMessage.senderId !== user?.userId && !c.lastMessage.readBy?.includes(user?.userId) ? 1 : 0)), 0);
  }, [conversations, user?.userId]);

  return (
    <CallProvider socket={socket} user={user} onNotice={(msg, type) => showToast(msg, type)}>
      <CallOverlay />
            <div className="dashboard-shell h-screen w-full max-w-full min-w-0 bg-[var(--app-bg)] flex font-sans overflow-hidden transition-colors duration-200">
      {/* Left Navigation Rail (Server/Space Switcher) */}
      <div className={`dashboard-rail w-16 flex flex-col items-center py-3 gap-2 border-r border-[var(--app-border)] shrink-0 z-10 bg-[var(--app-panel)] overflow-y-auto ${isMobile && activeContext.id ? "hidden" : "flex"}`}>

        {/* Home/DM Button */}
        <button
          onClick={() => { setActiveContext({ type: 'dms' }); setMainView('chat') }}
          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            activeContext.type === 'dms' ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)]' : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
          }`}
          title="Messages"
        >
          <MessageCircle className="w-6 h-6" />
          {totalUnreadDMs > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white shadow-md z-10 animate-pulse">
              {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-8 h-px bg-[var(--app-border)] my-1" />

        <button onClick={() => setShowSpaceEntry(true)} className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--app-surface)] text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all" title="Create or join a Space">
          <Globe2 className="w-5 h-5" />
        </button>

        {communitySpaces.map((space) => (
          <button key={String(space._id)} onClick={() => { setActiveContext({ type: 'server', id: String(space._id), name: space.name }); setMainView('chat') }} className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${activeContext.type === 'server' && activeContext.id === String(space._id) ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/50' : 'bg-[var(--app-surface)] text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'}`} title={space.name}>
            {space.icon ? <img src={space.icon} alt="" className="h-full w-full rounded-xl object-cover" /> : space.name?.slice(0, 2).toUpperCase() || <Globe2 className="w-5 h-5" />}
          </button>
        ))}

        {communitySpaces.length > 0 && <div className="w-8 h-px bg-[var(--app-border)] my-1" />}

        {/* Add Space Button */}
        <button onClick={() => setShowGroupCreation(true)} className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--app-surface)] text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all" title="Create group chat">
          <Plus className="w-6 h-6" />
        </button>

        {spaces.map((space) => (
          <button key={String(space._id || space.id)} onClick={() => setActiveContext({ type: 'space', id: String(space._id || space.id), name: space.name })} className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${activeContext.id === String(space._id || space.id) ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/50' : 'bg-[var(--app-surface)] text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'}`} title={space.name}>
            {space.name?.slice(0, 2).toUpperCase() || <Hash className="w-5 h-5" />}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Explore Button */}
        <button onClick={() => { setMainView('friends'); setFriendsTab('all'); if (isMobile) setSidebarOpen(false); }} title="Friends" className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${mainView === 'friends' ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)]' : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'}`}>
          <Users className="w-6 h-6" />
        </button>
      </div>

      {/* Secondary Navigation Sidebar */}
      <div className={`dashboard-sidebar
        flex flex-col border-r border-[var(--app-border)] z-20 bg-[var(--app-panel)]
        ${activeContext.type === 'server' ? 'hidden' : ''}
        ${isMobile ? (activeContext.id ? `fixed inset-y-0 left-0 z-50 w-[min(320px,85vw)] transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}` : 'flex-1 w-auto translate-x-0') : 'w-[296px] translate-x-0'}
      `}>
        {/* Server Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel)] shrink-0">
          <h2 className="font-bold text-[var(--text-primary)]">{mainView === 'friends' ? 'Friends' : 'Direct Messages'}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMainView('friends'); setShowFriendsPanel(false); }}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors"
              title="Friends"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddFriendsModal(true)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors"
              title="Start a conversation"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowNotificationsPanel(true)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {(friendRequests?.length > 0 || messageRequests?.length > 0 || unreadMessageNotifications > 0) && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-[var(--app-accent)] rounded-full" />
              )}
            </button>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              aria-label="Search direct messages"
              value={conversationSearchQuery}
              onChange={event => setConversationSearchQuery(event.target.value)}
              placeholder="Find or start a conversation"
              className="w-full bg-[var(--bg-input)] border border-[var(--app-border)] text-[var(--text-primary)] rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-[var(--app-accent)] transition-colors"
            />
          </div>
        </div>

        {/* Conversations Stream */}
        <div className="flex-1 overflow-y-auto px-2 py-1 custom-scrollbar">
          {/* Saved Notes */}
          <button
            onClick={() => { setActiveContext({ type: 'dms', id: user?.userId || '' }); if (isMobile) setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--app-surface-hover)] transition-colors text-left mb-1"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--app-accent)]/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-[var(--app-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-[var(--text-primary)]">Saved Notes</p>
            </div>
          </button>

          {/* Requests */}
          {messageRequests.length > 0 && (
            <div className="mb-2">
              <div className="px-2 mb-1">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Requests</span>
              </div>
              {messageRequests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => { setActiveContext({ type: 'request', id: req.id }); if (isMobile) setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--app-surface-hover)] transition-colors text-left mb-0.5"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--app-accent)] flex items-center justify-center font-bold text-white text-sm">
                      {req.username[0].toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 bg-[var(--app-accent)] w-2.5 h-2.5 rounded-full border-2 border-[var(--app-panel)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--text-primary)] truncate">@{req.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Direct Messages */}
          <div>
            <div className="px-2 mb-1">
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Direct Messages</span>
            </div>
            <div className="space-y-0.5">
              {directMessageItems.map((item) => {
                const isConversation = item.roomId !== undefined;
                const otherUser = isConversation ? item.otherUser : item;
                const isOnline = onlineUsers.some(u => u.userId === otherUser?.userId);
                const isPending = isConversation && item.status === 'pending_one_time';
                const unreadCount = Number(item.unreadCount) || (isConversation && item.lastMessage && item.lastMessage.senderId !== user?.userId && !item.lastMessage.readBy?.includes(user?.userId) ? 1 : 0);
                const isUnread = unreadCount > 0;
                const lastActivity = item.lastMessage?.timestamp
                  ? formatConversationTime(item.lastMessage.timestamp)
                  : null;
                const previewSender = item.lastMessage
                  ? item.lastMessage.senderId === user?.userId ? 'You' : nicknames[otherUser?.userId] || otherUser?.displayName || otherUser?.username
                  : '';
                const previewText = item.lastMessage?.preview || (item.lastMessage ? 'Encrypted message' : 'Start a conversation');
                
                if (!otherUser) return null;
                
                return (
                  <button
                    key={otherUser.userId}
                    onClick={() => { setActiveContext({ type: 'dms', id: otherUser.userId }); if (isMobile) setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded transition-all text-left sidebar-item ${
                      activeContext.type === 'dms' && activeContext.id === otherUser.userId
                        ? 'bg-[var(--app-surface-hover)] sidebar-active-bar'
                        : 'hover:bg-[var(--app-surface-hover)]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center font-bold text-white text-sm overflow-hidden">
                        {otherUser.avatar ? <img src={otherUser.avatar} alt="" className="w-full h-full object-cover" /> : otherUser.username[0].toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-panel)] ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      {isPending && (
                        <div className="absolute -top-0.5 -right-0.5 bg-[var(--app-accent)] w-3 h-3 rounded-full border-2 border-[var(--app-panel)]" />
                      )}
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white shadow-md z-10 animate-pulse border border-[var(--app-panel)]">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isUnread ? 'text-[var(--app-accent)]' : 'text-[var(--text-primary)]'}`}>{nicknames[otherUser.userId] || otherUser.displayName || otherUser.username}</p>
                      {isPending && (
                        <p className="text-xs text-[var(--app-accent)]">Message Request</p>
                      )}
                      {!isPending && (
                        <div className="flex items-center gap-1.5">
                          {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] shrink-0" />}
                          <p className={`text-xs truncate ${isUnread ? 'font-semibold text-[var(--app-accent)]' : 'text-[var(--text-secondary)]'}`}>
                            {item.lastMessage && <span className="font-medium">{previewSender}: </span>}{previewText}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {lastActivity && <span className="text-[10px] text-[var(--text-secondary)]">{lastActivity}</span>}
                      {unreadCount > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold text-white shadow-sm">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {directMessageItems.length === 0 && conversationSearchQuery.trim() && (
                <p className="px-2 py-3 text-xs text-[var(--text-secondary)]">No conversations found</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Control Bar */}
        <div ref={statusMenuRef} className="relative h-[52px] px-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSelectedProfile(user)}
            className="flex items-center gap-2 flex-1 p-1.5 rounded hover:bg-[var(--app-surface-hover)] transition-colors"
          >
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user?.username[0].toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-surface)] ${
                (user as any)?.status === 'active' ? 'bg-green-500' : 
                (user as any)?.status === 'inactive' ? 'bg-yellow-500' : 
                (user as any)?.status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.displayName || user?.username}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{(user as any)?.status === 'dnd' ? 'Do not disturb' : (user as any)?.status === 'inactive' ? 'Idle' : 'Online'}</p>
            </div>
          </button>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setIsStatusMenuOpen(open => !open)} aria-label="Set presence" aria-expanded={isStatusMenuOpen} title="Set presence" className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors">
              <span className={`block w-3 h-3 rounded-full border-2 border-[var(--app-surface)] ${(user as any)?.status === 'dnd' ? 'bg-red-500' : (user as any)?.status === 'inactive' ? 'bg-amber-400' : 'bg-green-500'}`} />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          {isStatusMenuOpen && (
            <div className="absolute bottom-14 right-12 z-50 w-48 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-xl">
              {([
                { value: 'active', label: 'Online', color: 'bg-green-500' },
                { value: 'inactive', label: 'Idle', color: 'bg-amber-400' },
                { value: 'dnd', label: 'Do not disturb', color: 'bg-red-500' }
              ] as const).map(option => (
                <button key={option.value} onClick={() => void updatePresence(option.value)} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]">
                  <span className={`w-2.5 h-2.5 rounded-full ${option.color}`} />{option.label}
                  {(user as any)?.status === option.value && <CheckCircle2 className="w-4 h-4 ml-auto text-[var(--app-accent)]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && activeContext.type !== 'server' && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--app-bg)] relative">
        {/* Mobile Header */}
        {isMobile && activeContext.type !== 'server' && !activeContext.id && (
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-[var(--text-primary)] rounded active:bg-[var(--app-surface-hover)]">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-[var(--text-primary)]">{activeContext.name || (mainView === 'friends' ? 'Friends' : 'Direct Messages')}</h2>
            <div className="w-8" />
          </div>
        )}

        {/* Chat Content */}
        {mainView === 'friends' ? (
          <div className="flex-1 flex flex-col bg-[var(--app-bg)]">
            <div className="h-12 px-6 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] shrink-0">
              <h2 className="font-bold text-[var(--text-primary)]">Friends</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddFriendsModal(true)}
                  className="px-3 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friends
                </button>
                <button
                  onClick={() => setMainView('chat')}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] rounded transition-colors"
                  title="Back to Chat"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Category Pills */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setFriendsTab('online')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    friendsTab === 'online'
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFriendsTab('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    friendsTab === 'all'
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  All Friends
                </button>
                <button
                  onClick={() => setFriendsTab('requests')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    friendsTab === 'requests'
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
                </button>
                <button
                  onClick={() => setFriendsTab('blocked')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    friendsTab === 'blocked'
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'bg-[var(--app-surface)] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  Blocked {blockedUserProfiles.length > 0 && `(${blockedUserProfiles.length})`}
                </button>
              </div>

              {/* Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friendsTab === 'online' && (
                  <>
                    {friends.filter(f => onlineUsers.some(u => u.userId === f.userId)).length === 0 ? (
                      <p className="text-center text-[var(--text-secondary)] py-8 col-span-full">No friends online</p>
                    ) : (
                      friends.filter(f => onlineUsers.some(u => u.userId === f.userId)).map((friend) => (
                        <div key={friend.userId} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--app-border)] hover:border-[var(--app-accent)] transition-all group glass-panel hover:-translate-y-1 hover:shadow-xl sidebar-item">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-lg font-bold overflow-hidden shadow-sm">
                              {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[var(--app-panel)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--app-accent)] transition-colors">{getDisplayName(friend)}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">Online</p>
                          </div>
                          <button
                            onClick={() => { setActiveContext({ type: 'dms', id: friend.userId }); setMainView('chat'); setSearchQuery(''); setSearchResults([]); }}
                            className="px-4 py-2 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-105"
                          >
                            Chat
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {friendsTab === 'all' && (
                  <>
                    {friends.length === 0 ? (
                      <p className="text-center text-[var(--text-secondary)] py-8 col-span-full">No friends yet</p>
                    ) : (
                      friends.map((friend) => (
                        <div key={friend.userId} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--app-border)] hover:border-[var(--app-accent)] transition-all group glass-panel hover:-translate-y-1 hover:shadow-xl sidebar-item">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white text-lg font-bold overflow-hidden shadow-sm">
                              {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                            </div>
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[var(--app-panel)] ${
                              onlineUsers.some(u => u.userId === friend.userId) ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--app-accent)] transition-colors">{getDisplayName(friend)}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{onlineUsers.some(u => u.userId === friend.userId) ? 'Online' : 'Offline'}</p>
                          </div>
                          <button
                            onClick={() => { setActiveContext({ type: 'dms', id: friend.userId }); setMainView('chat'); setSearchQuery(''); setSearchResults([]); }}
                            className="px-4 py-2 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-105"
                          >
                            Chat
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {friendsTab === 'requests' && (
                  <>
                    {friendRequests.length === 0 ? (
                      <p className="text-center text-[var(--text-secondary)] py-8">No pending requests</p>
                    ) : (
                      friendRequests.map((req) => (
                        <div key={req.userId} className="flex items-center gap-3 p-3 bg-[var(--app-surface)] rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white font-bold">
                            {req.username[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-[var(--text-primary)]">{req.username}</p>
                            <p className="text-xs text-[var(--text-secondary)]">wants to be friends</p>
                          </div>
                          <button
                            onClick={() => handleAcceptFriendRequest(req.userId)}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {friendsTab === 'blocked' && (
                  <>
                    {blockedUserProfiles.length === 0 ? (
                      <p className="text-center text-[var(--text-secondary)] py-8 col-span-full">You haven’t blocked anyone.</p>
                    ) : blockedUserProfiles.map(blockedUser => (
                      <div key={blockedUser.userId} className="flex items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--app-accent)]/15 font-bold text-[var(--app-accent)]">
                          {blockedUser.avatar ? <img src={blockedUser.avatar} alt="" className="h-full w-full object-cover" /> : blockedUser.username[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{blockedUser.displayName || blockedUser.username}</p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">@{blockedUser.username}</p>
                        </div>
                        <button type="button" onClick={() => void handleUnblockUser(blockedUser.userId)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]">Unblock</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : activeContext.type === 'request' && activeContext.id ? (() => {
          const req = messageRequests.find(r => r.id === activeContext.id)
          if (!req) return null
          return (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-[var(--app-surface)] rounded-2xl p-6 shadow-lg border border-[var(--app-border)] text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] text-white flex items-center justify-center text-2xl font-bold mb-4 shadow-md">
                  {req.username[0].toUpperCase()}
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">@{req.username}</h3>
                <p className="text-sm text-[var(--text-secondary)] font-medium uppercase tracking-wider mb-6">Wants to connect</p>

                <div className="bg-[var(--app-panel)] rounded-xl p-4 mb-6 border border-[var(--app-border)]">
                  <MessageCircle className="w-6 h-6 text-[var(--app-accent)] mb-2 mx-auto" />
                  <p className="text-[var(--text-primary)] italic">"{req.content}"</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API_BASE}/api/auth/messages/request/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ requestId: req.id, action: 'reject' }) });
                        setMessageRequests(prev => prev.filter(r => r.id !== req.id))
                        setActiveContext({ type: 'dms' })
                      } catch (e) { console.error(e) }
                    }}
                    className="flex-1 py-2.5 bg-[var(--app-surface-hover)] text-[var(--text-primary)] rounded-xl font-bold transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API_BASE}/api/auth/messages/request/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ requestId: req.id, action: 'accept' }) });
                        setMessageRequests(prev => prev.filter(r => r.id !== req.id))
                        // Add to accepted users list
                        setAcceptedUsers(prev => [...prev, req.senderId]);
                        // Reload conversations
                        loadConversations();
                        setActiveContext({ type: 'dms', id: req.senderId })
                      } catch (e) { console.error(e) }
                    }}
                    className="flex-1 py-2.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-xl font-bold transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          )
        })() : (
          <ErrorBoundary>
            {activeContext.type === 'server' && activeContext.id && user ? (
              <SpaceView
                spaceId={activeContext.id}
                initialChannelId={activeContext.channelId}
                initialMessageId={messageJump?.messageId}
                initialThreadId={messageJump?.threadId}
                user={user}
                privateKey={privateKey}
                socket={socket}
                onViewProfile={profile => setSelectedProfile(profile)}
                onMessageUser={userId => {
                  setActiveContext({ type: 'dms', id: userId })
                  setMainView('chat')
                }}
                onExit={() => setActiveContext({ type: 'dms' })}
              />
            ) : (
              <ChatWindow
                activeContext={activeContext}
                setActiveContext={(ctx) => { setActiveContext(ctx); setMainView('chat'); }}
                user={user}
                friends={friends}
                nicknames={nicknames}
                privateKey={privateKey}
                socket={socket}
                onViewProfile={(profile) => setSelectedProfile(profile)}
                isMobile={isMobile}
                acceptedUsers={acceptedUsers}
                spaces={spaces.map(space => ({ id: String(space._id || space.id), name: space.name }))}
              />
            )}
          </ErrorBoundary>
        )}
      </div>

      {showSpaceEntry && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
          <section className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] p-6 shadow-2xl ${showPublicSpaceExplorer ? 'max-w-3xl' : 'max-w-md'}`}>
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--text-primary)]">Spaces</h2><p className="text-sm text-[var(--text-secondary)]">Start a community or join one by invite.</p></div><button onClick={() => { setShowSpaceEntry(false); setSpaceEntryError('') }} aria-label="Close"><X size={18} /></button></div>
            <div className="min-h-0 overflow-y-auto">
            <form onSubmit={createSpace} className="mb-5 space-y-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Create your Space</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Start small with friends or set up a community-ready space.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['friends', 'For me and my friends', 'A cozy starter Space with general chat and voice.'],
                  ['community', 'For a club or community', 'Adds rules, announcements, and a safer default filter.']
                ] as const).map(([scope, title, description]) => (
                  <button key={scope} type="button" onClick={() => setSpaceCreationScope(scope)} className={`rounded-xl border p-3 text-left transition-colors ${spaceCreationScope === scope ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/10' : 'border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]'}`}>
                    <span className="block text-xs font-bold text-[var(--text-primary)]">{title}</span>
                    <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{description}</span>
                  </button>
                ))}
              </div>
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Space name<input value={newSpaceName} onChange={event => setNewSpaceName(event.target.value)} maxLength={100} placeholder="Give your Space a name" className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm text-[var(--text-primary)]" /></label>
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Description <span className="font-normal">(optional)</span><textarea value={newSpaceDescription} onChange={event => setNewSpaceDescription(event.target.value)} maxLength={1000} placeholder="What is this Space about?" className="mt-2 min-h-16 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm text-[var(--text-primary)]" /></label>
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Space icon <span className="font-normal">(optional, PNG/JPEG/GIF/WebP)</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => setNewSpaceIcon(event.target.files?.[0] || null)} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]" /></label>
              {spaceCreationScope === 'community' && (
                <div className="space-y-3 border-t border-[var(--app-border)] pt-3">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">Discovery category<select value={newSpaceCategory} onChange={event => setNewSpaceCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm text-[var(--text-primary)]">{SPACE_DISCOVERY_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">Tags <span className="font-normal">(up to 5, separated by commas)</span><input value={newSpaceTags} onChange={event => setNewSpaceTags(event.target.value)} placeholder="art, study group, co-op" className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm text-[var(--text-primary)]" /></label>
                  <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={newSpaceIsPublic} onChange={event => setNewSpaceIsPublic(event.target.checked)} className="mt-0.5 accent-[var(--app-accent)]" /><span><strong className="text-[var(--text-primary)]">List in public discovery</strong><span className="mt-0.5 block">Anyone can preview and join this Space.</span></span></label>
                </div>
              )}
              <button disabled={!newSpaceName.trim() || isCreatingSpace} className="w-full rounded-lg bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isCreatingSpace ? 'Creating…' : 'Create Space'}</button>
            </form>
            <form onSubmit={joinSpace} className="space-y-3 border-t border-[var(--app-border)] pt-4">
              <label className="block text-sm font-medium text-[var(--text-primary)]">Join with an invite<input value={spaceInviteCode} onChange={event => setSpaceInviteCode(event.target.value)} placeholder="Paste an invite link or code" className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm" /></label>
              <button disabled={!spaceInviteCode.trim() || isCreatingSpace} className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">Join Space</button>
            </form>
            <section className="mt-5 border-t border-[var(--app-border)] pt-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Explore public Spaces</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Search communities, preview their public channels, then join if it feels right.</p>
              </div>
              <form onSubmit={event => { event.preventDefault(); void loadPublicSpaces(publicSpaceQuery, publicSpaceCategory) }} className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={publicSpaceQuery} onChange={event => setPublicSpaceQuery(event.target.value)} maxLength={100} placeholder="Search names, descriptions, or tags" className="min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                <div className="flex gap-2">
                  <select value={publicSpaceCategory} onChange={event => setPublicSpaceCategory(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-xs text-[var(--text-primary)]">
                    <option value="">All categories</option>
                    {SPACE_DISCOVERY_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                  </select>
                  <button type="submit" disabled={isLoadingPublicSpaces} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50">{isLoadingPublicSpaces ? 'Searching…' : showPublicSpaceExplorer ? 'Search' : 'Browse'}</button>
                </div>
              </form>
              {showPublicSpaceExplorer && <div className="grid gap-3 sm:grid-cols-2">
                {publicSpaces.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                  <div className="h-16 bg-gradient-to-r from-[var(--app-accent)]/40 to-[var(--app-accent-secondary)]/30" style={item.banner ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.2), rgba(0,0,0,.05)), url("${item.banner}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} />
                  <div className="flex items-start gap-3 p-3">
                    <span className="-mt-7 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--app-surface)] bg-[var(--app-accent)] font-bold text-white">{item.icon ? <img src={item.icon} alt="" className="h-full w-full object-cover" /> : item.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><h4 className="truncate text-sm font-bold text-[var(--text-primary)]">{item.name}</h4><p className="mt-1 line-clamp-2 min-h-8 text-xs text-[var(--text-secondary)]">{item.description || 'A public Space community.'}</p><p className="mt-2 text-[10px] text-[var(--text-secondary)]">{item.category} · {item.memberCount} members · {item.channelCount} channels</p>{item.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.tags.map(tag => <span key={tag} className="rounded-full bg-[var(--app-accent)]/10 px-2 py-0.5 text-[9px] text-[var(--app-accent)]">{tag}</span>)}</div>}
                      <div className="mt-3 flex gap-2"><button type="button" onClick={() => void previewPublicSpace(item.id)} disabled={isLoadingSpacePreview} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50">{isLoadingSpacePreview ? 'Loading…' : 'Preview'}</button><button type="button" onClick={() => void joinPublicSpace(item.id)} disabled={isCreatingSpace} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isCreatingSpace ? 'Joining…' : 'Join'}</button></div>
                    </div>
                  </div>
                </article>)}
                {publicSpaces.length === 0 && <p className="py-6 text-center text-sm text-[var(--text-secondary)] sm:col-span-2">No public Spaces match those filters yet.</p>}
              </div>}
            </section>
            {previewSpace && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4" onClick={() => setPreviewSpace(null)}>
              <section role="dialog" aria-modal="true" aria-label={`Preview ${previewSpace.name}`} onClick={event => event.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl">
                <div className="h-28 bg-gradient-to-r from-[var(--app-accent)]/50 to-[var(--app-accent-secondary)]/40" style={previewSpace.banner ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.3), rgba(0,0,0,.1)), url("${previewSpace.banner}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} />
                <div className="max-h-[calc(85vh-7rem)] overflow-y-auto p-5">
                  <div className="-mt-12 flex items-end justify-between gap-3">
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--app-panel)] bg-[var(--app-accent)] text-xl font-black text-white">{previewSpace.icon ? <img src={previewSpace.icon} alt="" className="h-full w-full object-cover" /> : previewSpace.name.slice(0, 1).toUpperCase()}</span>
                    <button type="button" onClick={() => setPreviewSpace(null)} aria-label="Close preview" className="mb-1 rounded-lg border border-[var(--app-border)] p-2 text-[var(--text-secondary)]"><X size={16} /></button>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">{previewSpace.name}</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{previewSpace.category} · {previewSpace.memberCount} members</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{previewSpace.description || 'A public Space community.'}</p>
                  <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Public channels</h4>
                  <div className="mt-2 space-y-2">
                    {previewSpace.channels.map(channel => <div key={channel.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{channel.type === 'voice' ? '◖' : '#'} {channel.name}</p>
                      {channel.topic && <p className="mt-1 text-xs text-[var(--text-secondary)]">{channel.topic}</p>}
                    </div>)}
                    {previewSpace.channels.length === 0 && <p className="rounded-xl bg-[var(--app-surface)] p-3 text-xs text-[var(--text-secondary)]">This Space has no channels open to public preview.</p>}
                  </div>
                  <button type="button" onClick={() => void joinPublicSpace(previewSpace.id)} disabled={isCreatingSpace} className="mt-5 w-full rounded-lg bg-[var(--app-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isCreatingSpace ? 'Joining…' : 'Join Space'}</button>
                </div>
              </section>
            </div>}
            {spaceEntryError && <p role="alert" className="mt-4 text-sm text-red-300">{spaceEntryError}</p>}
            </div>
          </section>
        </div>
      )}

      <GroupChatCreationModal
        isOpen={showGroupCreation}
        friends={friends}
        onClose={() => setShowGroupCreation(false)}
        onCreate={createGroup}
      />

      {/* Right-Hand Context Panel (Member List) */}
      {!isMobile && mainView === 'chat' && activeContext.type === 'dms' && !activeContext.id && (
        <div className="w-[240px] bg-[var(--app-panel)] border-l border-[var(--app-border)] flex flex-col shrink-0">
          <div className="h-12 px-4 flex items-center border-b border-[var(--app-border)] bg-[var(--app-surface)] shrink-0">
            <h3 className="font-bold text-[var(--text-primary)]">Online Friends</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {onlineUsers.map((onlineUser) => {
              const friend = friends.find(f => f.userId === onlineUser.userId);
              if (!friend) return null;
              return (
                <button
                  key={onlineUser.userId}
                  onClick={() => { setActiveContext({ type: 'dms', id: onlineUser.userId }); }}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--app-surface-hover)] transition-colors text-left mb-0.5"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center font-bold text-white text-sm overflow-hidden">
                      {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-panel)] bg-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-[var(--text-primary)]">{getDisplayName(friend)}</p>
                  </div>
                </button>
              );
            })}
            {onlineUsers.length === 0 && (
              <p className="text-center text-[var(--text-secondary)] text-sm py-4">No friends online</p>
            )}
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Notifications Panel */}
      {showNotificationsPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNotificationsPanel(false)}>
          <div className="bg-[var(--app-panel)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--app-border)]" onClick={event => event.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Notifications</h2>
                {unreadMessageNotifications > 0 && <p className="mt-1 text-xs text-[var(--text-secondary)]">{unreadMessageNotifications} unread message {unreadMessageNotifications === 1 ? 'notification' : 'notifications'}</p>}
              </div>
              <div className="flex items-center gap-3">
                {unreadMessageNotifications > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessageNotifications(previous => {
                        const next = previous.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
                        localStorage.setItem(notificationStorageKey, JSON.stringify(next))
                        return next
                      })
                      void (async () => {
                        try {
                          const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
                            method: 'PATCH',
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          const data = await response.json()
                          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not mark notifications as read.')
                        } catch (error) {
                          console.error('Failed to mark notifications as read:', error)
                          showToast(error instanceof Error ? error.message : 'Could not mark notifications as read.', 'error')
                        }
                      })()
                    }}
                    className="text-xs font-semibold text-[var(--app-accent)] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              <button onClick={() => setShowNotificationsPanel(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
              </div>
              </div>
              <div className="mb-4 flex gap-2 border-b border-[var(--app-border)]">
                {([
                  ['all', 'All notifications'],
                  ['mentions', `Mentions${unreadMentionNotifications ? ` (${unreadMentionNotifications})` : ''}`]
                ] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => setNotificationTab(tab)} aria-pressed={notificationTab === tab} className={`border-b-2 px-3 py-2 text-xs font-semibold ${notificationTab === tab ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--text-secondary)]'}`}>{label}</button>)}
              </div>
              <div className="space-y-4">
                {filteredNotifications.length === 0 && (notificationTab === 'mentions' || (friendRequests.length === 0 && messageRequests.length === 0)) ? (
                  <p className="text-center text-[var(--text-secondary)]">{notificationTab === 'mentions' ? 'No mentions yet.' : 'No notifications'}</p>
                ) : (
                  <>
                    {filteredNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          const group = Boolean(notification.groupName)
                          const roomParts = notification.roomId.split(':')
                          const serverId = notification.roomId.startsWith('space:') ? roomParts[1] : ''
                          if (serverId && notification.messageId) {
                            setMessageJump({ messageId: notification.messageId, threadId: roomParts[3] })
                          } else {
                            setMessageJump(null)
                          }
                          setActiveContext(serverId
                            ? { type: 'server', id: serverId, channelId: roomParts[2] }
                            : {
                                type: group ? 'space' : 'dms',
                                id: group ? notification.roomId : notification.roomId.split('_').find(id => id !== user?.userId)
                              })
                          setMainView('chat')
                          setMessageNotifications(previous => {
                            const next = previous.map(item => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)
                            localStorage.setItem(notificationStorageKey, JSON.stringify(next))
                            return next
                          })
                          void (async () => {
                            try {
                              const response = await fetch(`${API_BASE}/api/notifications/${notification.id}/read`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}` }
                              })
                              const data = await response.json()
                              if (!response.ok || !data.ok) throw new Error(data.message || 'Could not mark notification as read.')
                            } catch (error) {
                              console.error('Failed to mark notification as read:', error)
                              showToast(error instanceof Error ? error.message : 'Could not mark notification as read.', 'error')
                            }
                          })()
                          setShowNotificationsPanel(false)
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[var(--app-surface-hover)] ${notification.readAt ? 'bg-[var(--app-surface)] opacity-70' : 'bg-[var(--app-accent)]/10'}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-bold text-white">{notification.senderName.slice(0, 1).toUpperCase()}</div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{notification.senderName}</span>
                          <span className="block truncate text-xs text-[var(--text-secondary)]">{notification.type === 'mention' ? `Mentioned you in ${notification.groupName || 'a Space'}` : notification.groupName ? `New message in ${notification.groupName}` : 'New direct message'}</span>
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{formatConversationTime(notification.createdAt)}</span>
                      </button>
                    ))}
                    {friendRequests.map((req) => (
                      <div key={req.userId} className="flex items-center gap-3 p-3 bg-[var(--app-surface)] rounded-xl">
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`${API_BASE}/api/auth/search?q=${encodeURIComponent(req.username)}`, {
                                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                              });
                              const data = await response.json();
                              if (data.ok && data.users && data.users.length > 0) {
                                setSelectedProfile(data.users[0]);
                                setShowNotificationsPanel(false);
                              }
                            } catch (e) {
                              console.error('Failed to load profile:', e);
                            }
                          }}
                          className="shrink-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white font-bold cursor-pointer hover:opacity-80 transition-opacity">
                            {req.username[0].toUpperCase()}
                          </div>
                        </button>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-[var(--text-primary)]">{req.username}</p>
                          <p className="text-xs text-[var(--text-secondary)]">wants to be friends</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`${API_BASE}/api/auth/friends/decline`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                                  body: JSON.stringify({ userId: req.userId })
                                });
                                const data = await response.json();
                                if (data.ok) {
                                  setFriendRequests(prev => prev.filter(r => r.userId !== req.userId));
                                  showToast('Friend request declined', 'success');
                                } else {
                                  showToast(data.message || 'Failed to decline request', 'error');
                                }
                              } catch (e) {
                                console.error('Failed to decline friend request:', e);
                                showToast('Failed to decline request', 'error');
                              }
                            }}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAcceptFriendRequest(req.userId)}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          token={localStorage.getItem('token') || ''}
          onProfileUpdate={async (updatedUser) => {
            try {
              if (updatedUser) {
                setUser(updatedUser);
              }
              const response = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              const data = await response.json();
              if (data.ok && data.user) {
                setUser(data.user);
              }
              showToast('Profile updated successfully', 'success');
            } catch (e) {
              console.error('Failed to update profile:', e);
            }
          }}
        />
      )}

      {/* Add Friends Modal */}
      {showAddFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--app-panel)] rounded-2xl shadow-2xl w-full max-w-2xl border border-[var(--app-border)] max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-[var(--app-border)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Add Friends</h2>
                <button onClick={() => setShowAddFriendsModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search users by username..."
                  value={addFriendsSearchQuery}
                  onChange={(e) => setAddFriendsSearchQuery(e.target.value)}
                  className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--text-primary)] rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-[var(--app-accent)] transition-colors"
                />
                {isAddFriendsSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[var(--app-accent)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Search Results */}
              {addFriendsSearchQuery && addFriendsSearchResults.length > 0 ? (
                <div>
                  <div className="px-2 mb-2">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Search Results</span>
                  </div>
                  <div className="space-y-2">
                    {addFriendsSearchResults.map((searchUser) => {
                      const isAlreadyFriend = friends.some(f => f.userId === searchUser.userId);
                      const hasPendingRequest = friendRequests.some(r => r.userId === searchUser.userId);
                      
                      return (
                        <div key={searchUser.userId} className="flex items-center gap-3 p-3 bg-[var(--app-surface)] rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] flex items-center justify-center text-white font-bold overflow-hidden">
                            {searchUser.avatar ? <img src={searchUser.avatar} alt="" className="w-full h-full object-cover" /> : searchUser.username[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-[var(--text-primary)]">@{searchUser.username}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{searchUser.displayName || 'No display name'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setSelectedProfile(searchUser); setShowAddFriendsModal(false); }}
                              className="px-3 py-1.5 bg-[var(--app-surface-hover)] hover:bg-[var(--app-surface)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
                            >
                              View Profile
                            </button>
                            {isAlreadyFriend ? (
                              <button
                                onClick={() => { setActiveContext({ type: 'dms', id: searchUser.userId }); setMainView('chat'); setShowAddFriendsModal(false); }}
                                className="px-3 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                Message
                              </button>
                            ) : hasPendingRequest ? (
                              <button
                                disabled
                                className="px-3 py-1.5 bg-[var(--app-surface)] text-[var(--text-secondary)] rounded-lg text-sm font-medium cursor-not-allowed"
                              >
                                Pending
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`${API_BASE}/api/auth/friends/request`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${localStorage.getItem('token')}`
                                      },
                                      body: JSON.stringify({ userId: searchUser.userId })
                                    });
                                    const data = await response.json();
                                    if (data.ok) {
                                      showToast('Friend request sent!', 'success');
                                      setFriendRequests(prev => [...prev, { userId: searchUser.userId, username: searchUser.username }]);
                                    } else {
                                      showToast(data.message || 'Failed to send friend request', 'error');
                                    }
                                  } catch (e) {
                                    console.error('Failed to send friend request:', e);
                                    showToast('Failed to send friend request', 'error');
                                  }
                                }}
                                className="px-3 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                Add Friend
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : addFriendsSearchQuery && addFriendsSearchResults.length === 0 ? (
                <p className="text-center text-[var(--text-secondary)] py-8">No users found</p>
              ) : (
                <p className="text-center text-[var(--text-secondary)] py-8">Search for users by username to add them as friends</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      {selectedProfile && (
        <UserProfileModal
          selectedProfile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onAddFriend={async (userId) => {
            try {
              const response = await fetch(`${API_BASE}/api/auth/friends/request`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ userId: userId })
              });
              const data = await response.json();
              if (data.ok) {
                showToast('Friend request sent!', 'success');
                setFriendRequests(prev => [...prev, { userId: selectedProfile.userId, username: selectedProfile.username }]);
              } else {
                showToast(data.message || 'Failed to send friend request', 'error');
              }
            } catch (e) {
              console.error('Failed to send friend request:', e);
              showToast('Failed to send friend request', 'error');
            }
          }}
          onRemoveFriend={async (userId) => {
            try {
              await fetch(`${API_BASE}/api/auth/friends/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ friendUserId: userId })
              });
              loadFriends();
              setSelectedProfile(null);
              showToast('Friend removed', 'success');
            } catch (e) {
              showToast('Failed to remove friend', 'error');
            }
          }}
          onBlock={async (userId) => {
            try {
              const response = await fetch(`${API_BASE}/api/auth/friends/block`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, 
                body: JSON.stringify({ targetUserId: userId }) 
              });
              const data = await response.json();
              if (!response.ok || !data.ok) throw new Error(data.message || 'Failed to block user');
              setBlockedUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
              void fetch(`${API_BASE}/api/auth/friends/blocked`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
              })
                .then(response => response.json())
                .then(blockedData => {
                  if (blockedData.ok) {
                    setBlockedUserProfiles(blockedData.users || []);
                    setBlockedUsers((blockedData.users || []).map((blockedUser: User) => blockedUser.userId));
                  }
                })
                .catch(error => console.error('Failed to refresh blocked users:', error));
              loadFriends();
              loadConversations();
              setSelectedProfile(null);
              setActiveContext({ type: 'dms', id: userId });
              setMainView('chat');
              showToast('User blocked', 'success');
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to block user', 'error');
            }
          }}
          onReport={async (userId) => {
            try {
              await fetch(`${API_BASE}/api/auth/friends/report`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, 
                body: JSON.stringify({ targetUserId: userId }) 
              });
              setSelectedProfile(null);
              showToast('User reported', 'success');
            } catch (e) {
              showToast('Failed to report user', 'error');
            }
          }}
          onOpenSavedMessages={() => {
            if (user) setActiveContext({ type: 'dms', id: user.userId, name: 'Saved Messages' });
            setSelectedProfile(null);
          }}
          isFriend={friends.some(f => f.userId === selectedProfile.userId)}
          onMessageUser={(userId) => {
            setActiveContext({ type: 'dms', id: userId });
            setSelectedProfile(null);
          }}
          onSendOneTimeMessage={(userId, username) => {
            handleSendOneTimeMessage(userId, username);
          }}
          canSendOneTimeMessage={!checkCooldownForUser(selectedProfile.userId).isOnCooldown}
          allowOneTimeMessages={selectedProfile.allowOneTimeMessages !== false && selectedProfile.allowOneTimeMessages !== undefined ? selectedProfile.allowOneTimeMessages : true}
          cooldownInfo={checkCooldownForUser(selectedProfile.userId)}
        />
      )}

      {/* One-Time Message Modal */}
      {oneTimeMessageModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--app-panel)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--app-border)]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Send One-Time Message</h2>
                <button onClick={() => setOneTimeMessageModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">To: @{oneTimeMessageModal.username}</label>
                  <textarea
                    value={oneTimeMessageContent}
                    onChange={(e) => setOneTimeMessageContent(e.target.value)}
                    placeholder="Type your message..."
                    rows={4}
                    maxLength={500}
                    className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--text-primary)] px-4 py-2.5 rounded-xl focus:outline-none focus:border-[var(--app-accent)] resize-none"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{oneTimeMessageContent.length}/500</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  You can send one message every 3 days. This message will appear in their DMs as a request.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOneTimeMessageModal(null)}
                    className="flex-1 py-2.5 bg-[var(--app-surface)] text-[var(--text-primary)] rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendOneTimeMessageSubmit}
                    className="flex-1 py-2.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-xl font-medium transition-colors"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          className="fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 toast-slide-in"
          style={{
            background: 'color-mix(in srgb, var(--app-panel) 90%, transparent)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--app-border)',
            borderLeft: `4px solid ${toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : 'var(--app-accent)'}`
          }}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {toast.type === 'error' && <X className="w-5 h-5 text-red-500" />}
          {toast.type === 'info' && <Bell className="w-5 h-5 text-[var(--app-accent)]" />}
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{toast.message}</p>
        </div>
      )}
    </div>
    </CallProvider>
  );
}

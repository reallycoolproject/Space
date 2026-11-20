import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Hash, Headphones, Plus, Settings, Send, Users, Copy, Shield, X, Smile, Sticker, MessageSquare, Archive, Lock, Unlock, Trash2, ArrowUp, ArrowDown, Search, Server, ShieldCheck, UserRound, Sparkles, Link2, Ban, ImagePlus, Menu, CornerUpLeft, AtSign, ExternalLink, CopyCheck, MoreHorizontal, GripVertical, Mic, ChevronDown, Volume2, Megaphone, Clock, UserMinus, ShieldAlert, Check, Bell, LogOut, Crown, Edit3, Bot, History, ScrollText } from 'lucide-react'
import type { Socket } from 'socket.io-client'
import type { Message, User } from '../../types/chat'
import { API_BASE } from '../../config'
import { decryptText, encryptGroupMessagePayload, rewrapGroupMessageKeyForRecipient } from '../../utils/crypto'
import { getSentMessageFromDB, getSentMessageMemory, saveSentMessageToDB, cacheSentMessageMemory } from '../../utils/db'
import { SpaceMemberQuickProfile } from './SpaceMemberQuickProfile'
import { SpaceModeratorViewModal } from './SpaceModeratorViewModal'
import { VoiceChannelStage } from '../../calls/VoiceChannelStage'
import { VoiceChannelMembers } from '../../calls/VoiceChannelMembers'
import { useCall } from '../../calls/CallContext'
import { VoiceRecorderBar } from '../chat/VoiceRecorderBar'
import { useVoiceRecorder } from '../../calls/useVoiceRecorder'
import { VoiceMessagePlayer } from '../chat/VoiceMessagePlayer'
import {
  ChannelEditModal,
  CategoryEditModal,
  CreateChannelModal,
  CreateCategoryModal,
  ChannelsSettingsTreeView
} from './SpaceChannelSettings'

import { EmojiGifPicker } from '../chat/EmojiGifPicker'
import { NikoStudioModal } from './NikoStudioModal'
import { NikoEmbedCard, NikoActionRows } from './NikoEmbedCard'
import { NikoSlashCommandMenu, type SlashCommandDef } from './NikoSlashCommandMenu'

const PERMISSIONS = [
  ['VIEW_CHANNEL', 'View channels', 'See channels and read their conversations.'],
  ['SEND_MESSAGES', 'Send messages', 'Post messages in text and announcement channels.'],
  ['READ_MESSAGE_HISTORY', 'Read message history', 'See messages sent before you joined.'],
  ['ADD_REACTIONS', 'Add reactions', 'React to messages with emoji.'],
  ['ATTACH_FILES', 'Attach files', 'Share files in conversations.'],
  ['EMBED_LINKS', 'Embed links', 'Show rich previews for shared links.'],
  ['MENTION_EVERYONE', 'Mention everyone', 'Notify everyone who can see the channel.'],
  ['MANAGE_MESSAGES', 'Manage messages', 'Remove messages from other members.'],
  ['CONNECT', 'Connect to voice', 'Join voice channels when they are available.'],
  ['SPEAK', 'Speak', 'Talk in voice channels when they are available.'],
  ['CHANGE_NICKNAME', 'Change nickname', 'Set your own Space nickname.'],
  ['MANAGE_NICKNAMES', 'Manage nicknames', 'Change nicknames for other members.'],
  ['KICK_MEMBERS', 'Remove members', 'Remove members from the Space.'],
  ['BAN_MEMBERS', 'Ban members', 'Ban members and manage the ban list.'],
  ['CREATE_INVITE', 'Create invites', 'Create links for people to join.'],
  ['MANAGE_CHANNELS', 'Manage channels', 'Create, edit, reorder, and remove channels.'],
  ['MANAGE_ROLES', 'Manage roles', 'Create roles and assign permissions.'],
  ['MANAGE_EMOJIS_AND_STICKERS', 'Manage emoji and stickers', 'Upload and remove Space artwork.'],
  ['MANAGE_SPACE', 'Manage Space', 'Change Space-wide settings and invites.'],
  ['ADMINISTRATOR', 'Administrator', 'Grant every permission and bypass channel restrictions.'],
  ['CREATE_PUBLIC_THREADS', 'Create public threads', 'Start a discussion from a channel message.'],
  ['CREATE_PRIVATE_THREADS', 'Create private threads', 'Start discussions limited to invited members.'],
  ['SEND_MESSAGES_IN_THREADS', 'Reply in threads', 'Send messages in thread conversations.'],
  ['MANAGE_THREADS', 'Manage threads', 'Archive, lock, and remove discussions.'],
  ['CREATE_EVENTS', 'Create events', 'Schedule events for Space members.'],
  ['MANAGE_EVENTS', 'Manage events', 'Edit and cancel events created by others.'],
  ['MANAGE_WEBHOOKS', 'Manage webhooks', 'Configure automated posting integrations.'],
  ['MODERATE_MEMBERS', 'Moderate members', 'Timeout members and review moderation details.']
] as const
type PermissionKey = typeof PERMISSIONS[number][0]
const PERMISSION_BITS = Object.fromEntries(PERMISSIONS.map(([key], index) => [key, 1 << index])) as Record<PermissionKey, number>
const can = (permissions: number, key: keyof typeof PERMISSION_BITS) => Boolean(permissions & PERMISSION_BITS[key])
const ALL_PERMISSION_BITS = Object.values(PERMISSION_BITS).reduce((all, bit) => all | bit, 0)
const PERMISSION_GROUPS: Array<{ title: string; description: string; keys: PermissionKey[] }> = [
  { title: 'Space access', description: 'What members can see and share across the Space.', keys: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY', 'CREATE_INVITE'] },
  { title: 'Messages & media', description: 'Posting, reactions, attachments, and moderation.', keys: ['SEND_MESSAGES', 'ADD_REACTIONS', 'ATTACH_FILES', 'EMBED_LINKS', 'MENTION_EVERYONE', 'MANAGE_MESSAGES'] },
  { title: 'Threads & events', description: 'Discussions, forum threads, and scheduled events.', keys: ['CREATE_PUBLIC_THREADS', 'CREATE_PRIVATE_THREADS', 'SEND_MESSAGES_IN_THREADS', 'MANAGE_THREADS', 'CREATE_EVENTS', 'MANAGE_EVENTS'] },
  { title: 'Members & roles', description: 'Member names, role access, and moderation tools.', keys: ['CHANGE_NICKNAME', 'MANAGE_NICKNAMES', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MODERATE_MEMBERS', 'MANAGE_ROLES'] },
  { title: 'Space management', description: 'Channels, custom art, integrations, and administration.', keys: ['MANAGE_CHANNELS', 'MANAGE_EMOJIS_AND_STICKERS', 'MANAGE_SPACE', 'MANAGE_WEBHOOKS', 'ADMINISTRATOR'] },
  { title: 'Voice', description: 'Voice access controls; live voice is not enabled yet.', keys: ['CONNECT', 'SPEAK'] }
]

interface SpaceRole {
  id: string
  name: string
  color: string
  icon?: string
  permissions: number
  position: number
  hoist?: boolean
  mentionable?: boolean
}

interface SpacePermissionOverwrite {
  roleId: string
  allow: number
  deny: number
}

interface SpaceChannel {
  id: string
  name: string
  type: 'text' | 'voice' | 'announcement' | 'forum'
  topic: string
  categoryId: string
  position: number
  slowmodeSeconds?: number
  nsfw?: boolean
  forumTags?: string[]
  bitrate?: number
  userLimit?: number
  permissionOverwrites: SpacePermissionOverwrite[]
}

interface SpaceCategory {
  id: string
  name: string
  parentId: string
  position: number
  permissionOverwrites: SpacePermissionOverwrite[]
}

interface SpaceMember {
  userId: string
  username: string
  displayName?: string
  nickname?: string
  avatar?: string
  banner?: string
  bio?: string
  pronouns?: string
  status?: 'active' | 'inactive' | 'dnd'
  accountCreatedAt?: string
  themeGradient?: { color1?: string; color2?: string; angle?: number }
  publicKey?: string
  roleIds: string[]
  temporaryRoleAssignments?: Array<{ roleId: string; expiresAt: string }>
  joinedAt?: string
  mutedUntil?: string | null
  activity?: any
  connections?: any[]
}

interface SpaceThread {
  id: string
  channelId: string
  title: string
  starterMessageId?: string
  createdBy: string
  private?: boolean
  memberIds?: string[]
  tags?: string[]
  archived: boolean
  locked: boolean
  lastActivityAt: string
}

interface SpaceEvent {
  _id: string
  name: string
  description: string
  location: string
  scheduledStartAt: string
  scheduledEndAt?: string
  createdBy: string
  interestedUserIds: string[]
}

interface SpaceInvite {
  code: string
  creatorId: string
  createdAt: string
  expiresAt?: string
  maxUses?: number
  uses: number
}

interface SpaceData {
  _id: string
  name: string
  description: string
  icon: string
  banner: string
  ownerId: string
  inviteCode: string
  members: SpaceMember[]
  roles: SpaceRole[]
  channels: SpaceChannel[]
  categories: SpaceCategory[]
  emojis: Array<{ id: string; name: string; url: string; animated?: boolean }>
  stickers: Array<{ id: string; name: string; url: string; animated?: boolean; associatedEmoji?: string }>
  verificationLevel: string
  defaultNotifications: string
  explicitContentFilter: string
  invitesPaused: boolean
  isPublic: boolean
  widgetEnabled: boolean
  widgetChannelId: string
  shareHistoryWithNewMembers: boolean
  welcomeChannelId?: string
  welcomeMessageTemplate?: string
  autoRoleId?: string
  systemChannelId?: string
  rulesChannelId?: string
}

interface SpaceViewProps {
  spaceId: string
  initialChannelId?: string
  initialMessageId?: string
  initialThreadId?: string
  user: User
  privateKey?: CryptoKey | null
  socket?: Socket | null
  onViewProfile?: (profile: Record<string, unknown>) => void
  onMessageUser?: (userId: string) => void
  onExit: () => void
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

export function SpaceView({ spaceId, initialChannelId, initialMessageId, initialThreadId, user, privateKey, socket, onViewProfile, onMessageUser, onExit }: SpaceViewProps) {
  const [space, setSpace] = useState<SpaceData | null>(null)
  const call = useCall();
  const recorder = useVoiceRecorder();
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  useEffect(() => {
    if (spaceId && call) {
      call.loadVoiceRooms(spaceId);
    }
  }, [spaceId, call]);

  useEffect(() => {
    const handleOpenVoice = (event: any) => {
      const detail = event?.detail;
      if (detail && detail.spaceId === spaceId && detail.channelId) {
        setSelectedChannelId(detail.channelId);
      }
    };
    window.addEventListener('space:open-voice', handleOpenVoice);
    return () => window.removeEventListener('space:open-voice', handleOpenVoice);
  }, [spaceId]);

  const handleSendVoice = async () => {
    if (isSendingVoice) return;
    setIsSendingVoice(true);
    try {
      const result = await recorder.stop();
      if (result) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          void sendPayload({
            text: '',
            mediaType: 'audio',
            mediaUrl: base64,
            durationMs: result.durationMs,
            waveform: result.waveform
          });
        };
        reader.readAsDataURL(result.blob);
      }
    } catch (err) {
      console.error('Failed to send voice message:', err);
    } finally {
      setIsSendingVoice(false);
    }
  };

  const [selectedChannelId, setSelectedChannelId] = useState(initialChannelId || '')
  const [messages, setMessages] = useState<Message[]>([])
  const [threads, setThreads] = useState<SpaceThread[]>([])
  const [activeThread, setActiveThread] = useState<SpaceThread | null>(null)
  const [showArchivedThreads, setShowArchivedThreads] = useState(false)
  const [events, setEvents] = useState<SpaceEvent[]>([])
  const [invites, setInvites] = useState<SpaceInvite[]>([])
  const [bans, setBans] = useState<Array<{ userId: string; username: string; displayName?: string; reason: string; bannedAt?: string | null }>>([])
  const [decrypted, setDecrypted] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [draftCursor, setDraftCursor] = useState(0)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const [mentionSuggestionsOpen, setMentionSuggestionsOpen] = useState(true)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashCommandQuery, setSlashCommandQuery] = useState('')
  const [replyTarget, setReplyTarget] = useState<Message | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [threadTitle, setThreadTitle] = useState('')
  const [forumPostTags, setForumPostTags] = useState<string[]>([])
  const [eventName, setEventName] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [editingEventId, setEditingEventId] = useState('')
  const [editEventName, setEditEventName] = useState('')
  const [editEventDescription, setEditEventDescription] = useState('')
  const [editEventLocation, setEditEventLocation] = useState('')
  const [editEventStart, setEditEventStart] = useState('')
  const [inviteExpiry, setInviteExpiry] = useState('1440')
  const [inviteUses, setInviteUses] = useState('0')
  const [loading, setLoading] = useState(true)
  const hasLoadedSpaceRef = useRef(false)
  const historyShareAttemptRef = useRef(new Set<string>())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [assetTab, setAssetTab] = useState<'emoji' | 'stickers'>('emoji')
  const assetTriggerRef = useRef<HTMLButtonElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [showMembers, setShowMembers] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches)
  const [showChannels, setShowChannels] = useState(false)
  const [developerMode, setDeveloperMode] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('developerMode') === 'true')
  const [copyIdMenu, setCopyIdMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [quickProfileMember, setQuickProfileMember] = useState<SpaceMember | null>(null)
  const [quickProfileAnchor, setQuickProfileAnchor] = useState<{ x: number; y: number } | null>(null)
  const [draggedSpaceItem, setDraggedSpaceItem] = useState<{ type: 'channel' | 'category'; id: string } | null>(null)
  const [dragOverState, setDragOverState] = useState<{
    type: 'channel' | 'category'
    id: string
    edge: 'top' | 'bottom' | 'inside'
  } | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [settingsTab, setSettingsTab] = useState<'overview' | 'channels' | 'roles' | 'members' | 'assets' | 'invites' | 'bans' | 'audit' | 'niko'>('overview')
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; actorId: string; actorName: string; action: string; targetId: string; details: Record<string, unknown>; createdAt: string }>>([])
  const [viewingRoleIds, setViewingRoleIds] = useState<string[] | null>(null)
  const [editingChannel, setEditingChannel] = useState<SpaceChannel | null>(null)
  const [editingCategory, setEditingCategory] = useState<SpaceCategory | null>(null)
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false)
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false)
  const [createChannelTargetCategoryId, setCreateChannelTargetCategoryId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<'text' | 'voice' | 'announcement' | 'forum'>('text')
  const [channelCategoryId, setChannelCategoryId] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryParentId, setCategoryParentId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [roleIcon, setRoleIcon] = useState('')
  const [rolePermissions, setRolePermissions] = useState(0)
  const [newRoleColor, setNewRoleColor] = useState('#8b5cf6')
  const [assetName, setAssetName] = useState('')
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [assetEmoji, setAssetEmoji] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  const [spaceAssetSearch, setSpaceAssetSearch] = useState('')
  const [spaceImageLoading, setSpaceImageLoading] = useState<'icon' | 'banner' | ''>('')
  const [assetType, setAssetType] = useState<'emojis' | 'stickers'>('emojis')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false)
  const spaceMenuRef = useRef<HTMLDivElement>(null)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [modMenuTarget, setModMenuTarget] = useState<{ member: SpaceMember; x: number; y: number } | null>(null)
  const [timeoutModalMember, setTimeoutModalMember] = useState<SpaceMember | null>(null)
  const [timeoutDurationMinutes, setTimeoutDurationMinutes] = useState(5)
  const [kickModalMember, setKickModalMember] = useState<SpaceMember | null>(null)
  const [kickReason, setKickReason] = useState('')
  const [banModalMember, setBanModalMember] = useState<SpaceMember | null>(null)
  const [banReason, setBanReason] = useState('')
  const [nicknameModalMember, setNicknameModalMember] = useState<SpaceMember | null>(null)
  const [nicknameValue, setNicknameValue] = useState('')
  const [rolesModalMember, setRolesModalMember] = useState<SpaceMember | null>(null)
  const [slowmodeRemaining, setSlowmodeRemaining] = useState(0)

  useEffect(() => {
    if (!spaceMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (spaceMenuRef.current && !spaceMenuRef.current.contains(e.target as Node)) {
        setSpaceMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [spaceMenuOpen])

  useEffect(() => {
    if (slowmodeRemaining <= 0) return
    const timer = window.setInterval(() => {
      setSlowmodeRemaining(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [slowmodeRemaining])

  const handleTimeoutMember = async (userId: string, durationMinutes: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${userId}/timeout`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: durationMinutes === 0 ? null : durationMinutes })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update timeout.')
      setTimeoutModalMember(null)
      await loadSpace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not timeout member.')
    }
  }

  const handleKickMember = async (userId: string, reason?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${userId}/kick`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not kick member.')
      setKickModalMember(null)
      setKickReason('')
      await loadSpace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not kick member.')
    }
  }

  const handleBanMember = async (userId: string, reason?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${userId}/ban`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not ban member.')
      setBanModalMember(null)
      setBanReason('')
      await loadSpace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not ban member.')
    }
  }

  const handleUpdateNickname = async (userId: string, nickname: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${userId}/nickname`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update nickname.')
      setNicknameModalMember(null)
      setNicknameValue('')
      await loadSpace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update nickname.')
    }
  }

  const handleToggleMemberRole = async (userId: string, roleId: string, durationHours?: number) => {
    const targetMember = space?.members.find(m => m.userId === userId)
    if (!targetMember) return
    const nextRoleIds = targetMember.roleIds.includes(roleId)
      ? targetMember.roleIds.filter(id => id !== roleId)
      : [...targetMember.roleIds, roleId]
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${userId}/roles`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleIds: nextRoleIds,
          ...(durationHours ? { temporaryRoleHours: { [roleId]: durationHours } } : {})
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update roles.')
      await loadSpace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update roles.')
    }
  }

  const handleLeaveSpace = async () => {
    if (!window.confirm(`Are you sure you want to leave ${space?.name}?`)) return
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/leave`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not leave this Space.')
      onExit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave this Space.')
    }
  }


  useEffect(() => {
    const update = () => setDeveloperMode(window.localStorage.getItem('developerMode') === 'true')
    window.addEventListener('developer-mode-changed', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('developer-mode-changed', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    if (!copyIdMenu) return
    const close = () => setCopyIdMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [copyIdMenu])

  const openCopyIdMenu = (event: React.MouseEvent, id: string) => {
    if (!developerMode) return
    event.preventDefault()
    setCopyIdMenu({ id, x: event.clientX, y: event.clientY })
  }

  const selectedChannel = space?.channels.find(channel => channel.id === selectedChannelId)
  const member = space?.members.find(item => item.userId === user.userId)
  const rolePreviewActive = viewingRoleIds !== null
  const activeMemberRoleIds = useMemo(() => {
    if (!member) return []
    const expirations = new Map((member.temporaryRoleAssignments || []).map(item => [item.roleId, Date.parse(item.expiresAt)]))
    return member.roleIds.filter(roleId => !expirations.has(roleId) || (expirations.get(roleId) || 0) > Date.now())
  }, [member])
  const effectiveRoleIds = useMemo(() => viewingRoleIds ?? activeMemberRoleIds, [activeMemberRoleIds, viewingRoleIds])
  const rolePermissionsForUser = useMemo(() => {
    if (!space || !member) return 0
    if (space.ownerId === user.userId && !rolePreviewActive) return ALL_PERMISSION_BITS
    const everyone = space.roles.find(role => role.id === 'everyone')?.permissions || 0
    return effectiveRoleIds.reduce((permissions, roleId) =>
      permissions | (space.roles.find(role => role.id === roleId)?.permissions || 0), everyone)
  }, [effectiveRoleIds, member, rolePreviewActive, space, user.userId])
  const permissionsForChannel = useCallback((channel: SpaceChannel) => {
    if (!space || !member) return rolePermissionsForUser
    if ((!rolePreviewActive && space.ownerId === user.userId) || can(rolePermissionsForUser, 'ADMINISTRATOR')) return rolePermissionsForUser
    const categoryLayers: SpacePermissionOverwrite[][] = []
    let category = space.categories.find(item => item.id === channel.categoryId)
    const visited = new Set<string>()
    while (category && !visited.has(category.id)) {
      visited.add(category.id)
      categoryLayers.unshift(category.permissionOverwrites || [])
      category = category.parentId ? space.categories.find(item => item.id === category!.parentId) : undefined
    }
    let permissions = rolePermissionsForUser
    for (const overwrites of [...categoryLayers, channel.permissionOverwrites || []]) {
      const everyone = overwrites.find(item => item.roleId === 'everyone')
      if (everyone) permissions = (permissions & ~everyone.deny) | everyone.allow
      let deny = 0
      let allow = 0
      for (const overwrite of overwrites) {
        if (effectiveRoleIds.includes(overwrite.roleId)) {
          deny |= overwrite.deny
          allow |= overwrite.allow
        }
      }
      permissions = (permissions & ~deny) | allow
      if (!rolePreviewActive) {
        const memberOverwrite = overwrites.find(item => item.roleId === user.userId)
        if (memberOverwrite) permissions = (permissions & ~memberOverwrite.deny) | memberOverwrite.allow
      }
    }
    return permissions
  }, [effectiveRoleIds, member, rolePermissionsForUser, rolePreviewActive, space, user.userId])
  const channelPermissions = useMemo(() => {
    return selectedChannel ? permissionsForChannel(selectedChannel) : rolePermissionsForUser
  }, [permissionsForChannel, rolePermissionsForUser, selectedChannel])
  const visibleChannels = useMemo(() => (space?.channels || []).filter(channel =>
    can(permissionsForChannel(channel), 'VIEW_CHANNEL')
  ), [permissionsForChannel, space?.channels])
  const visibleThreads = rolePreviewActive
    ? threads.filter(thread => !thread.private || can(channelPermissions, 'MANAGE_THREADS'))
    : threads
  const widgetChannels = useMemo(() => (space?.channels || []).filter(channel => {
    if (!space) return false
    const everyoneRole = space.roles.find(role => role.id === 'everyone')
    let permissions = everyoneRole?.permissions || 0
    if (can(permissions, 'ADMINISTRATOR')) return channel.type !== 'voice'
    const categoryLayers: SpacePermissionOverwrite[][] = []
    let category = space.categories.find(item => item.id === channel.categoryId)
    const visited = new Set<string>()
    while (category && !visited.has(category.id)) {
      visited.add(category.id)
      categoryLayers.unshift(category.permissionOverwrites || [])
      category = category.parentId ? space.categories.find(item => item.id === category!.parentId) : undefined
    }
    for (const overwrites of [...categoryLayers, channel.permissionOverwrites || []]) {
      const everyone = overwrites.find(item => item.roleId === 'everyone')
      if (everyone) permissions = (permissions & ~everyone.deny) | everyone.allow
    }
    return channel.type !== 'voice' && can(permissions, 'VIEW_CHANNEL')
  }), [space])
  useEffect(() => {
    if (!rolePreviewActive || !selectedChannelId || visibleChannels.some(channel => channel.id === selectedChannelId)) return
    setSelectedChannelId(visibleChannels.find(channel => channel.type !== 'voice')?.id || visibleChannels[0]?.id || '')
  }, [rolePreviewActive, selectedChannelId, visibleChannels])
  const isAdministrator = !rolePreviewActive && (can(rolePermissionsForUser, 'ADMINISTRATOR') || space?.ownerId === user.userId)
  const canManageSpace = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MANAGE_SPACE'))
  const canManageChannels = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MANAGE_CHANNELS'))
  const canManageRoles = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MANAGE_ROLES'))
  const actorTopRolePosition = Math.max(0, ...(space?.roles || []).filter(role => space?.members.find(member => member.userId === user.userId)?.roleIds.includes(role.id)).map(role => role.position))
  const manageableMemberRoles = (space?.roles || []).filter(role => role.id !== 'everyone' && (
    space?.ownerId === user.userId || (canManageRoles && role.position < actorTopRolePosition)
  ))
  const canManageAssets = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MANAGE_EMOJIS_AND_STICKERS'))
  const canInvite = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'CREATE_INVITE'))
  const canKick = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'KICK_MEMBERS'))
  const canBan = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'BAN_MEMBERS'))
  const canModerate = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MODERATE_MEMBERS'))
  const canManageNicknames = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'MANAGE_NICKNAMES'))
  const canChangeOwnNickname = !rolePreviewActive && (isAdministrator || can(rolePermissionsForUser, 'CHANGE_NICKNAME'))
  const exitRolePreview = useCallback(() => setViewingRoleIds(null), [])
  useEffect(() => {
    if (!rolePreviewActive) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitRolePreview()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exitRolePreview, rolePreviewActive])
  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    return [...(space?.members || [])]
      .filter(item => !query || `${item.nickname || ''} ${item.displayName || ''} ${item.username || ''}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const aName = (a.nickname || a.displayName || a.username).toLowerCase()
        const bName = (b.nickname || b.displayName || b.username).toLowerCase()
        return aName.localeCompare(bName)
      })
  }, [memberSearch, space?.members])

  interface MemberGroupSection {
    id: string
    title: string
    color?: string
    icon?: string
    members: SpaceMember[]
  }

  const groupedMemberSections = useMemo(() => {
    if (!space) return []
    const query = memberSearch.trim().toLowerCase()
    const filtered = space.members.filter(item =>
      !query || `${item.nickname || ''} ${item.displayName || ''} ${item.username || ''}`.toLowerCase().includes(query)
    )

    const hoistedRoles = [...space.roles]
      .filter(role => role.hoist && role.id !== 'everyone')
      .sort((a, b) => b.position - a.position)

    const sections: MemberGroupSection[] = []
    const assignedUserIds = new Set<string>()

    for (const role of hoistedRoles) {
      const roleMembers = filtered.filter(item => {
        if (assignedUserIds.has(item.userId)) return false
        if (!item.status) return false
        if (!item.roleIds.includes(role.id)) return false
        const memberHoistedRoles = hoistedRoles.filter(r => item.roleIds.includes(r.id))
        return memberHoistedRoles[0]?.id === role.id
      }).sort((a, b) => {
        const aName = (a.nickname || a.displayName || a.username).toLowerCase()
        const bName = (b.nickname || b.displayName || b.username).toLowerCase()
        return aName.localeCompare(bName)
      })

      if (roleMembers.length > 0) {
        sections.push({
          id: role.id,
          title: role.name.toUpperCase(),
          color: role.color,
          icon: role.icon,
          members: roleMembers
        })
        for (const m of roleMembers) assignedUserIds.add(m.userId)
      }
    }

    const onlineRemaining = filtered.filter(item => {
      if (assignedUserIds.has(item.userId)) return false
      return Boolean(item.status)
    }).sort((a, b) => {
      const aName = (a.nickname || a.displayName || a.username).toLowerCase()
      const bName = (b.nickname || b.displayName || b.username).toLowerCase()
      return aName.localeCompare(bName)
    })

    if (onlineRemaining.length > 0) {
      sections.push({
        id: 'online',
        title: 'ONLINE',
        members: onlineRemaining
      })
      for (const m of onlineRemaining) assignedUserIds.add(m.userId)
    }

    const offlineMembers = filtered.filter(item => {
      return !assignedUserIds.has(item.userId)
    }).sort((a, b) => {
      const aName = (a.nickname || a.displayName || a.username).toLowerCase()
      const bName = (b.nickname || b.displayName || b.username).toLowerCase()
      return aName.localeCompare(bName)
    })

    if (offlineMembers.length > 0) {
      sections.push({
        id: 'offline',
        title: 'OFFLINE',
        members: offlineMembers
      })
    }

    return sections
  }, [memberSearch, space])
  const searchedMessages = useMemo(() => {
    if (!messageSearchQuery.trim()) return messages
    const filters = Array.from(messageSearchQuery.matchAll(/"([^"]+)"|(\S+)/g), match => match[1] || match[2])
    return messages.filter(message => {
      const content = decrypted[message.id] || ''
      const text = getMessagePreview(content).toLowerCase()
      return filters.every(filter => {
        const separator = filter.indexOf(':')
        if (separator < 0) return text.includes(filter.toLowerCase())
        const key = filter.slice(0, separator).toLowerCase()
        const value = filter.slice(separator + 1).toLowerCase()
        const timestamp = new Date(message.timestamp).getTime()
        const date = Date.parse(`${value}T00:00:00Z`)
        if (key === 'from') {
          const sender = space?.members.find(item => item.userId === message.senderId)
          return `${message.senderName} ${sender?.username || ''} ${sender?.displayName || ''}`.toLowerCase().includes(value)
        }
        if (key === 'mentions') {
          const mentioned = space?.members.find(item => item.username.toLowerCase() === value || item.userId.toLowerCase() === value)
          return Boolean(mentioned && (message.mentions || []).includes(mentioned.userId)) || text.includes(`@${value}`)
        }
        if (key === 'in') return selectedChannel?.name.toLowerCase() === value
        if (key === 'after') return Number.isFinite(date) && timestamp >= date
        if (key === 'before') return Number.isFinite(date) && timestamp < date
        if (key === 'during') return Number.isFinite(date) && timestamp >= date && timestamp < date + 86400000
        if (key === 'has') {
          let payload: { mediaType?: string; mediaUrl?: string } = {}
          try { payload = JSON.parse(content) } catch { /* Plain text message. */ }
          if (value === 'link') return /https?:\/\/[^\s<>]+/i.test(text)
          if (value === 'image') return payload.mediaType === 'image' || payload.mediaType === 'photo'
          if (value === 'video') return payload.mediaType === 'video'
          if (value === 'file') return Boolean(payload.mediaType && !['sticker', 'image', 'photo', 'video'].includes(payload.mediaType))
          return false
        }
        return false
      })
    })
  }, [decrypted, messageSearchQuery, messages, selectedChannel?.name, space?.members])
  const memberNameColor = (userId: string) => {
    if (!space) return undefined
    const target = space.members.find(item => item.userId === userId)
    if (!target) return undefined
    return space.roles
      .filter(role => target.roleIds.includes(role.id))
      .sort((a, b) => b.position - a.position)[0]?.color
  }
  const showSpaceProfile = (memberProfile: SpaceMember) => {
    if (!onViewProfile || !space) return
    const spaceRoles = space.roles
      .filter(role => memberProfile.roleIds.includes(role.id))
      .sort((a, b) => b.position - a.position)
      .map(role => ({ id: role.id, name: role.name, color: role.color, icon: role.icon }))
    onViewProfile({
      ...memberProfile,
      displayName: memberProfile.nickname || memberProfile.displayName || memberProfile.username,
      spaceRoles,
      spaceName: space.name,
      spaceId: space._id,
      spaceJoinedAt: memberProfile.joinedAt,
      spaceRoleIds: memberProfile.roleIds,
      spaceAvailableRoles: manageableMemberRoles.map(role => ({ id: role.id, name: role.name, color: role.color, icon: role.icon, position: role.position })),
      spaceModerationPermissions: {
        manageRoles: canManageRoles,
        moderateMembers: isAdministrator || can(rolePermissionsForUser, 'MODERATE_MEMBERS'),
        kickMembers: canKick,
        banMembers: canBan,
        isOwner: memberProfile.userId === space.ownerId
      }
    })
  }
  const showSpaceQuickProfile = (memberProfile: SpaceMember, event?: { clientX: number; clientY: number }) => {
    setQuickProfileMember(memberProfile)
    setQuickProfileAnchor(event ? { x: event.clientX, y: event.clientY } : null)
  }
  const mentionSpaceMember = (memberProfile: SpaceMember) => {
    const mention = `@${memberProfile.username} `
    setDraft(current => `${current}${current && !/\s$/.test(current) ? ' ' : ''}${mention}`)
    setQuickProfileMember(null)
    setQuickProfileAnchor(null)
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }
  const mentionMatch = draft.slice(0, draftCursor).match(/(^|\s)@([a-zA-Z0-9_.-]*)$/)
  const mentionQuery = mentionMatch?.[2].trim().toLowerCase() || ''
  const mentionOptions = useMemo(() => {
    if (!mentionMatch || !space) return []
    const options: Array<{
      userId: string;
      username: string;
      label: string;
      displayName?: string;
      avatar?: string;
      color?: string;
      kind: 'member' | 'everyone' | 'here' | 'role';
      roleId?: string;
    }> = []
    if (can(channelPermissions, 'MENTION_EVERYONE') && 'everyone'.startsWith(mentionQuery)) {
      options.push({ userId: 'everyone', username: 'everyone', label: 'Notify everyone who can see this channel', kind: 'everyone' })
    }
    if (can(channelPermissions, 'MENTION_EVERYONE') && 'here'.startsWith(mentionQuery)) {
      options.push({ userId: 'here', username: 'here', label: 'Notify active members who can see this channel', kind: 'here' })
    }
    options.push(...space.roles
      .filter(role => role.id !== 'everyone' && role.mentionable && (
        !mentionQuery || role.name.toLowerCase().includes(mentionQuery)
      ))
      .slice(0, 5)
      .map(role => ({
        userId: `role:${role.id}`,
        username: role.name,
        label: `Role`,
        kind: 'role' as const,
        roleId: role.id,
        color: role.color || '#5865F2'
      })))
    options.push(...space.members
      .filter(item => item.userId !== user.userId && item.username && (
        !mentionQuery ||
        item.username.toLowerCase().includes(mentionQuery) ||
        (item.displayName || item.nickname || '').toLowerCase().includes(mentionQuery)
      ))
      .slice(0, 7)
      .map(item => ({
        userId: item.userId,
        username: item.username,
        displayName: item.nickname || item.displayName || item.username,
        label: item.nickname || item.displayName ? `@${item.username}` : '',
        avatar: item.avatar,
        kind: 'member' as const
      })))
    return options.slice(0, 10)
  }, [channelPermissions, mentionMatch, mentionQuery, space, user.userId])
  const selectMention = (option: (typeof mentionOptions)[number]) => {
    if (!mentionMatch) return
    const tokenStart = draft.slice(0, draftCursor).lastIndexOf('@')
    const afterCursor = draft.slice(draftCursor)
    const nextWord = afterCursor.search(/\s/)
    const tokenEnd = nextWord < 0 ? draft.length : draftCursor + nextWord
    const replacement = `@${option.username} `
    const nextDraft = `${draft.slice(0, tokenStart)}${replacement}${draft.slice(tokenEnd)}`
    const nextCursor = tokenStart + replacement.length
    setDraft(nextDraft)
    setDraftCursor(nextCursor)
    setActiveMentionIndex(0)
    setMentionSuggestionsOpen(false)
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const insertComposerText = (text: string) => {
    const composer = composerRef.current
    const start = composer?.selectionStart ?? draft.length
    const end = composer?.selectionEnd ?? start
    const nextDraft = `${draft.slice(0, start)}${text}${draft.slice(end)}`
    const nextCursor = start + text.length
    setDraft(nextDraft)
    setDraftCursor(nextCursor)
    setShowAssets(false)
    setMentionSuggestionsOpen(false)
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  useEffect(() => {
    if (!selectedChannel?.nsfw) return
    const confirmationKey = `space_nsfw_confirmed_${user.userId}_${spaceId}`
    if (localStorage.getItem(confirmationKey) === 'true') return
    if (window.confirm('This channel is marked age-restricted. Continue only if you are legally old enough to view it.')) {
      localStorage.setItem(confirmationKey, 'true')
      return
    }
    const safeChannel = visibleChannels.find(channel => !channel.nsfw && channel.type !== 'voice')
    setSelectedChannelId(safeChannel?.id || '')
  }, [selectedChannel?.id, selectedChannel?.nsfw, spaceId, user.userId, visibleChannels])

  const loadSpace = useCallback(async () => {
    const showLoading = !hasLoadedSpaceRef.current
    if (showLoading) setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}`, { headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load this Space.')
      setSpace(data.space)
      hasLoadedSpaceRef.current = true
      setSelectedChannelId(current => {
        const preferred = current || initialChannelId || ''
        return data.space.channels.some((channel: SpaceChannel) => channel.id === preferred)
          ? preferred : data.space.channels.find((channel: SpaceChannel) => channel.type !== 'voice')?.id || ''
      })
      if (showLoading) setLoading(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this Space.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [initialChannelId, spaceId])

  useEffect(() => {
    hasLoadedSpaceRef.current = false
    setLoading(true)
    setSpace(null)
    setError('')
    void loadSpace()
  }, [loadSpace])

  useEffect(() => {
    if (!space?.shareHistoryWithNewMembers || !privateKey || !space.members.some(item => item.userId === user.userId)) return
    let active = true
    const shareHistory = async () => {
      for (const target of space.members) {
        if (!active || target.userId === user.userId || !target.publicKey || !target.joinedAt) continue
        const attemptKey = `${space._id}:${target.userId}`
        if (historyShareAttemptRef.current.has(attemptKey)) continue
        const packets: Array<{ messageId: string; wrappedKey: string }> = []
        const shareRoomHistory = async (roomId: string, channelName: string) => {
          let before = new Date(target.joinedAt!).toISOString()
          let hasMore = true
          while (active && hasMore) {
            const response = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(roomId)}?before=${encodeURIComponent(before)}&limit=100`, { headers: authHeaders() })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || `Could not read history in #${channelName}.`)
            const page = data.messages as Message[]
            for (const message of page) {
              if (!active || message.senderId === 'system') continue
              try {
                const wrappedKey = await rewrapGroupMessageKeyForRecipient(message.content, privateKey, user.userId, target.publicKey!)
                if (wrappedKey) packets.push({ messageId: message.id, wrappedKey })
              } catch {
                // Legacy ciphertext or messages not encrypted for this member cannot be rewrapped.
              }
            }
            while (packets.length >= 100 || (page.length < 100 && packets.length > 0)) {
              if (!packets.length) break
              const batch = packets.splice(0, 100)
              const shareResponse = await fetch(`${API_BASE}/api/spaces/${space._id}/history/share-keys`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: target.userId, packets: batch })
              })
              const shareData = await shareResponse.json()
              if (!shareResponse.ok || !shareData.ok) throw new Error(shareData.message || 'Could not share encrypted message history.')
            }
            if (page.length < 100) hasMore = false
            else {
              const oldest = page[page.length - 1]
              const cursor = new Date(oldest.timestamp).getTime() - 1
              if (!Number.isFinite(cursor) || cursor >= Date.parse(before)) hasMore = false
              else before = new Date(cursor).toISOString()
            }
          }
        }
        for (const channel of space.channels) {
          if (!active) return
          const roomId = `space:${space._id}:${channel.id}`
          await shareRoomHistory(roomId, channel.name)
          const threadsResponse = await fetch(`${API_BASE}/api/spaces/${space._id}/channels/${channel.id}/threads?includeArchived=true`, { headers: authHeaders() })
          const threadsData = await threadsResponse.json()
          if (!threadsResponse.ok || !threadsData.ok) throw new Error(threadsData.message || `Could not load discussions in #${channel.name}.`)
          for (const thread of threadsData.threads as SpaceThread[]) {
            if (thread.private && thread.createdBy !== target.userId && !thread.memberIds?.includes(target.userId)) continue
            await shareRoomHistory(`${roomId}:${thread.id}`, `${channel.name}/${thread.title}`)
          }
          if (packets.length) {
            const shareResponse = await fetch(`${API_BASE}/api/spaces/${space._id}/history/share-keys`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetUserId: target.userId, packets })
            })
            const shareData = await shareResponse.json()
            if (!shareResponse.ok || !shareData.ok) throw new Error(shareData.message || 'Could not share encrypted message history.')
            packets.length = 0
          }
        }
        historyShareAttemptRef.current.add(attemptKey)
      }
    }
    void shareHistory().catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : 'Could not share encrypted message history.')
    })
    return () => { active = false }
  }, [privateKey, space, user.userId])

  useEffect(() => {
    setActiveThread(null)
    if (!selectedChannelId) {
      setThreads([])
      return
    }
    let active = true
    fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${selectedChannelId}/threads${showArchivedThreads ? '?includeArchived=true' : ''}`, { headers: authHeaders() })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load discussions.')
        if (active) {
          const loadedThreads = data.threads || []
          setThreads(loadedThreads)
          setActiveThread(initialThreadId ? loadedThreads.find((thread: SpaceThread) => thread.id === initialThreadId) || null : null)
        }
      })
      .catch(caught => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load discussions.')
      })
    return () => { active = false }
  }, [initialThreadId, selectedChannelId, showArchivedThreads, spaceId])

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/spaces/${spaceId}/events`, { headers: authHeaders() })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load events.')
        if (active) setEvents(data.events || [])
      })
      .catch(caught => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load events.')
      })
    return () => { active = false }
  }, [spaceId])

  useEffect(() => {
    if (!socket) return
    const receive = (payload: { spaceId: string; event: SpaceEvent }) => {
      if (payload.spaceId !== spaceId) return
      setEvents(previous => previous.some(item => item._id === payload.event._id)
        ? previous
        : [...previous, payload.event].sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt)))
    }
    const update = (payload: { spaceId: string; event: SpaceEvent }) => {
      if (payload.spaceId !== spaceId) return
      setEvents(previous => previous.some(item => item._id === payload.event._id)
        ? previous.map(item => item._id === payload.event._id ? payload.event : item).sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt))
        : [...previous, payload.event].sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt)))
    }
    const remove = (payload: { spaceId: string; eventId: string }) => {
      if (payload.spaceId === spaceId) setEvents(previous => previous.filter(item => item._id !== payload.eventId))
    }
    socket.on('space:event-created', receive)
    socket.on('space:event-updated', update)
    socket.on('space:event-deleted', remove)
    return () => {
      socket.off('space:event-created', receive)
      socket.off('space:event-updated', update)
      socket.off('space:event-deleted', remove)
    }
  }, [socket, spaceId])

  useEffect(() => {
    if (!socket) return
    const updated = (payload: { spaceId: string }) => {
      if (payload.spaceId !== spaceId) return
      void loadSpace()
      if (!selectedChannelId) return
      fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${selectedChannelId}/threads${showArchivedThreads ? '?includeArchived=true' : ''}`, { headers: authHeaders() })
        .then(async response => {
          const data = await response.json()
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not refresh discussions.')
          setThreads(data.threads || [])
        })
        .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not refresh discussions.'))
    }
    const removed = (payload: { spaceId: string }) => {
      if (payload.spaceId === spaceId) onExit()
    }
    const deleted = (payload: { spaceId: string }) => {
      if (payload.spaceId === spaceId) onExit()
    }
    const threadDeleted = (payload: { threadId: string }) => {
      setThreads(previous => previous.filter(thread => thread.id !== payload.threadId))
      setActiveThread(previous => previous?.id === payload.threadId ? null : previous)
    }
    const userActivityHandler = (payload: { userId: string; activity: any }) => {
      setSpace(previous => {
        if (!previous) return previous;
        return {
          ...previous,
          members: previous.members.map(m => m.userId === payload.userId ? { ...m, activity: payload.activity } : m)
        };
      });
    };
    socket.on('space:updated', updated)
    socket.on('space:member-removed', removed)
    socket.on('space:deleted', deleted)
    socket.on('space:thread-deleted', threadDeleted)
    socket.on('user:activity', userActivityHandler)
    return () => {
      socket.off('space:updated', updated)
      socket.off('space:member-removed', removed)
      socket.off('space:deleted', deleted)
      socket.off('space:thread-deleted', threadDeleted)
      socket.off('user:activity', userActivityHandler)
    }
  }, [loadSpace, onExit, selectedChannelId, showArchivedThreads, socket, spaceId])

  useEffect(() => {
    if (!showSettings || !['invites', 'bans', 'audit'].includes(settingsTab)) return
    const endpoint = settingsTab === 'invites' ? 'invites' : settingsTab === 'bans' ? 'bans' : 'audit-logs'
    let active = true
    fetch(`${API_BASE}/api/spaces/${spaceId}/${endpoint}`, { headers: authHeaders() })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message || `Could not load ${endpoint}.`)
        if (!active) return
        if (settingsTab === 'invites') setInvites(data.invites || [])
        else if (settingsTab === 'bans') setBans(data.bans || [])
        else setAuditLogs(data.logs || [])
      })
      .catch(caught => {
        if (active) setError(caught instanceof Error ? caught.message : `Could not load ${endpoint}.`)
      })
    return () => { active = false }
  }, [settingsTab, showSettings, spaceId])

  const channelRoomId = selectedChannel
    ? activeThread ? `space:${spaceId}:${selectedChannel.id}:${activeThread.id}` : `space:${spaceId}:${selectedChannel.id}`
    : ''

  useEffect(() => {
    setReplyTarget(null)
    setMentionSuggestionsOpen(true)
    setActiveMentionIndex(0)
  }, [channelRoomId])

  useEffect(() => {
    if (replyTarget) requestAnimationFrame(() => composerRef.current?.focus())
  }, [replyTarget])

  useEffect(() => {
    if (!socket || !channelRoomId) return
    const join = () => socket.emit('join_room', { roomId: channelRoomId })
    join()
    socket.on('connect', join)
    return () => {
      socket.off('connect', join)
      socket.emit('leave_room', { roomId: channelRoomId })
    }
  }, [channelRoomId, socket])

  useEffect(() => {
    if (!channelRoomId) {
      setMessages([])
      setDecrypted({})
      return
    }
    if (initialThreadId && activeThread?.id !== initialThreadId) return
    let active = true
    setMessages([])
    setDecrypted({})
    const historyUrl = initialMessageId ? `?around=${encodeURIComponent(initialMessageId)}` : ''
    fetch(`${API_BASE}/api/messages/${encodeURIComponent(channelRoomId)}${historyUrl}`, { headers: authHeaders() })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load channel messages.')
        if (active) setMessages(data.messages)
      })
      .catch(caught => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load channel messages.')
      })
    return () => { active = false }
  }, [activeThread?.id, channelRoomId, initialMessageId, initialThreadId])

  useEffect(() => {
    if (!initialMessageId || !messages.some(message => message.id === initialMessageId)) return
    requestAnimationFrame(() => {
      document.getElementById(`space-message-${initialMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [initialMessageId, messages])

  useEffect(() => {
    if (!socket) return
    const historyShared = (payload: { spaceId: string }) => {
      if (payload.spaceId !== spaceId || !channelRoomId) return
      const historyUrl = initialMessageId ? `?around=${encodeURIComponent(initialMessageId)}` : ''
      fetch(`${API_BASE}/api/messages/${encodeURIComponent(channelRoomId)}${historyUrl}`, { headers: authHeaders() })
        .then(async response => {
          const data = await response.json()
          if (!response.ok || !data.ok) throw new Error(data.message || 'Could not refresh shared message history.')
          setMessages(data.messages)
        })
        .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not refresh shared message history.'))
    }
    const receive = (message: Message) => {
      if (message.roomId !== channelRoomId) return
      setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous, message])
    }
    const deleted = ({ id }: { id: string }) => {
      setMessages(previous => previous.filter(message => message.id !== id))
      setDecrypted(previous => {
        const next = { ...previous }
        delete next[id]
        return next
      })
      setReplyTarget(previous => previous?.id === id ? null : previous)
    }
    socket.on('message:receive', receive)
    socket.on('message:deleted', deleted)
    socket.on('space:history-shared', historyShared)
    return () => {
      socket.off('message:receive', receive)
      socket.off('message:deleted', deleted)
      socket.off('space:history-shared', historyShared)
    }
  }, [channelRoomId, initialMessageId, socket, spaceId])

  useEffect(() => {
    if (!user.userId) return
    let active = true

    // Even if privateKey is still initializing, immediately load any cached messages
    void Promise.all(messages.map(async message => {
      if (message.isSystemMessage) return [message.id, message.content] as const
      const cached = getSentMessageMemory(message.id) || await getSentMessageFromDB(user.userId, message.id)
      if (cached) return [message.id, cached] as const
      if (!privateKey) return [message.id, 'Decrypting…'] as const

      try {
        let envelope: any = null
        try {
          envelope = JSON.parse(message.content)
        } catch {
          // Legacy ciphertext is not JSON; decryptText handles its original format.
        }
        // Bot messages, Niko embeds, or non-E2EE text messages are already plaintext
        if (envelope && (envelope.isBot || envelope.embeds || (!envelope.e2ee && typeof envelope.text === 'string'))) {
          void saveSentMessageToDB(user.userId, message.id, message.content)
          return [message.id, message.content] as const
        }
        let ciphertext = message.content
        if (envelope?.e2ee) {
          if (envelope.s || envelope.r) {
            ciphertext = message.senderId === user.userId ? envelope.s || '' : envelope.r || ''
            if (!ciphertext) throw new Error('This message does not include an encryption key for this member.')
          } else {
            ciphertext = message.content
          }
        }
        const plaintext = await decryptText(ciphertext, privateKey, user.userId)
        void saveSentMessageToDB(user.userId, message.id, plaintext)
        return [message.id, plaintext] as const
      } catch {
        try {
          const legacyPayload = JSON.parse(message.content) as { text?: unknown }
          if (typeof legacyPayload.text === 'string') {
            void saveSentMessageToDB(user.userId, message.id, message.content)
            return [message.id, message.content] as const
          }
        } catch {
          // Non-JSON message bodies must be decrypted before display.
        }
        return [message.id, 'Unable to decrypt this message'] as const
      }
    })).then(entries => {
      if (active) setDecrypted(Object.fromEntries(entries))
    })
    return () => { active = false }
  }, [messages, privateKey, user.userId])

  const sendPayload = async (payload: { text: string; mediaType?: string; mediaUrl?: string; durationMs?: number; waveform?: number[] }) => {
    if (!space || !selectedChannel || !privateKey || saving) return
    const recipientKeyMap: Record<string, string> = {}
    for (const item of space.members) {
      if (item.publicKey) {
        recipientKeyMap[item.userId] = item.publicKey as string
      }
    }
    // Always guarantee that sender's own public key is included so sender can decrypt their message
    if (user.publicKey) {
      recipientKeyMap[user.userId] = user.publicKey
    }
    setSaving(true)
    setError('')
    try {
      const payloadString = JSON.stringify(payload)
      const content = await encryptGroupMessagePayload(payloadString, recipientKeyMap)
      const mentionedUserIds = Array.from(payload.text.matchAll(/@([\w.-]+)/g))
        .map(match => space.members.find(item => item.username.toLowerCase() === match[1].toLowerCase())?.userId)
        .filter((id): id is string => Boolean(id))
      const roleMentions = space.roles
        .filter(role => {
          if (!role.mentionable) return false
          const escapedName = role.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return new RegExp(`(^|\\s)@${escapedName}(?=$|\\s|[,.!?])`, 'i').test(payload.text)
        })
        .map(role => role.id)
      const response = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: channelRoomId,
          content,
          mentionEveryone: /(^|\s)@everyone\b/i.test(payload.text) && can(channelPermissions, 'MENTION_EVERYONE'),
          mentionHere: /(^|\s)@here\b/i.test(payload.text) && can(channelPermissions, 'MENTION_EVERYONE'),
          roleMentions,
          mentions: mentionedUserIds,
          ...(replyTarget ? { replyTo: replyTarget.id } : {})
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not send this message.')
      setMessages(previous => previous.some(item => item.id === data.message.id) ? previous : [...previous, data.message])
      setDecrypted(previous => ({ ...previous, [data.message.id]: payloadString }))
      cacheSentMessageMemory(data.message.id, payloadString)
      void saveSentMessageToDB(user.userId, data.message.id, payloadString)
      setDraft('')
      setDraftCursor(0)
      if (composerRef.current) composerRef.current.style.height = 'auto'
      setReplyTarget(null)
      setActiveMentionIndex(0)
      setMentionSuggestionsOpen(true)
      setShowAssets(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send this message.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectSlashCommand = (cmd: SlashCommandDef) => {
    setSlashMenuOpen(false)
    if (['rank', 'leaderboard', 'serverinfo', 'snipe', 'lock', 'unlock'].includes(cmd.command)) {
      setDraft(`/${cmd.command} `)
    } else if (cmd.command === 'poll') {
      setDraft('/poll Question here? | Option 1 | Option 2')
    } else if (cmd.command === 'gstart') {
      setDraft('/gstart 10 1 Special Role / Perk')
    } else if (cmd.command === 'warn') {
      setDraft('/warn @user Rule violation')
    } else if (cmd.command === 'purge') {
      setDraft('/purge 10')
    } else if (cmd.command === 'slowmode') {
      setDraft('/slowmode 5')
    } else if (cmd.command === 'remindme') {
      setDraft('/remindme 10 Check ticket queue')
    } else {
      setDraft(`/${cmd.command} `)
    }
    composerRef.current?.focus()
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text) return

    // Slash command interceptor for Niko Bot
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ')
      const command = parts[0].toLowerCase()
      const rawArgs = parts.slice(1).join(' ').trim()

      setDraft('')
      setSlashMenuOpen(false)
      if (composerRef.current) {
        composerRef.current.style.height = 'auto'
      }

      try {
        const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/slash-command`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command,
            rawArgs,
            channelId: selectedChannel?.id
          })
        })
        const resData = await response.json()
        if (!response.ok || !resData.ok) {
          setError(resData.message || `Failed to run /${command}`)
        } else {
          if (['lock', 'unlock', 'slowmode', 'purge'].includes(command)) {
            await loadSpace()
          }
        }
      } catch (err: any) {
        setError(err.message || 'Slash command failed')
      }
      return
    }

    if (slowmodeRemaining > 0) return
    await sendPayload({ text })
    if (selectedChannel?.slowmodeSeconds && selectedChannel.slowmodeSeconds > 0 && !can(channelPermissions, 'MANAGE_MESSAGES')) {
      setSlowmodeRemaining(selectedChannel.slowmodeSeconds)
    }
  }

  const sendSticker = async (asset: SpaceData['stickers'][number]) => {
    await sendPayload({ text: asset.associatedEmoji || '', mediaType: 'sticker', mediaUrl: asset.url })
  }

  const saveSettings = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}${path}`, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save this change.')
      setError('')
      if (data.space) {
        setSpace(current => current ? {
          ...current,
          ...data.space,
          members: current.members,
          channels: current.channels
        } : data.space)
        hasLoadedSpaceRef.current = true
      } else {
        await loadSpace()
      }
      return data
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/invites`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInMinutes: inviteExpiry === '0' ? undefined : Number(inviteExpiry), maxUses: inviteUses === '0' ? undefined : Number(inviteUses) })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create an invite.')
      const invite = data.invite as SpaceInvite
      const link = `${window.location.origin}/?invite=${encodeURIComponent(invite.code)}`
      setInviteCode(invite.code)
      setInviteLink(link)
      setInvites(previous => [invite, ...previous])
      try {
        await navigator.clipboard.writeText(link)
        setInviteStatus('Invite link copied. Share it with the people you want to join.')
      } catch {
        setInviteStatus('Invite created. Copy the link below to share it.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create an invite.')
    }
  }

  const copyExistingInviteLink = async (code: string) => {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(code)}`
    setInviteCode(code)
    setInviteLink(link)
    try {
      await navigator.clipboard.writeText(link)
      setInviteStatus('Invite link copied.')
    } catch {
      setInviteStatus('Copy the invite link below to share it.')
    }
  }

  const createThread = async (starterMessageId?: string, initialTitle?: string, tags: string[] = []) => {
    if (!selectedChannel) return
    const title = (initialTitle ?? threadTitle).trim() || (starterMessageId ? 'Message discussion' : '')
    if (!title) return
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${selectedChannel.id}/threads`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, starterMessageId, ...(selectedChannel.type === 'forum' ? { tags } : {}) })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create this discussion.')
      setThreads(previous => [data.thread, ...previous])
      setActiveThread(data.thread)
      setThreadTitle('')
      setForumPostTags([])
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this discussion.')
    }
  }

  const deleteSpaceMessage = async (message: Message) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    try {
      const response = await fetch(`${API_BASE}/api/messages/${message.id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not delete this message.')
      setMessages(previous => previous.filter(item => item.id !== message.id))
      setDecrypted(previous => {
        const next = { ...previous }
        delete next[message.id]
        return next
      })
      setReplyTarget(previous => previous?.id === message.id ? null : previous)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this message.')
    }
  }

  const copySpaceMessage = async (message: Message) => {
    const text = getMessagePreview(decrypted[message.id] || '')
    try {
      await navigator.clipboard.writeText(text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not copy this message.')
    }
  }

  const updateThread = async (thread: SpaceThread, updates: { archived?: boolean; locked?: boolean }) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/threads/${thread.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update this discussion.')
      setThreads(previous => previous.map(item => item.id === thread.id ? data.thread : item))
      if (activeThread?.id === thread.id) setActiveThread(data.thread)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this discussion.')
    }
  }

  const deleteThread = async (thread: SpaceThread) => {
    if (!window.confirm(`Delete “${thread.title}” and its messages? This cannot be undone.`)) return
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/threads/${thread.id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not delete this discussion.')
      setThreads(previous => previous.filter(item => item.id !== thread.id))
      if (activeThread?.id === thread.id) setActiveThread(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this discussion.')
    }
  }

  const createChannel = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveSettings('/channels', 'POST', { name: channelName, type: channelType, categoryId: channelCategoryId })
      setChannelName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create channel.')
    }
  }

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveSettings('/categories', 'POST', { name: categoryName, parentId: categoryParentId })
      setCategoryName('')
      setCategoryParentId('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create category.')
    }
  }

  const moveChannel = async (channel: SpaceChannel, offset: -1 | 1) => {
    if (!space) return
    const sorted = [...space.channels].sort((a, b) => a.position - b.position)
    const position = sorted.findIndex(item => item.id === channel.id) + offset
    if (position < 0 || position >= sorted.length) return
    try {
      await saveSettings(`/channels/${channel.id}`, 'PATCH', { position })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reorder channels.')
    }
  }

  const moveCategory = async (category: SpaceCategory, offset: -1 | 1) => {
    if (!space) return
    const sorted = space.categories.filter(item => item.parentId === category.parentId).sort((a, b) => a.position - b.position)
    const position = sorted.findIndex(item => item.id === category.id) + offset
    if (position < 0 || position >= sorted.length) return
    try {
      await saveSettings(`/categories/${category.id}`, 'PATCH', { position })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reorder categories.')
    }
  }

  const moveCategoryToParent = async (categoryId: string, parentId: string) => {
    if (!space || categoryId === parentId) return
    const category = space.categories.find(item => item.id === categoryId)
    if (!category || (parentId && !space.categories.some(item => item.id === parentId))) return
    const descendants = new Set<string>()
    const collect = (id: string) => {
      for (const child of space.categories.filter(item => item.parentId === id)) {
        if (descendants.has(child.id)) continue
        descendants.add(child.id)
        collect(child.id)
      }
    }
    collect(categoryId)
    if (descendants.has(parentId)) {
      setError('A category cannot be nested inside itself or one of its descendants.')
      return
    }
    try {
      await saveSettings(`/categories/${categoryId}`, 'PATCH', {
        parentId,
        position: space.categories.filter(item => item.parentId === parentId && item.id !== categoryId).length
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not nest category.')
    }
  }

  const getDescendantCategoryIds = (categoryId: string) => {
    const descendants = new Set<string>()
    const collect = (id: string) => {
      for (const child of space?.categories.filter(item => item.parentId === id) || []) {
        if (descendants.has(child.id)) continue
        descendants.add(child.id)
        collect(child.id)
      }
    }
    collect(categoryId)
    return descendants
  }

  const handleCategoryReorder = async (draggedCatId: string, targetCatId: string, edge: 'top' | 'bottom') => {
    if (!space || draggedCatId === targetCatId) return
    const categories = [...space.categories].sort((a, b) => a.position - b.position)
    const dragged = categories.find(c => c.id === draggedCatId)
    if (!dragged) return
    const without = categories.filter(c => c.id !== draggedCatId)
    const targetIdx = without.findIndex(c => c.id === targetCatId)
    if (targetIdx === -1) return
    const insertIdx = edge === 'top' ? targetIdx : targetIdx + 1
    without.splice(insertIdx, 0, dragged)
    const reordered = without.map((c, i) => ({ id: c.id, position: i }))
    setSpace(prev => prev ? ({ ...prev, categories: without.map((c, i) => ({ ...c, position: i })) }) : prev)
    try {
      await fetch(`${API_BASE}/api/spaces/${spaceId}/channels-reorder`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: reordered })
      })
    } catch (err) {
      console.error('Failed to reorder categories', err)
      await loadSpace()
    }
  }

  const handleChannelReorder = async (draggedChanId: string, targetChanId: string, edge: 'top' | 'bottom') => {
    if (!space || draggedChanId === targetChanId) return
    const channels = [...space.channels].sort((a, b) => a.position - b.position)
    const dragged = channels.find(c => c.id === draggedChanId)
    const target = channels.find(c => c.id === targetChanId)
    if (!dragged || !target) return

    const targetCategoryId = target.categoryId || ''
    const without = channels.filter(c => c.id !== draggedChanId)
    const targetIdx = without.findIndex(c => c.id === targetChanId)
    if (targetIdx === -1) return
    const insertIdx = edge === 'top' ? targetIdx : targetIdx + 1
    const updatedDragged = { ...dragged, categoryId: targetCategoryId }
    without.splice(insertIdx, 0, updatedDragged)

    const reordered = without.map((c, i) => ({ id: c.id, position: i, categoryId: c.categoryId || '' }))
    setSpace(prev => prev ? ({ ...prev, channels: without.map((c, i) => ({ ...c, position: i })) }) : prev)
    try {
      await fetch(`${API_BASE}/api/spaces/${spaceId}/channels-reorder`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: reordered })
      })
    } catch (err) {
      console.error('Failed to reorder channels', err)
      await loadSpace()
    }
  }

  const handleChannelMoveToCategory = async (draggedChanId: string, targetCategoryId: string) => {
    if (!space) return
    const channels = [...space.channels].sort((a, b) => a.position - b.position)
    const dragged = channels.find(c => c.id === draggedChanId)
    if (!dragged) return

    const without = channels.filter(c => c.id !== draggedChanId)
    const updatedDragged = { ...dragged, categoryId: targetCategoryId }
    const lastIdx = without.map(c => c.categoryId || '').lastIndexOf(targetCategoryId)
    const insertIdx = lastIdx >= 0 ? lastIdx + 1 : without.length
    without.splice(insertIdx, 0, updatedDragged)

    const reordered = without.map((c, i) => ({ id: c.id, position: i, categoryId: c.categoryId || '' }))
    setSpace(prev => prev ? ({ ...prev, channels: without.map((c, i) => ({ ...c, position: i })) }) : prev)
    try {
      await fetch(`${API_BASE}/api/spaces/${spaceId}/channels-reorder`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: reordered })
      })
    } catch (err) {
      console.error('Failed to move channel to category', err)
      await loadSpace()
    }
  }

  const updatePermissionOverwrite = async (
    kind: 'channels' | 'categories',
    target: SpaceChannel | SpaceCategory,
    roleId: string,
    key: keyof typeof PERMISSION_BITS,
    state: 'inherit' | 'allow' | 'deny'
  ) => {
    const bit = PERMISSION_BITS[key]
    const overwrites = target.permissionOverwrites.map(item => ({ ...item }))
    const current = overwrites.find(item => item.roleId === roleId)
    if (current) {
      current.allow &= ~bit
      current.deny &= ~bit
      if (state === 'allow') current.allow |= bit
      if (state === 'deny') current.deny |= bit
      if (current.allow === 0 && current.deny === 0) overwrites.splice(overwrites.indexOf(current), 1)
    } else if (state !== 'inherit') {
      overwrites.push({ roleId, allow: state === 'allow' ? bit : 0, deny: state === 'deny' ? bit : 0 })
    }
    try {
      await saveSettings(`/${kind}/${target.id}`, 'PATCH', { permissionOverwrites: overwrites })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update permissions.')
    }
  }

  const createRole = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveSettings('/roles', 'POST', { name: roleName, color: newRoleColor, icon: roleIcon, permissions: rolePermissions })
      setRoleName('')
      setRoleIcon('')
      setRolePermissions(0)
      setNewRoleColor('#8b5cf6')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create role.')
    }
  }

  const moveRole = async (role: SpaceRole, offset: -1 | 1) => {
    if (!space || role.id === 'everyone') return
    const sorted = [...space.roles].sort((a, b) => a.position - b.position)
    const currentIndex = sorted.findIndex(item => item.id === role.id)
    const targetIndex = currentIndex + offset
    if (targetIndex < 1 || targetIndex >= sorted.length) return
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/roles/${role.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: targetIndex })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not reorder this role.')
      await loadSpace()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reorder this role.')
    }
  }

  const addAsset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!assetFile) return
    try {
      const formData = new FormData()
      formData.set('name', assetName)
      formData.set('kind', assetType)
      if (assetType === 'stickers') formData.set('associatedEmoji', assetEmoji)
      formData.set('file', assetFile)
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/assets/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not upload this asset.')
      await loadSpace()
      window.dispatchEvent(new Event('space-assets-updated'))
      setAssetName('')
      setAssetFile(null)
      setAssetEmoji('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this asset.')
    }
  }

  const uploadSpaceImage = async (kind: 'icon' | 'banner', file: File | undefined) => {
    if (!file) return
    setSpaceImageLoading(kind)
    try {
      const formData = new FormData()
      formData.set('kind', kind)
      formData.set('file', file)
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/assets/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || `Could not upload the Space ${kind}.`)
      await loadSpace()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not upload the Space ${kind}.`)
    } finally {
      setSpaceImageLoading('')
    }
  }

  const createEvent = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/events`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          description: eventDescription,
          location: eventLocation,
          scheduledStartAt: new Date(eventStart).toISOString()
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create this event.')
      setEvents(previous => [...previous, data.event].sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt)))
      setEventName('')
      setEventDescription('')
      setEventLocation('')
      setEventStart('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this event.')
    }
  }

  const respondToEvent = async (event: SpaceEvent, interested: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/events/${event._id}/rsvp`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ interested })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update your response.')
      setEvents(previous => previous.map(item => item._id === event._id ? { ...item, interestedUserIds: data.interestedUserIds } : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update your response.')
    }
  }

  const beginEventEdit = (event: SpaceEvent) => {
    setEditingEventId(event._id)
    setEditEventName(event.name)
    setEditEventDescription(event.description)
    setEditEventLocation(event.location)
    const date = new Date(event.scheduledStartAt)
    setEditEventStart(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  }

  const saveEventEdit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/events/${editingEventId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editEventName,
          description: editEventDescription,
          location: editEventLocation,
          scheduledStartAt: new Date(editEventStart).toISOString()
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update this event.')
      setEvents(previous => previous.map(item => item._id === editingEventId ? data.event : item))
      setEditingEventId('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this event.')
    }
  }

  const deleteEvent = async (event: SpaceEvent) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/events/${event._id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not cancel this event.')
      setEvents(previous => previous.filter(item => item._id !== event._id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not cancel this event.')
    }
  }

  const settingsGroups = [
    { title: 'Space', items: [{ id: 'overview' as const, label: 'Overview', icon: Server, allowed: canManageSpace }] },
    { title: 'Automation', items: [{ id: 'niko' as const, label: 'Niko (Bot Studio)', icon: Bot, allowed: canManageSpace }] },
    { title: 'People', items: [{ id: 'roles' as const, label: 'Roles & permissions', icon: ShieldCheck, allowed: canManageRoles }, { id: 'members' as const, label: 'Members', icon: Users, allowed: canManageRoles || canKick || canBan }, { id: 'assets' as const, label: 'Emoji & stickers', icon: Smile, allowed: canManageAssets }] },
    { title: 'Safety', items: [{ id: 'invites' as const, label: 'Invites', icon: Link2, allowed: canManageSpace }, { id: 'bans' as const, label: 'Bans', icon: Ban, allowed: canBan }, { id: 'audit' as const, label: 'Audit history', icon: History, allowed: canManageSpace }] }
  ]
  const visibleAssets = assetType === 'emojis'
    ? space?.emojis.map(asset => ({ ...asset, kind: 'emojis' as const })) || []
    : space?.stickers.map(asset => ({ ...asset, kind: 'stickers' as const })) || []
  const searchedAssets = visibleAssets.filter(asset => `${asset.name} ${'associatedEmoji' in asset ? asset.associatedEmoji || '' : ''}`.toLowerCase().includes(assetSearch.trim().toLowerCase()))
  const categoryHasVisibleContent = (categoryId: string): boolean =>
    visibleChannels.some(channel => channel.categoryId === categoryId) ||
    (space?.categories || []).some(category => category.parentId === categoryId && categoryHasVisibleContent(category.id))
  const renderChannelEntry = (channel: SpaceChannel) => {
    const isDragOverTop = dragOverState?.type === 'channel' && dragOverState.id === channel.id && dragOverState.edge === 'top'
    const isDragOverBottom = dragOverState?.type === 'channel' && dragOverState.id === channel.id && dragOverState.edge === 'bottom'
    const isBeingDragged = draggedSpaceItem?.type === 'channel' && draggedSpaceItem.id === channel.id

    return (
      <div key={channel.id} className="relative">
        {isDragOverTop && (
          <div className="h-[2px] w-full bg-[#5865F2] shadow-[0_0_8px_#5865F2] rounded-full pointer-events-none my-0.5" />
        )}
        <div
          draggable={canManageChannels}
          onDragStart={event => {
            if (!canManageChannels) return
            event.stopPropagation()
            setDraggedSpaceItem({ type: 'channel', id: channel.id })
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', channel.id)
          }}
          onDragEnd={() => {
            setDraggedSpaceItem(null)
            setDragOverState(null)
          }}
          onDragOver={event => {
            if (!canManageChannels || draggedSpaceItem?.type !== 'channel') return
            event.preventDefault()
            event.stopPropagation()
            if (draggedSpaceItem.id === channel.id) return
            const rect = event.currentTarget.getBoundingClientRect()
            const edge = event.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom'
            setDragOverState({ type: 'channel', id: channel.id, edge })
          }}
          onDragLeave={() => {
            if (dragOverState?.id === channel.id) setDragOverState(null)
          }}
          onDrop={event => {
            event.preventDefault()
            event.stopPropagation()
            if (!draggedSpaceItem || !canManageChannels || draggedSpaceItem.type !== 'channel') return
            const edge = dragOverState?.edge === 'bottom' ? 'bottom' : 'top'
            void handleChannelReorder(draggedSpaceItem.id, channel.id, edge)
            setDraggedSpaceItem(null)
            setDragOverState(null)
          }}
          onContextMenu={event => openCopyIdMenu(event, channel.id)}
          className={`${canManageChannels ? 'cursor-grab active:cursor-grabbing ' : ''}${isBeingDragged ? 'opacity-30' : ''}`}
          title={canManageChannels ? `Drag #${channel.name} to reorder or move it` : undefined}
        >
          <ChannelEntry
            channel={channel}
            selected={selectedChannelId === channel.id}
            onSelect={() => { setSelectedChannelId(channel.id); setShowChannels(false) }}
            onOpenSettings={canManageChannels ? () => setEditingChannel(channel) : undefined}
          />
          {channel.type === 'voice' && (
            <VoiceChannelMembers
              spaceId={space?._id || spaceId}
              channelId={channel.id}
              onViewProfile={userId => {
                const member = space?.members.find(m => m.userId === userId)
                if (member) showSpaceProfile(member)
              }}
            />
          )}
        </div>
        {isDragOverBottom && (
          <div className="h-[2px] w-full bg-[#5865F2] shadow-[0_0_8px_#5865F2] rounded-full pointer-events-none my-0.5" />
        )}
      </div>
    )
  }

  const renderCategoryEntry = (category: SpaceCategory, depth = 0): React.ReactNode => {
    if (rolePreviewActive && !categoryHasVisibleContent(category.id)) return null
    const children = [...(space?.categories || [])].filter(item => item.parentId === category.id).sort((a, b) => a.position - b.position)
    const channels = visibleChannels.filter(channel => channel.categoryId === category.id).sort((a, b) => a.position - b.position)
    const collapsed = collapsedCategories.includes(category.id)

    const isDragOverTop = dragOverState?.type === 'category' && dragOverState.id === category.id && dragOverState.edge === 'top'
    const isDragOverBottom = dragOverState?.type === 'category' && dragOverState.id === category.id && dragOverState.edge === 'bottom'
    const isDragOverInside = dragOverState?.type === 'category' && dragOverState.id === category.id && dragOverState.edge === 'inside'
    const isBeingDragged = draggedSpaceItem?.type === 'category' && draggedSpaceItem.id === category.id

    return (
      <div key={category.id} className="relative select-none" style={{ marginLeft: `${depth * 10}px` }}>
        {isDragOverTop && (
          <div className="h-[2px] w-full bg-[#5865F2] shadow-[0_0_8px_#5865F2] rounded-full pointer-events-none mb-1" />
        )}
        <div
          draggable={canManageChannels}
          onDragStart={event => {
            if (!canManageChannels) return
            event.stopPropagation()
            setDraggedSpaceItem({ type: 'category', id: category.id })
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', category.id)
          }}
          onDragEnd={() => {
            setDraggedSpaceItem(null)
            setDragOverState(null)
          }}
          onDragOver={event => {
            if (!canManageChannels || !draggedSpaceItem) return
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            if (draggedSpaceItem.type === 'category') {
              if (draggedSpaceItem.id === category.id) return
              const edge = event.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom'
              setDragOverState({ type: 'category', id: category.id, edge })
            } else if (draggedSpaceItem.type === 'channel') {
              setDragOverState({ type: 'category', id: category.id, edge: 'inside' })
            }
          }}
          onDragLeave={() => {
            if (dragOverState?.id === category.id) setDragOverState(null)
          }}
          onDrop={event => {
            event.preventDefault()
            event.stopPropagation()
            if (!draggedSpaceItem || !canManageChannels) return
            if (draggedSpaceItem.type === 'category' && dragOverState?.type === 'category') {
              void handleCategoryReorder(draggedSpaceItem.id, category.id, dragOverState.edge === 'bottom' ? 'bottom' : 'top')
            } else if (draggedSpaceItem.type === 'channel') {
              void handleChannelMoveToCategory(draggedSpaceItem.id, category.id)
            }
            setDraggedSpaceItem(null)
            setDragOverState(null)
          }}
          onContextMenu={event => openCopyIdMenu(event, category.id)}
          className={`group/cat mb-1 mt-4 flex w-full items-center justify-between px-1 text-[11.5px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all ${
            canManageChannels ? 'cursor-grab active:cursor-grabbing ' : ''
          }${isBeingDragged ? 'opacity-30 ' : ''}${
            isDragOverInside ? 'ring-2 ring-[#5865F2] bg-[#5865F2]/15 rounded-[4px] p-1 ' : ''
          }`}
        >
          <button
            type="button"
            draggable={false}
            onClick={() => setCollapsedCategories(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id])}
            aria-expanded={!collapsed}
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left cursor-pointer"
          >
            {canManageChannels && <GripVertical size={12} className="shrink-0 opacity-40 group-hover/cat:opacity-100 transition-opacity" />}
            <ChevronDown size={11} className={`transition-transform duration-200 shrink-0 ${collapsed ? '-rotate-90' : ''}`} />
            <span className="truncate">{category.name}</span>
          </button>
          {canManageChannels && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Create Channel in Category"
                onClick={() => {
                  setCreateChannelTargetCategoryId(category.id)
                  setCreateChannelModalOpen(true)
                }}
                className="hidden group-hover/cat:flex rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                title="Category Settings"
                onClick={() => setEditingCategory(category)}
                className="hidden group-hover/cat:flex rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <Settings size={13} />
              </button>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="space-y-[1.5px] pl-2 mt-0.5">
            {channels.map(renderChannelEntry)}
            {children.map(child => renderCategoryEntry(child, depth + 1))}
          </div>
        )}
        {isDragOverBottom && (
          <div className="h-[2px] w-full bg-[#5865F2] shadow-[0_0_8px_#5865F2] rounded-full pointer-events-none mt-1" />
        )}
      </div>
    )
  }
  const copyWidgetEmbed = async () => {
    const source = `${window.location.origin}/api/spaces/${spaceId}/widget`
    try {
      const title = (space?.name || 'Community').replace(/["&<>]/g, '')
      await navigator.clipboard.writeText(`<iframe src="${source}" width="440" height="250" title="${title} Space widget" loading="lazy"></iframe>`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not copy the widget embed code.')
    }
  }

  if (loading) return <div className="flex h-full flex-1 items-center justify-center text-[var(--text-secondary)]">Opening Space…</div>
  if (!space) return <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-[var(--text-primary)]">{error || 'This Space is not available.'}</p><button onClick={onExit} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-white">Back to messages</button></div>

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      {showChannels && <button aria-label="Close channel list" onClick={() => setShowChannels(false)} className="absolute inset-0 z-30 bg-black/50 xl:hidden" />}
      <aside className={`absolute inset-y-0 left-0 z-40 w-[240px] shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-panel)] xl:relative xl:flex ${showChannels ? 'flex' : 'hidden xl:flex'}`}>
        <div className="relative border-b border-[var(--app-border)]">
          <button
            type="button"
            onClick={() => setSpaceMenuOpen(open => !open)}
            aria-expanded={spaceMenuOpen}
            className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-[var(--app-surface-hover)] focus:outline-none"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--app-accent)] text-sm font-bold text-white shadow-sm ring-1 ring-white/20">
                {space.icon ? <img src={space.icon} alt="" className="h-full w-full object-cover" /> : space.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-bold text-sm text-[var(--text-primary)]">{space.name}</h2>
                <p className="truncate text-[11px] text-[var(--text-secondary)]">{space.members.length} members</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <ChevronDown size={17} className={`transition-transform duration-200 ${spaceMenuOpen ? 'rotate-180 text-[var(--app-accent)]' : ''}`} />
            </div>
          </button>

          {spaceMenuOpen && (
            <div
              ref={spaceMenuRef}
              className="absolute left-2 right-2 top-full z-50 mt-1 space-y-0.5 rounded-xl border border-white/20 bg-[var(--app-panel)]/95 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/40"
            >
              {canManageSpace && (
                <button
                  type="button"
                  onClick={() => { setSpaceMenuOpen(false); setSettingsTab('overview'); setShowSettings(true) }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--app-accent)] hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2"><Settings size={14} />Server Settings</span>
                </button>
              )}
              {canManageChannels && (
                <>
                  <button
                    type="button"
                    onClick={() => { setSpaceMenuOpen(false); setCreateChannelTargetCategoryId(''); setCreateChannelModalOpen(true) }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--app-accent)] hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2"><Plus size={14} />Create Channel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSpaceMenuOpen(false); setCreateCategoryModalOpen(true) }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--app-accent)] hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2"><Server size={14} />Create Category</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setSpaceMenuOpen(false); void copyInvite() }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--app-accent)] hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2"><Users size={14} />Invite People</span>
              </button>
              <button
                type="button"
                onClick={() => { setSpaceMenuOpen(false); setShowEvents(true) }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--app-accent)] hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2"><CalendarDays size={14} />Server Events</span>
              </button>

              <div className="my-1 border-t border-[var(--app-border)]" />

              {space.ownerId !== user.userId ? (
                <button
                  type="button"
                  onClick={() => { setSpaceMenuOpen(false); void handleLeaveSpace() }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2"><LogOut size={14} />Leave Space</span>
                </button>
              ) : (
                <div className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-amber-400">
                  <span className="flex items-center gap-1.5"><Crown size={13} />Server Owner</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <button onClick={() => { setShowChannels(false); setShowEvents(true) }} className="mb-2 flex w-full items-center gap-2 rounded-lg bg-[var(--app-surface)] px-2.5 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"><CalendarDays size={15} /> Events</button>

          {/* Categories */}
          {[...space.categories].filter(category => !category.parentId).sort((a, b) => a.position - b.position).map(category => renderCategoryEntry(category))}

          {/* Uncategorized channels */}
          {(visibleChannels.some(channel => !channel.categoryId) || canManageChannels) && (
            <div className="relative pt-2">
              <div
                onDragOver={event => {
                  if (draggedSpaceItem?.type === 'channel') {
                    event.preventDefault()
                    setDragOverState({ type: 'channel', id: 'uncategorized', edge: 'inside' })
                  }
                }}
                onDragLeave={() => {
                  if (dragOverState?.id === 'uncategorized') setDragOverState(null)
                }}
                onDrop={event => {
                  event.preventDefault()
                  if (draggedSpaceItem?.type === 'channel' && canManageChannels) {
                    void handleChannelMoveToCategory(draggedSpaceItem.id, '')
                  }
                  setDraggedSpaceItem(null)
                  setDragOverState(null)
                }}
                className={`mb-1 mt-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] rounded transition-colors ${
                  dragOverState?.id === 'uncategorized' ? 'ring-2 ring-[#5865F2] bg-[#5865F2]/15' : ''
                }`}
              >
                Uncategorized
              </div>
              <div className="space-y-[1.5px]">
                {visibleChannels.filter(channel => !channel.categoryId).sort((a, b) => a.position - b.position).map(renderChannelEntry)}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--app-border)] p-3">
          <button onClick={() => void copyInvite()} disabled={!canInvite} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--app-surface)] px-3 py-2 text-sm disabled:opacity-40"><Copy size={15} /> Invite</button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--app-border)] px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setShowChannels(true)} aria-label="Open channel list" title="Channels" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] xl:hidden"><Menu size={18} /></button>
            {selectedChannel?.type === 'voice' ? (
              <Volume2 size={18} className="shrink-0 text-emerald-400" />
            ) : selectedChannel?.type === 'announcement' ? (
              <Megaphone size={18} className="shrink-0 text-amber-400" />
            ) : selectedChannel?.type === 'forum' ? (
              <MessageSquare size={18} className="shrink-0 text-sky-400" />
            ) : (
              <Hash size={18} className="shrink-0 text-[var(--text-secondary)]" />
            )}
            <span className="truncate font-bold text-base text-[var(--text-primary)]">{selectedChannel?.name || 'No text channel'}</span>
            {selectedChannel?.topic && (
              <button
                type="button"
                onClick={() => setShowTopicModal(true)}
                title="Click to view full topic & rules"
                className="hidden truncate border-l border-[var(--app-border)] pl-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] md:inline-block max-w-sm text-left transition-colors"
              >
                {selectedChannel.topic}
              </button>
            )}
            {Boolean(selectedChannel?.slowmodeSeconds && selectedChannel.slowmodeSeconds > 0) && (
              <span
                title={`Slowmode: 1 message per ${selectedChannel!.slowmodeSeconds}s`}
                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0"
              >
                <Clock size={11} />
                {selectedChannel!.slowmodeSeconds! < 60 ? `${selectedChannel!.slowmodeSeconds}s` : `${Math.round(selectedChannel!.slowmodeSeconds! / 60)}m`} Slowmode
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setMessageSearchOpen(value => !value); setMessageSearchQuery('') }} title="Search this channel" aria-label="Search this channel" aria-expanded={messageSearchOpen} className={`rounded-lg p-2 ${messageSearchOpen ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'}`}><Search size={17} /></button>
            <button onClick={() => setShowEvents(true)} title="Space events" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><CalendarDays size={17} /></button>
            <button onClick={() => setShowMembers(value => !value)} title={showMembers ? 'Hide members' : 'Show members'} aria-label={showMembers ? 'Hide members' : 'Show members'} aria-pressed={showMembers} className={`rounded-lg p-2 ${showMembers ? 'bg-[var(--app-surface-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'}`}><Users size={17} /></button>
            {!rolePreviewActive && canManageSpace && <button onClick={() => { setShowChannels(false); setSettingsTab('overview'); setShowSettings(true) }} title="Space settings" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><Settings size={17} /></button>}
          </div>
        </header>
        {messageSearchOpen && <div className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-panel)] px-4 py-3">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
            <Search size={16} className="shrink-0 text-[var(--text-secondary)]" />
            <input autoFocus value={messageSearchQuery} onChange={event => setMessageSearchQuery(event.target.value)} placeholder={'Search this channel · from:name has:link after:YYYY-MM-DD'} aria-label="Search messages in this channel" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]" />
            <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">{searchedMessages.length} results</span>
            <button type="button" onClick={() => { setMessageSearchOpen(false); setMessageSearchQuery('') }} aria-label="Close message search" className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X size={15} /></button>
          </label>
          <p className="mt-1 px-1 text-[10px] text-[var(--text-secondary)]">Searches the latest 100 messages loaded in this channel. Filters: from:, mentions:, has:link|image|video|file, before:, after:, during:, in:. Pinned-message filters are not available.</p>
        </div>}
        {rolePreviewActive && <div className="sticky top-0 z-30 shrink-0 border-b border-[var(--app-accent)]/50 bg-[var(--app-accent)]/15 px-4 py-3 shadow-md backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1 text-xs font-extrabold text-[var(--app-accent)]"><ShieldCheck size={14} />ROLE PREVIEW</span>
            {space.roles.filter(role => role.id !== 'everyone').sort((a, b) => b.position - a.position).map(role => <label key={role.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1 text-xs">
              <input type="checkbox" checked={viewingRoleIds.includes(role.id)} onChange={event => setViewingRoleIds(previous => {
                if (!previous) return event.target.checked ? [role.id] : []
                return event.target.checked ? [...previous, role.id] : previous.filter(id => id !== role.id)
              })} />
              <span className="inline-flex items-center gap-1" style={{ color: role.color }}><RoleIcon icon={role.icon} />@{role.name}</span>
            </label>)}
            <button type="button" onClick={exitRolePreview} title="Exit role preview (Esc)" aria-label="Exit role preview" className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-300/70 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-xs font-extrabold text-white shadow-lg hover:brightness-110"><X size={15} />Exit preview</button>
          </div>
          <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">Read-only simulation · Press Esc or use Exit preview to return to your account.</p>
        </div>}
        {error && <div role="alert" className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
        {inviteCode && <div className="mx-4 mt-2 rounded-xl border border-[var(--app-accent)]/30 bg-[var(--app-accent)]/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold">{inviteStatus || 'Invite link ready to share'}</p><button onClick={() => { setInviteCode(''); setInviteLink(''); setInviteStatus('') }} aria-label="Dismiss invite link" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X size={14} /></button></div>
          <div className="flex min-w-0 gap-2"><input readOnly value={inviteLink} onFocus={event => event.currentTarget.select()} aria-label="Shareable invite link" className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs" /><button onClick={() => void copyExistingInviteLink(inviteCode)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white"><CopyCheck size={14} />Copy</button><a href={inviteLink} target="_blank" rel="noreferrer" aria-label="Open invite link" className="flex shrink-0 items-center rounded-lg border border-[var(--app-border)] px-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><ExternalLink size={14} /></a></div>
        </div>}
        <section className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {selectedChannel?.type === 'voice' ? (
          <VoiceChannelStage
            spaceId={space._id}
            channel={selectedChannel}
            canConnect={can(channelPermissions, 'CONNECT')}
            canSpeak={can(channelPermissions, 'SPEAK')}
          />
        ) : activeThread ? (
            <div className="mx-auto max-w-4xl">
              <div className="mb-5 flex items-center justify-between border-b border-[var(--app-border)] pb-4">
                <div><p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{selectedChannel?.type === 'forum' ? 'Forum post' : 'Thread'}</p><h1 className="text-xl font-bold">{getThreadTitle(activeThread.title)}</h1></div>
                <div className="flex items-center gap-2">
                  {!rolePreviewActive && (can(channelPermissions, 'MANAGE_THREADS') || (activeThread.createdBy === user.userId && !activeThread.archived)) && <button title={activeThread.archived ? 'Reopen discussion' : 'Archive discussion'} onClick={() => void updateThread(activeThread, { archived: !activeThread.archived })} className="rounded-lg bg-[var(--app-surface)] p-2">{activeThread.archived ? <Unlock size={16} /> : <Archive size={16} />}</button>}
                  {!rolePreviewActive && can(channelPermissions, 'MANAGE_THREADS') && <button title={activeThread.locked ? 'Unlock discussion' : 'Lock discussion'} onClick={() => void updateThread(activeThread, { locked: !activeThread.locked })} className="rounded-lg bg-[var(--app-surface)] p-2">{activeThread.locked ? <Unlock size={16} /> : <Lock size={16} />}</button>}
                  {!rolePreviewActive && can(channelPermissions, 'MANAGE_THREADS') && <button title="Delete discussion" onClick={() => void deleteThread(activeThread)} className="rounded-lg bg-red-500/10 p-2 text-red-300"><Trash2 size={16} /></button>}
                  <button onClick={() => setActiveThread(null)} title="Back to channel" className="rounded-lg bg-[var(--app-surface)] p-2"><X size={16} /></button>
                </div>
              </div>
              {rolePreviewActive && !can(channelPermissions, 'READ_MESSAGE_HISTORY')
                ? <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Message history is hidden from this role.</p>
                : <MessageList
                messages={searchedMessages}
                decrypted={decrypted}
                emojis={space.emojis}
                members={space.members}
                roles={space.roles}
                spaceId={space._id}
                channelId={selectedChannel?.id}
                currentUserId={user.userId}
                memberNameColor={memberNameColor}
                onViewProfile={onViewProfile ? showSpaceProfile : undefined}
                onQuickProfile={showSpaceQuickProfile}
                onReply={!rolePreviewActive && !activeThread.archived && !activeThread.locked && can(channelPermissions, 'SEND_MESSAGES_IN_THREADS') ? setReplyTarget : undefined}
                onDelete={!rolePreviewActive ? message => void deleteSpaceMessage(message) : undefined}
                canDelete={!rolePreviewActive ? message => message.senderId === user.userId || can(channelPermissions, 'MANAGE_MESSAGES') : undefined}
                onCopy={message => void copySpaceMessage(message)}
              />}
            </div>
          ) : selectedChannel?.type === 'forum' ? (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{selectedChannel.name}</h1><p className="text-sm text-[var(--text-secondary)]">{selectedChannel.topic || 'Start a discussion or open a post.'}</p></div>{!rolePreviewActive && can(channelPermissions, 'MANAGE_THREADS') && <button onClick={() => setShowArchivedThreads(value => !value)} className="rounded-lg bg-[var(--app-surface)] px-3 py-2 text-xs">{showArchivedThreads ? 'Hide archived' : 'Show archived'}</button>}</div>
              {!rolePreviewActive && can(channelPermissions, 'SEND_MESSAGES') && <form onSubmit={event => { event.preventDefault(); void createThread(undefined, undefined, forumPostTags) }} className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3"><div className="flex gap-2"><input value={threadTitle} onChange={event => setThreadTitle(event.target.value)} placeholder="Write a post title" maxLength={100} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2" /><button disabled={!threadTitle.trim()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-white disabled:opacity-40">New post</button></div>{(selectedChannel.forumTags || []).length > 0 && <div className="flex flex-wrap gap-3">{selectedChannel.forumTags?.map(tag => <label key={tag} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={forumPostTags.includes(tag)} disabled={!forumPostTags.includes(tag) && forumPostTags.length >= 5} onChange={event => setForumPostTags(previous => event.target.checked ? [...previous, tag] : previous.filter(item => item !== tag))} />{tag}</label>)}</div>}</form>}
              <div className="space-y-2">{visibleThreads.map(thread => <button key={thread.id} onClick={() => setActiveThread(thread)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4 text-left hover:bg-[var(--app-surface-hover)]"><MessageSquare size={18} className="shrink-0 text-[var(--app-accent)]" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{getThreadTitle(thread.title)}</span>{thread.tags?.length ? <span className="mt-1 flex flex-wrap gap-1">{thread.tags.map(tag => <span key={tag} className="rounded bg-[var(--app-surface)] px-2 py-0.5 text-[10px]">{tag}</span>)}</span> : null}<span className="text-xs text-[var(--text-secondary)]">{new Date(thread.lastActivityAt).toLocaleString()} · {thread.archived ? 'Archived' : thread.locked ? 'Locked' : 'Open'}</span></span></button>)}</div>
            </div>
          ) : (
            <>
              <div className={`mb-5 ${space.banner ? 'mt-2 overflow-hidden rounded-xl border border-[var(--app-border)]' : 'mt-10'}`}>
                {space.banner && <img src={space.banner} alt="" className="h-36 w-full object-cover" />}
                <div className={space.banner ? 'p-4' : ''}>
                <h1 className="text-2xl font-bold">Welcome to #{selectedChannel?.name || 'this Space'}</h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">This is the beginning of the conversation.</p>
                </div>
              </div>
              {rolePreviewActive && !can(channelPermissions, 'READ_MESSAGE_HISTORY')
                ? <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Message history is hidden from this role.</p>
                : <MessageList
                messages={searchedMessages}
                decrypted={decrypted}
                emojis={space.emojis}
                members={space.members}
                roles={space.roles}
                spaceId={space._id}
                channelId={selectedChannel?.id}
                currentUserId={user.userId}
                memberNameColor={memberNameColor}
                onViewProfile={onViewProfile ? showSpaceProfile : undefined}
                onQuickProfile={showSpaceQuickProfile}
                onReply={!rolePreviewActive && can(channelPermissions, 'SEND_MESSAGES') ? setReplyTarget : undefined}
                onDelete={!rolePreviewActive ? message => void deleteSpaceMessage(message) : undefined}
                canDelete={!rolePreviewActive ? message => message.senderId === user.userId || can(channelPermissions, 'MANAGE_MESSAGES') : undefined}
                onCopy={message => void copySpaceMessage(message)}
                threads={threads}
                onSelectThread={setActiveThread}
                onStartThread={!rolePreviewActive && can(channelPermissions, 'CREATE_PUBLIC_THREADS')
                  ? message => void createThread(message.id, getMessagePreview(decrypted[message.id] || ''))
                  : undefined}
              />}
            </>
          )}
        </section>
        {selectedChannel?.type !== 'voice' && (selectedChannel?.type !== 'forum' || Boolean(activeThread)) && (
          <div className="relative shrink-0 border-t border-[var(--app-border)] p-4">
            <EmojiGifPicker
              isOpen={showAssets && !rolePreviewActive}
              anchorRef={assetTriggerRef}
              onClose={() => setShowAssets(false)}
              onSelectEmoji={emoji => insertComposerText(emoji)}
              onSelectGif={url => {
                setShowAssets(false);
                void sendPayload({ text: '', mediaType: 'gif', mediaUrl: url });
              }}
              onSelectSticker={sticker => {
                setShowAssets(false);
                void sendPayload({ text: sticker.name || sticker.associatedEmoji || '', mediaType: 'sticker', mediaUrl: sticker.url });
              }}
              customEmojis={space.emojis.map(e => ({
                id: e.id,
                name: e.name,
                url: e.url,
                spaceId: space._id,
                spaceName: space.name,
                spaceIcon: space.icon,
                spaceIsPublic: space.isPublic
              }))}
              customStickers={space.stickers.map(s => ({
                id: s.id,
                name: s.name,
                url: s.url,
                associatedEmoji: s.associatedEmoji,
                spaceId: space._id,
                spaceName: space.name,
                spaceIcon: space.icon,
                spaceIsPublic: space.isPublic
              }))}
              stickerMaker={{ userId: user.userId, username: user.username }}
            />
            {mentionSuggestionsOpen && mentionOptions.length > 0 && (
              <div
                role="listbox"
                aria-label="Mention suggestions"
                className="absolute bottom-full left-4 sm:left-14 z-40 mb-2 max-h-72 w-[min(24rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#2b2d31]/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  <AtSign size={12} className="text-indigo-400" />
                  <span>Members & Roles</span>
                </div>
                {mentionOptions.map((option, index) => {
                  const isSelected = index === activeMentionIndex;
                  return (
                    <button
                      key={option.userId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectMention(option)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-[#404249] text-white shadow-sm ring-1 ring-white/10'
                          : 'hover:bg-white/5 text-white/80'
                      }`}
                    >
                      {option.kind === 'everyone' || option.kind === 'here' ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold">
                          <Users size={14} />
                        </span>
                      ) : option.kind === 'role' ? (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                          style={{
                            backgroundColor: `${option.color || '#5865F2'}25`,
                            color: option.color || '#5865F2'
                          }}
                        >
                          <ShieldCheck size={14} />
                        </span>
                      ) : (
                        <div className="relative h-7 w-7 shrink-0 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                          {option.avatar ? (
                            <img src={option.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            option.username[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="truncate text-xs font-bold"
                            style={option.kind === 'role' && option.color ? { color: option.color } : undefined}
                          >
                            @{option.username}
                          </span>
                          {option.displayName && option.displayName !== option.username && (
                            <span className="truncate text-[11px] text-white/50 font-normal">
                              ({option.displayName})
                            </span>
                          )}
                        </div>
                        {option.label && (
                          <span className="block truncate text-[10px] text-white/40">
                            {option.label}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {replyTarget && <div className="mb-2 flex max-h-14 shrink-0 items-center gap-2 overflow-hidden rounded-lg border-l-2 border-[var(--app-accent)] bg-[var(--app-surface)] px-3 py-2">
              <CornerUpLeft size={14} className="shrink-0 text-[var(--app-accent)]" />
              <span className="min-w-0 flex-1 truncate text-xs"><span className="font-semibold">{replyTarget.senderName}</span><span className="ml-2 text-[var(--text-secondary)]">{truncateReplyPreview(getMessagePreview(decrypted[replyTarget.id] || ''))}</span></span>
              <button onClick={() => setReplyTarget(null)} aria-label="Cancel reply" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X size={14} /></button>
            </div>}
            {slashMenuOpen && (
              <NikoSlashCommandMenu
                query={slashCommandQuery}
                onSelect={handleSelectSlashCommand}
                onClose={() => setSlashMenuOpen(false)}
              />
            )}
            {recorder.isRecording ? (
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
            ) : (
              <form onSubmit={event => { event.preventDefault(); void sendMessage() }} className="flex items-end gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 focus-within:border-[var(--app-accent)]">
              <textarea ref={composerRef} rows={1} value={draft} onChange={event => {
                const val = event.target.value
                setDraft(val)
                setDraftCursor(event.target.selectionStart ?? val.length)
                if (val.startsWith('/') && !val.includes('\n')) {
                  setSlashMenuOpen(true)
                  setSlashCommandQuery(val.slice(1))
                  setMentionSuggestionsOpen(false)
                } else {
                  setSlashMenuOpen(false)
                  setActiveMentionIndex(0)
                  setMentionSuggestionsOpen(true)
                }
                event.target.style.height = 'auto'
                event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px`
              }} onKeyDown={event => {
                if (event.key === 'Escape') {
                  if (slashMenuOpen) {
                    setSlashMenuOpen(false)
                    return
                  }
                  if (mentionSuggestionsOpen) {
                    setMentionSuggestionsOpen(false)
                    return
                  }
                }
                if (mentionSuggestionsOpen && mentionOptions.length && event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveMentionIndex(index => (index + 1) % mentionOptions.length)
                  return
                }
                if (mentionSuggestionsOpen && mentionOptions.length && event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveMentionIndex(index => (index - 1 + mentionOptions.length) % mentionOptions.length)
                  return
                }
                if (event.key === 'Tab') {
                  if (mentionSuggestionsOpen && mentionOptions.length > 0) {
                    event.preventDefault()
                    selectMention(mentionOptions[activeMentionIndex] || mentionOptions[0])
                    return
                  }
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (mentionSuggestionsOpen && mentionOptions.length > 0) {
                    selectMention(mentionOptions[activeMentionIndex] || mentionOptions[0])
                  } else {
                    void sendMessage()
                  }
                }
              }} onClick={event => {
                setDraftCursor(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
                setMentionSuggestionsOpen(true)
              }} onKeyUp={event => {
                setDraftCursor(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
                if (event.key !== 'Escape') setMentionSuggestionsOpen(true)
              }} disabled={rolePreviewActive || !privateKey || !selectedChannel || saving || !(activeThread ? can(channelPermissions, 'SEND_MESSAGES_IN_THREADS') : can(channelPermissions, 'SEND_MESSAGES')) || Boolean(activeThread?.archived || activeThread?.locked)} placeholder={rolePreviewActive ? 'Read-only role preview' : activeThread ? `Message in ${getThreadTitle(activeThread.title)}` : selectedChannel ? `Message #${selectedChannel.name}` : 'Select a text channel'} maxLength={4000} className="max-h-36 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-[var(--text-secondary)] disabled:opacity-50" />
              {!rolePreviewActive && <button ref={assetTriggerRef} type="button" onClick={() => { setShowAssets(value => !value); setMentionSuggestionsOpen(false) }} title="Emoji and stickers" aria-label="Emoji and stickers" aria-expanded={showAssets} className={`mb-0.5 rounded-full p-2 transition-colors ${showAssets ? 'bg-[var(--app-surface-hover)] text-[var(--app-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'}`}><Smile size={20} /></button>}
                {!rolePreviewActive && (
                  <button
                    type="button"
                    onClick={() => { void recorder.start() }}
                    disabled={rolePreviewActive || saving || !privateKey || !(activeThread ? can(channelPermissions, 'SEND_MESSAGES_IN_THREADS') : can(channelPermissions, 'SEND_MESSAGES')) || Boolean(activeThread?.archived || activeThread?.locked)}
                    title="Record voice message"
                    aria-label="Record voice message"
                    className="mb-0.5 rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-emerald-400 transition-colors disabled:opacity-40"
                  >
                    <Mic size={20} />
                  </button>
                )}
              <button type="submit" disabled={rolePreviewActive || !draft.trim() || saving || !privateKey || !(activeThread ? can(channelPermissions, 'SEND_MESSAGES_IN_THREADS') : can(channelPermissions, 'SEND_MESSAGES')) || Boolean(activeThread?.archived || activeThread?.locked)} title="Send message" aria-label="Send message" className="mb-0.5 rounded-xl bg-[var(--app-accent)] px-3 py-2 text-white disabled:opacity-40"><Send size={17} /></button>
            </form>
            )}
          </div>
        )}
      </main>

      {showMembers && (
        <aside aria-label="Space members" className="absolute bottom-0 right-0 top-14 z-30 flex w-72 flex-col border-l border-[var(--app-border)] bg-[var(--app-panel)] shadow-xl xl:static xl:top-auto xl:z-auto xl:w-64 xl:shrink-0 xl:shadow-none">
          <div className="border-b border-[var(--app-border)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="text-sm font-bold">Members</h2><p className="text-xs text-[var(--text-secondary)]">{space.members.length} in this Space</p></div>
              <button onClick={() => { setSettingsTab('members'); setShowSettings(true) }} title="Manage members" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><UserRound size={16} /></button>
            </div>
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Find a member" aria-label="Find a member" className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--app-accent)]" />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {groupedMemberSections.map(section => (
              <div key={section.id} className="mb-3.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none">
                  {section.icon && <RoleIcon icon={section.icon} />}
                  {section.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: section.color }} />}
                  <span>{section.title}</span>
                  <span className="opacity-60">— {section.members.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {section.members.map(item => {
                    const highestRole = space.roles.filter(candidate => item.roleIds.includes(candidate.id)).sort((a, b) => b.position - a.position)[0]
                    const displayName = item.nickname || item.displayName || item.username
                    const isOwner = item.userId === space.ownerId
                    const isSelf = item.userId === user.userId
                    const isMuted = Boolean(item.mutedUntil && new Date(item.mutedUntil) > new Date())

                    return (
                      <div
                        key={item.userId}
                        onContextMenu={event => {
                          event.preventDefault()
                          setModMenuTarget({ member: item, x: event.clientX, y: event.clientY })
                        }}
                        className="group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--app-surface-hover)]"
                      >
                        <button
                          type="button"
                          onClick={() => showSpaceProfile(item)}
                          aria-label={`Open ${displayName}'s full profile`}
                          className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--app-surface)] text-xs font-bold text-[var(--text-primary)] ring-1 ring-white/10"
                        >
                          {item.avatar ? <img src={item.avatar} alt="" className="h-full w-full object-cover" /> : displayName?.[0]?.toUpperCase()}
                          <span
                            title={item.status === 'dnd' ? 'Do not disturb' : item.status === 'inactive' ? 'Idle' : item.status === 'active' ? 'Active' : 'Offline'}
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--app-panel)] ${item.status === 'dnd' ? 'bg-red-500' : item.status === 'inactive' ? 'bg-amber-400' : item.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={event => showSpaceQuickProfile(item, event)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate text-xs font-semibold" style={{ color: highestRole?.color || 'var(--text-primary)' }}>
                              {displayName}
                            </span>
                            {isOwner && <span title="Server Owner" className="shrink-0 text-amber-400 select-none text-xs">👑</span>}
                            {isMuted && <span title="Timed out" className="shrink-0 text-[10px] text-amber-400">⏱️</span>}
                            {isSelf && <span className="text-[10px] text-[var(--text-secondary)] opacity-60">(you)</span>}
                          </div>
                          {item.activity ? (
                            <span className="flex items-center gap-1 truncate text-[10px] text-[var(--text-secondary)] font-medium">
                              <span className="shrink-0 text-[10px]">
                                {item.activity.type === 'listening' ? '🎵' :
                                 item.activity.type === 'streaming' ? '🟣' :
                                 item.activity.type === 'watching' ? '📺' :
                                 item.activity.type === 'competing' ? '♟️' : '🎮'}
                              </span>
                              <span className="truncate">
                                {item.activity.type === 'listening' ? `Listening to ${item.activity.name}` :
                                 item.activity.type === 'streaming' ? `Streaming ${item.activity.name}` :
                                 item.activity.type === 'watching' ? `Watching ${item.activity.name}` :
                                 item.activity.type === 'competing' ? `In Match · ${item.activity.details || item.activity.name}` :
                                 `Playing ${item.activity.name}`}
                              </span>
                            </span>
                          ) : (
                            <span className="block truncate text-[10px]" style={{ color: highestRole?.color || 'var(--text-secondary)' }}>
                              {highestRole?.name || (isOwner ? 'Server Owner' : 'Member')}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            const rect = event.currentTarget.getBoundingClientRect()
                            setModMenuTarget({ member: item, x: rect.right, y: rect.bottom })
                          }}
                          title="Member actions"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {groupedMemberSections.length === 0 && <p className="px-3 py-8 text-center text-xs text-[var(--text-secondary)]">No members match that search.</p>}
          </div>
        </aside>
      )}

      {showEvents && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)]">
            <header className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4"><div><h2 className="font-bold">Space events</h2><p className="text-xs text-[var(--text-secondary)]">Plan a time and let members know they’re coming.</p></div><button onClick={() => setShowEvents(false)} aria-label="Close events"><X size={18} /></button></header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {!rolePreviewActive && can(rolePermissionsForUser, 'CREATE_EVENTS') && <form onSubmit={event => void createEvent(event)} className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                <h3 className="text-sm font-semibold">Schedule an event</h3>
                <input value={eventName} onChange={event => setEventName(event.target.value)} placeholder="Event name" maxLength={100} required className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" />
                <textarea value={eventDescription} onChange={event => setEventDescription(event.target.value)} placeholder="Details" maxLength={2000} className="min-h-20 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" />
                <div className="grid gap-2 sm:grid-cols-2"><input value={eventStart} onChange={event => setEventStart(event.target.value)} type="datetime-local" required min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} className="min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" /><input value={eventLocation} onChange={event => setEventLocation(event.target.value)} placeholder="Location or channel" maxLength={200} className="min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" /></div>
                <button disabled={!eventName.trim() || !eventStart} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm text-white disabled:opacity-40">Create event</button>
              </form>}
              {events.map(event => {
                const interested = event.interestedUserIds.includes(user.userId)
                const canEditEvent = !rolePreviewActive && (can(rolePermissionsForUser, 'MANAGE_EVENTS') || event.createdBy === user.userId)
                return <article key={event._id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                  {editingEventId === event._id ? <form onSubmit={event => void saveEventEdit(event)} className="space-y-2">
                    <input value={editEventName} onChange={event => setEditEventName(event.target.value)} maxLength={100} required className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" />
                    <textarea value={editEventDescription} onChange={event => setEditEventDescription(event.target.value)} maxLength={2000} className="min-h-16 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" />
                    <div className="grid gap-2 sm:grid-cols-2"><input type="datetime-local" value={editEventStart} onChange={event => setEditEventStart(event.target.value)} required className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" /><input value={editEventLocation} onChange={event => setEditEventLocation(event.target.value)} maxLength={200} placeholder="Location or channel" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" /></div>
                    <button className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs text-white">Save changes</button><button type="button" onClick={() => setEditingEventId('')} className="ml-2 rounded-lg bg-[var(--app-panel)] px-3 py-2 text-xs">Cancel</button>
                  </form> : <>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{event.name}</h3><time className="text-xs text-[var(--text-secondary)]">{new Date(event.scheduledStartAt).toLocaleString()}</time></div>{canEditEvent && <div className="flex gap-1"><button onClick={() => beginEventEdit(event)} title="Edit event" className="rounded-lg px-2 py-1 text-xs text-[var(--app-accent)]">Edit</button><button onClick={() => void deleteEvent(event)} title="Cancel event" className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16} /></button></div>}</div>
                    {event.location && <p className="mt-2 text-xs text-[var(--text-secondary)]">{event.location}</p>}
                    {event.description && <p className="mt-2 whitespace-pre-wrap text-sm">{event.description}</p>}
                    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-[var(--text-secondary)]">{event.interestedUserIds.length} interested</span>{rolePreviewActive ? <span className="text-xs text-[var(--text-secondary)]">{interested ? 'Going' : ''}</span> : <button onClick={() => void respondToEvent(event, !interested)} className={`rounded-lg px-3 py-1.5 text-xs ${interested ? 'bg-[var(--app-accent)] text-white' : 'bg-[var(--app-panel)]'}`}>{interested ? 'Going' : 'Interested'}</button>}</div>
                  </>}
                </article>
              })}
              {events.length === 0 && <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No upcoming events.</p>}
            </div>
          </section>
        </div>
      )}

      {copyIdMenu && <div
        data-copy-id-menu
        onPointerDown={event => event.stopPropagation()}
        style={{ left: Math.max(8, Math.min(copyIdMenu.x, window.innerWidth - 180)), top: Math.max(8, Math.min(copyIdMenu.y, window.innerHeight - 60)) }}
        className="fixed z-[150] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-xl"
      >
        <button onClick={async () => {
          try {
            await navigator.clipboard.writeText(copyIdMenu.id)
            setCopyIdMenu(null)
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not copy this ID.')
            setCopyIdMenu(null)
          }
        }} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-[var(--app-surface-hover)]"><Copy size={14} />Copy ID</button>
      </div>}

      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm sm:p-6">
          <section className="space-settings-dialog flex h-[min(92vh,900px)] max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] sm:flex-row">
            <nav aria-label="Space settings sections" className="flex w-full shrink-0 flex-row gap-2 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-surface)] p-2 sm:w-60 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4">
              <div className="mb-2 hidden items-center justify-between gap-2 px-1 pb-3 sm:flex sm:border-b sm:border-[var(--app-border)]">
                <span className="hidden text-sm font-bold sm:block">Space settings</span>
                <button onClick={() => setShowSettings(false)} aria-label="Close settings" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"><X size={17} /></button>
              </div>
              {settingsGroups.map(group => {
                const items = group.items.filter(item => item.allowed)
                if (!items.length) return null
                return <div key={group.title} className="flex shrink-0 items-center gap-1 sm:block sm:space-y-1">
                  <p className="hidden px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] sm:block">{group.title}</p>
                  {items.map(item => {
                    const Icon = item.icon
                    return <button key={item.id} onClick={() => setSettingsTab(item.id)} title={item.label} aria-current={settingsTab === item.id ? 'page' : undefined} className={`space-settings-nav-item flex w-auto shrink-0 items-center justify-start gap-2 px-3 py-2 text-left text-xs font-medium sm:w-full sm:py-2.5 sm:text-sm ${settingsTab === item.id ? 'font-semibold' : 'hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'}`}><Icon size={16} /><span className="truncate">{item.label}</span></button>
                  })}
                </div>
              })}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] px-4 py-3 sm:px-7">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--app-accent)]">{space.name}</p>
                  <h2 className="truncate text-lg font-bold">Space settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)} title="Close settings" className="rounded-lg border border-[var(--app-border)] p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X size={17} /></button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              {settingsTab === 'overview' && (
                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                    <div className="h-24 bg-gradient-to-r from-[var(--app-accent)]/40 via-[var(--app-accent)]/10 to-transparent" style={space.banner ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.25), rgba(0,0,0,.05)), url("${space.banner}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} />
                    <div className="flex items-end gap-3 px-5 pb-4">
                      <span className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--app-surface)] bg-[var(--app-accent)] text-xl font-bold text-white">{space.icon ? <img src={space.icon} alt="" className="h-full w-full object-cover" /> : space.name[0]?.toUpperCase()}</span>
                      <div className="min-w-0 pb-1"><h3 className="truncate text-lg font-bold">{space.name}</h3><p className="text-xs text-[var(--text-secondary)]">{space.members.length} members · {space.channels.length} channels</p></div>
                    </div>
                  </div>
                  <section className="space-y-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div><h3 className="font-semibold">Space identity</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Set the name and artwork members see throughout the app.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">Space icon<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={Boolean(spaceImageLoading)} onChange={event => void uploadSpaceImage('icon', event.target.files?.[0])} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]" />{spaceImageLoading === 'icon' && <span className="mt-1 block">Uploading…</span>}</label>
                      <label className="text-xs font-medium text-[var(--text-secondary)]">Space banner<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={Boolean(spaceImageLoading)} onChange={event => void uploadSpaceImage('banner', event.target.files?.[0])} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]" />{spaceImageLoading === 'banner' && <span className="mt-1 block">Uploading…</span>}</label>
                    </div>
                    <label className="block text-sm">Space name<input defaultValue={space.name} maxLength={100} onBlur={event => { if (event.target.value.trim() && event.target.value !== space.name) void saveSettings('', 'PATCH', { name: event.target.value.trim() }).catch(caught => setError(caught.message)) }} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5" /></label>
                    <label className="block text-sm">Description<textarea defaultValue={space.description} maxLength={1000} onBlur={event => { if (event.target.value !== space.description) void saveSettings('', 'PATCH', { description: event.target.value }).catch(caught => setError(caught.message)) }} className="mt-2 min-h-24 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5" /></label>
                  </section>
                  <section className="space-y-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        Community Welcome & Onboarding
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Automatically welcome new arrivals and assign a starter role when they join your Space.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-[var(--text-secondary)]">
                        Welcome Channel
                        <select
                          value={space.welcomeChannelId || ''}
                          onChange={event => void saveSettings('', 'PATCH', { welcomeChannelId: event.target.value }).catch(caught => setError(caught.message))}
                          className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">No welcome channel</option>
                          {space.channels.filter(c => c.type !== 'voice').map(channel => (
                            <option key={channel.id} value={channel.id}>#{channel.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        Auto-Role on Join
                        <select
                          value={space.autoRoleId || ''}
                          onChange={event => void saveSettings('', 'PATCH', { autoRoleId: event.target.value }).catch(caught => setError(caught.message))}
                          className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">No auto-role</option>
                          {space.roles.filter(r => r.id !== 'everyone').map(role => (
                            <option key={role.id} value={role.id}>@{role.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        Rules Channel
                        <select
                          value={space.rulesChannelId || ''}
                          onChange={event => void saveSettings('', 'PATCH', { rulesChannelId: event.target.value }).catch(caught => setError(caught.message))}
                          className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">No rules channel</option>
                          {space.channels.filter(c => c.type !== 'voice').map(channel => (
                            <option key={channel.id} value={channel.id}>#{channel.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        System Messages Channel
                        <select
                          value={space.systemChannelId || ''}
                          onChange={event => void saveSettings('', 'PATCH', { systemChannelId: event.target.value }).catch(caught => setError(caught.message))}
                          className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">No system messages channel</option>
                          {space.channels.filter(c => c.type !== 'voice').map(channel => (
                            <option key={channel.id} value={channel.id}>#{channel.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs text-[var(--text-secondary)]">
                      Welcome Message Template
                      <input
                        defaultValue={space.welcomeMessageTemplate || 'Welcome {user} to {space}! 🎉'}
                        maxLength={500}
                        placeholder="Welcome {user} to {space}! 🎉"
                        onBlur={event => {
                          if (event.target.value !== (space.welcomeMessageTemplate || '')) {
                            void saveSettings('', 'PATCH', { welcomeMessageTemplate: event.target.value }).catch(caught => setError(caught.message))
                          }
                        }}
                        className="mt-1.5 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--text-primary)]"
                      />
                      <span className="mt-1 block text-[10px] text-[var(--text-secondary)] opacity-70">
                        Variables: {'{user}'} mentions the new member, {'{space}'} inserts Space name.
                      </span>
                    </label>
                  </section>
                  {space.ownerId === user.userId && <section className="flex items-center gap-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div className="min-w-0 flex-1"><h3 className="font-semibold">Public Space</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">List this Space in Explore so anyone can find and join it. Private Spaces stay invite-only.</p></div>
                    <button type="button" role="switch" aria-label="List Space publicly" aria-checked={space.isPublic} disabled={saving} onClick={() => void saveSettings('', 'PATCH', { isPublic: !space.isPublic }).catch(caught => setError(caught.message))} className="space-toggle" data-state={space.isPublic ? 'on' : 'off'}>
                      <span className="space-toggle-thumb" />
                    </button>
                  </section>}
                  {space.ownerId === user.userId && <section className="space-y-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div><h3 className="font-semibold">Public widget</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Embed a live Space card on your website. It only shares public Space details and one everyone-visible channel.</p></div>
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--app-panel)] p-3"><span className="text-sm font-medium">Public widget</span><button type="button" role="switch" aria-label="Enable public widget" aria-checked={space.widgetEnabled} disabled={!space.isPublic || !space.widgetChannelId || widgetChannels.length === 0 || saving} onClick={() => void saveSettings('', 'PATCH', { widgetEnabled: !space.widgetEnabled }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not update widget settings.'))} className="space-toggle"><span className="space-toggle-thumb" /></button></div>
                    {!space.isPublic && <p className="text-xs text-amber-300">Make this Space public in Explore before enabling its widget.</p>}
                    <label className="block text-sm">Widget channel<select value={space.widgetChannelId} disabled={!space.isPublic || saving} onChange={event => void saveSettings('', 'PATCH', { widgetChannelId: event.target.value }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not update widget channel.'))} className="mt-2 w-full rounded-lg border border-[var(--app-border)] px-3 py-2.5"><option value="">Choose a public channel</option>{widgetChannels.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
                    {space.widgetEnabled && space.widgetChannelId && <div className="space-y-3"><iframe title={`${space.name} public widget preview`} src={`${window.location.origin}/api/spaces/${spaceId}/widget`} loading="lazy" className="h-[270px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]" /><div className="flex flex-wrap items-center gap-2"><a href={`${window.location.origin}/api/spaces/${spaceId}/widget.json`} target="_blank" rel="noreferrer" className="settings-secondary px-3 py-2 text-sm font-semibold">Open widget data</a><button onClick={() => void copyWidgetEmbed()} className="settings-primary px-3 py-2 text-sm font-semibold">Copy embed code</button></div></div>}
                    {space.widgetEnabled && widgetChannels.length === 0 && <p className="text-xs text-amber-300">No text channel is visible to @everyone yet. Update its channel permissions first.</p>}
                    <p className="text-[11px] text-[var(--text-secondary)]">Encrypted messages are never included in the widget or indexed for web search.</p>
                  </section>}
                  <section className="space-y-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div><h3 className="font-semibold">Safety and notifications</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Verification checks run when someone joins by invite or public listing. They do not scan encrypted messages.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">Verification level<select disabled={saving} value={space.verificationLevel} onChange={event => void saveSettings('', 'PATCH', { verificationLevel: event.target.value }).catch(caught => setError(caught.message))} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5"><option value="none">None</option><option value="low">Low · account at least 1 hour old</option><option value="medium">Medium · account at least 1 day old</option><option value="high">High · account at least 7 days old</option></select></label>
                      <label className="text-sm">Default notifications<select disabled={saving} value={space.defaultNotifications} onChange={event => void saveSettings('', 'PATCH', { defaultNotifications: event.target.value }).catch(caught => setError(caught.message))} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5"><option value="all">All messages</option><option value="mentions">Mentions only</option></select></label>
                      <p className="text-xs text-[var(--text-secondary)] sm:col-span-2">{space.verificationLevel === 'none' ? 'No additional join checks.' : `${space.verificationLevel[0].toUpperCase()}${space.verificationLevel.slice(1)} requires an encryption key and the account age shown above.`} This app does not collect email verification or phone numbers.</p>
                      <p className="text-xs text-[var(--text-secondary)] sm:col-span-2">Encrypted message contents cannot be scanned by a server-side explicit-content filter. This setting is unavailable rather than showing a control that cannot be enforced.</p>
                    </div>
                  </section>
                  {space.ownerId === user.userId && <section className="flex items-center gap-4 rounded-xl border border-[var(--app-border)] p-4 sm:p-5">
                    <div className="min-w-0 flex-1"><h3 className="font-semibold">New members can read message history</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">When enabled, members’ devices can securely share message decryption keys with new members. Messages remain end-to-end encrypted; the server never decrypts them. When disabled, new members only receive messages sent after they joined.</p></div>
                    <button type="button" role="switch" aria-label="Share message history with new members" aria-checked={space.shareHistoryWithNewMembers} disabled={saving} onClick={() => void saveSettings('', 'PATCH', { shareHistoryWithNewMembers: !space.shareHistoryWithNewMembers }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not update message history access.'))} className="space-toggle"><span className="space-toggle-thumb" /></button>
                  </section>}
                  <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-4"><button onClick={() => void copyInvite()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">Create invite link</button><button onClick={async () => { try { const result = await saveSettings('/invites', 'PATCH'); await copyExistingInviteLink(result.code) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not replace the invite.') } }} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">Replace old invite</button></div>
                  {space.ownerId === user.userId && <label className="block border-t border-[var(--app-border)] pt-4 text-sm">Transfer ownership<select defaultValue="" onChange={async event => { const select = event.currentTarget; const userId = select.value; if (!userId) return; if (window.prompt(`Type TRANSFER to make this member the owner of ${space.name}.`) !== 'TRANSFER') { select.value = ''; return } try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/transfer-ownership`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not transfer ownership.'); await loadSpace() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not transfer ownership.') } finally { select.value = '' } }} className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"><option value="">Choose a member</option>{space.members.filter(item => item.userId !== user.userId).map(item => <option key={item.userId} value={item.userId}>{item.displayName || item.username}</option>)}</select><span className="mt-1 block text-xs text-[var(--text-secondary)]">Ownership transfer is protected by account authentication and a typed confirmation. Two-factor or email re-verification is not available in this app yet.</span></label>}
                  {space.ownerId !== user.userId && <button onClick={async () => { if (!window.confirm(`Leave ${space.name}?`)) return; try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/leave`, { method: 'POST', headers: authHeaders() }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not leave this Space.'); onExit() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not leave this Space.') } }} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300">Leave Space</button>}
                  {space.ownerId === user.userId && <button onClick={async () => { if (window.prompt(`Permanently delete ${space.name} and its channel messages? Type the Space name to confirm.`) !== space.name) return; try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}`, { method: 'DELETE', headers: authHeaders() }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not delete this Space.'); onExit() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this Space.') } }} className="settings-danger px-3 py-2 text-sm font-semibold">Delete Space</button>}
                </div>
              )}
              {settingsTab === 'roles' && (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3"><div><h3 className="text-lg font-bold">Roles & permissions</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Roles control what members can do and how they appear. Use View as role to safely test channel visibility.</p></div><span className="shrink-0 rounded-full bg-[var(--app-surface)] px-3 py-1 text-xs text-[var(--text-secondary)]">{space.roles.length} roles</span></div>
                  <form onSubmit={event => void createRole(event)} className="space-y-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={roleName} onChange={event => setRoleName(event.target.value)} placeholder="Name this role" maxLength={100} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm" />
                      <input value={roleIcon} onChange={event => setRoleIcon(event.target.value)} placeholder="Icon emoji" aria-label="New role icon emoji" maxLength={32} className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2.5 text-sm" />
                      <label className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">Color<input aria-label="New role color" type="color" value={newRoleColor} onChange={event => setNewRoleColor(event.target.value)} className="h-7 w-8 cursor-pointer rounded bg-transparent" /></label>
                      <button disabled={!roleName.trim()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Create role</button>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--app-accent)]">Choose permissions for this role</summary>
                      <div className="mt-3 border-t border-[var(--app-border)] pt-3"><PermissionToggleGrid value={rolePermissions} onChange={setRolePermissions} excludeAdministrator /></div>
                    </details>
                  </form>
                  <div className="space-y-2">{[...space.roles].sort((a, b) => b.position - a.position).map(role => <div key={role.id} onContextMenu={event => openCopyIdMenu(event, role.id)} className="flex items-start gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2"><div className="min-w-0 flex-1"><RoleEditor spaceId={spaceId} role={role} onSave={loadSpace} onError={setError} /></div>{role.id !== 'everyone' && <div className="flex flex-wrap gap-1 pt-3"><button onClick={() => { setViewingRoleIds([role.id]); setShowSettings(false); setShowAssets(false); setActiveThread(null) }} title={`Preview as ${role.name}`} className="settings-secondary px-2 py-1.5 text-[10px] font-semibold">View as</button><button disabled={role.position <= 1} onClick={() => void moveRole(role, -1)} title="Move role up" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-panel)] disabled:opacity-30"><ArrowUp size={14} /></button><button disabled={role.position >= space.roles.length - 1} onClick={() => void moveRole(role, 1)} title="Move role down" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-panel)] disabled:opacity-30"><ArrowDown size={14} /></button></div>}</div>)}</div>
                </div>
              )}
              {settingsTab === 'members' && (
                <div className="space-y-3">
                  <div><h3 className="text-lg font-bold">Members</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">View member profiles, manage roles, and take moderation actions you have permission to use.</p></div>
                  {space.members.map(item => <MemberRoleEditor key={item.userId} spaceId={spaceId} member={item} roles={space.roles.filter(role => role.id !== 'everyone')} manageableRoleIds={manageableMemberRoles.map(role => role.id)} canManage={canManageRoles} canModerate={isAdministrator || can(rolePermissionsForUser, 'MODERATE_MEMBERS')} canKick={canKick && item.userId !== user.userId} canBan={canBan && item.userId !== user.userId} canManageNicknames={isAdministrator || can(rolePermissionsForUser, 'MANAGE_NICKNAMES')} canChangeOwnNickname={item.userId === user.userId && can(rolePermissionsForUser, 'CHANGE_NICKNAME')} onViewProfile={showSpaceProfile} onQuickProfile={showSpaceQuickProfile} onSave={loadSpace} onError={setError} />)}
                </div>
              )}
              {settingsTab === 'assets' && (
                <div className="space-y-4">
                  <div><h3 className="text-lg font-bold">Emoji & stickers</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Custom assets are available to members in this Space. Limits are 100 static emojis, 100 animated emojis, and 50 stickers.</p></div>
                  <div className="flex gap-2 border-b border-[var(--app-border)]">
                    {([['emojis', 'Emoji', space.emojis.length], ['stickers', 'Stickers', space.stickers.length]] as const).map(([type, label, count]) => <button key={type} onClick={() => setAssetType(type)} className={`border-b-2 px-3 py-2 text-sm font-medium ${assetType === type ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{label}<span className="ml-2 text-xs opacity-70">{count}</span></button>)}
                  </div>
                  <form onSubmit={event => void addAsset(event)} className="grid gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:grid-cols-2">
                    <label className="text-xs text-[var(--text-secondary)]">Name<input value={assetName} onChange={event => setAssetName(event.target.value)} placeholder={assetType === 'emojis' ? 'e.g. sparkle' : 'Sticker name'} maxLength={32} className="mt-1 block w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                    {assetType === 'stickers' && <label className="text-xs text-[var(--text-secondary)]">Search emoji<input value={assetEmoji} onChange={event => setAssetEmoji(event.target.value)} placeholder="e.g. 😂" aria-label="Related emoji for sticker search" maxLength={16} className="mt-1 block w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>}
                    <label className="text-xs text-[var(--text-secondary)]">Image<input type="file" accept={assetType === 'emojis' ? 'image/png,image/jpeg,image/gif,image/webp' : 'image/png,image/gif,image/webp'} onChange={event => setAssetFile(event.target.files?.[0] || null)} className="mt-1 block min-w-0 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2 text-xs text-[var(--text-primary)]" /></label>
                    <button disabled={!assetName.trim() || !assetFile || (assetType === 'stickers' && !assetEmoji.trim())} className="self-end rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Upload {assetType === 'emojis' ? 'emoji' : 'sticker'}</button>
                  </form>
                  <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><ImagePlus size={14} />{assetType === 'emojis' ? 'PNG, WebP, GIF or APNG · max 256 KB · square image (128 x 128 recommended)' : 'PNG, WebP, GIF or APNG · exactly 320 x 320 · max 512 KB'}</p>
                  <input value={assetSearch} onChange={event => setAssetSearch(event.target.value)} aria-label={`Search Space ${assetType}`} placeholder={`Search ${assetType} by name${assetType === 'stickers' ? ' or emoji' : ''}…`} className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm" />
                  {searchedAssets.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{searchedAssets.map(asset => <article key={asset.id} className="group overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                    <div className="flex h-28 items-center justify-center bg-[var(--app-panel)] p-3"><img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" /></div>
                    <div className="flex items-center gap-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{asset.name}</p><p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{asset.kind === 'emojis' ? (asset.animated ? 'Animated emoji' : 'Static emoji') : `Sticker ${'associatedEmoji' in asset && asset.associatedEmoji ? `· ${asset.associatedEmoji}` : ''}`}</p></div><button onClick={() => void saveSettings(`/assets/${asset.kind}/${asset.id}`, 'DELETE').then(() => window.dispatchEvent(new Event('space-assets-updated'))).catch(caught => setError(caught.message))} aria-label={`Remove ${asset.name}`} title="Remove" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15} /></button></div>
                  </article>)}</div> : <div className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-10 text-center"><Smile size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" /><p className="text-sm font-medium">{visibleAssets.length ? `No matching ${assetType}` : `No ${assetType} yet`}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{visibleAssets.length ? 'Try another search.' : 'Upload one above to get started.'}</p></div>}
                </div>
              )}
              {settingsTab === 'invites' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Invites</h3>
                  {space.ownerId === user.userId && <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Pause new joins</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Temporarily reject invite and public joins without revoking existing links.</p></div>
                    <button type="button" role="switch" aria-checked={space.invitesPaused} disabled={saving} onClick={() => void saveSettings('/invites/pause', 'PATCH', { paused: !space.invitesPaused }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not update invite settings.'))} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${space.invitesPaused ? 'bg-amber-500' : 'bg-[var(--app-border)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${space.invitesPaused ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                  </div>}
                  {space.invitesPaused && <p role="status" className="rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">New joins are paused. Current members can still use the Space.</p>}
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="text-xs text-[var(--text-secondary)]">Expires in<select value={inviteExpiry} onChange={event => setInviteExpiry(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">1 day</option><option value="10080">7 days</option><option value="43200">30 days</option><option value="0">Never</option></select></label>
                    <label className="text-xs text-[var(--text-secondary)]">Uses<select value={inviteUses} onChange={event => setInviteUses(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"><option value="0">Unlimited</option><option value="1">1 use</option><option value="5">5 uses</option><option value="10">10 uses</option><option value="25">25 uses</option><option value="50">50 uses</option><option value="100">100 uses</option></select></label>
                    <button onClick={() => void copyInvite()} disabled={space.invitesPaused} className="self-end rounded-lg bg-[var(--app-accent)] px-3 py-2 text-sm text-white disabled:opacity-50">Create & copy invite</button>
                  </div>
                  {invites.map(invite => <div key={invite.code} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--app-surface)] p-3 text-xs"><code className="min-w-0 flex-1 break-all">{invite.code}</code><span>{invite.uses}{invite.maxUses ? ` / ${invite.maxUses}` : ''} uses</span><span>{invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : 'No expiry'}</span><button onClick={() => void copyExistingInviteLink(invite.code)} className="rounded-md px-2 py-1 text-[var(--app-accent)] hover:bg-[var(--app-panel)]">Copy link</button><button onClick={async () => { try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/invites/${encodeURIComponent(invite.code)}`, { method: 'DELETE', headers: authHeaders() }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not revoke invite.'); setInvites(previous => previous.filter(item => item.code !== invite.code)) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not revoke invite.') } }} className="text-red-300">Revoke</button></div>)}
                  {invites.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No active invites.</p>}
                </div>
              )}
              {settingsTab === 'bans' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold">Banned members</h3>
                  {bans.map(banned => <div key={banned.userId} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--app-surface)] p-3"><div className="min-w-0"><span className="block truncate text-sm">{banned.displayName || banned.username || banned.userId}</span><span className="block truncate text-xs text-[var(--text-secondary)]">{banned.reason || 'No reason provided'}{banned.bannedAt ? ` · ${new Date(banned.bannedAt).toLocaleDateString()}` : ''}</span></div><button onClick={async () => { try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/bans/${banned.userId}`, { method: 'DELETE', headers: authHeaders() }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not unban member.'); setBans(previous => previous.filter(item => item.userId !== banned.userId)) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not unban member.') } }} className="text-xs text-[var(--app-accent)]">Unban</button></div>)}
                  {bans.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No banned members.</p>}
                </div>
              )}
              {settingsTab === 'audit' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">Audit history</h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Recent administrative and moderation changes in this Space.</p>
                  </div>
                  {auditLogs.length === 0 ? (
                    <p className="rounded-lg bg-[var(--app-surface)] p-4 text-sm text-[var(--text-secondary)]">No recorded changes yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {auditLogs.map(log => {
                        const targetMember = space.members.find(m => m.userId === log.targetId);
                        const targetUserLabel = targetMember ? `@${targetMember.displayName || targetMember.username}` : (log.targetId ? `ID: ${log.targetId}` : '');
                        return (
                          <li key={log.id} className="rounded-xl border border-white/10 bg-[var(--app-surface)] p-3.5 space-y-1.5 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 font-bold text-xs">
                                  {log.actorName[0]?.toUpperCase() || 'A'}
                                </span>
                                <p className="text-sm">
                                  <span className="font-bold text-white">{log.actorName}</span>{' '}
                                  <span className="text-[var(--text-secondary)]">{formatAuditAction(log.action)}</span>{' '}
                                  {targetUserLabel && <span className="font-semibold text-[var(--app-accent)]">{targetUserLabel}</span>}
                                </p>
                              </div>
                              <time className="text-[11px] text-[var(--text-secondary)]">{new Date(log.createdAt).toLocaleString()}</time>
                            </div>
                            <AuditLogDetails details={log.details} action={log.action} space={space} />
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
              {settingsTab === 'niko' && (
                <div className="h-full">
                  <NikoStudioModal spaceId={spaceId} space={space} onRefreshSpace={loadSpace} />
                </div>
              )}
              {!canManageSpace && <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]"><Shield size={14} /> Some Space settings are only available to members with the right permissions.</div>}
              </div>
            </div>
          </section>
        </div>
      )}
      {quickProfileMember && <SpaceMemberQuickProfile
        member={quickProfileMember}
        spaceName={space.name}
        roles={space.roles}
        anchor={quickProfileAnchor}
        onClose={() => { setQuickProfileMember(null); setQuickProfileAnchor(null) }}
        onViewFullProfile={() => {
          const member = quickProfileMember
          setQuickProfileMember(null)
          setQuickProfileAnchor(null)
          showSpaceProfile(member)
        }}
        onMention={() => mentionSpaceMember(quickProfileMember)}
        onMessage={onMessageUser ? () => {
          const member = quickProfileMember
          setQuickProfileMember(null)
          setQuickProfileAnchor(null)
          onMessageUser?.(member.userId)
        } : undefined}
        canManageRoles={canManageRoles && quickProfileMember.userId !== user.userId}
        canModerate={canModerate && quickProfileMember.userId !== user.userId && quickProfileMember.userId !== space.ownerId}
        canKick={canKick && quickProfileMember.userId !== user.userId && quickProfileMember.userId !== space.ownerId}
        canBan={canBan && quickProfileMember.userId !== user.userId && quickProfileMember.userId !== space.ownerId}
        canManageNicknames={canManageNicknames || (canChangeOwnNickname && quickProfileMember.userId === user.userId)}
        isOwner={quickProfileMember.userId === space.ownerId}
        onTimeout={async (durationMinutes) => {
          await handleTimeoutMember(quickProfileMember.userId, durationMinutes)
        }}
        onKick={async (reason) => {
          await handleKickMember(quickProfileMember.userId, reason)
        }}
        onBan={async (reason) => {
          await handleBanMember(quickProfileMember.userId, reason)
        }}
        onChangeNickname={async (nickname) => {
          await handleUpdateNickname(quickProfileMember.userId, nickname)
        }}
        assignableRoleIds={manageableMemberRoles.map(role => role.id)}
        onToggleRole={async (roleId, durationHours) => {
          const member = quickProfileMember
          if (!member) return
          const nextRoleIds = member.roleIds.includes(roleId)
            ? member.roleIds.filter(id => id !== roleId)
            : [...member.roleIds, roleId]
          try {
            const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/roles`, {
              method: 'PUT',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roleIds: nextRoleIds,
                ...(durationHours ? { temporaryRoleHours: { [roleId]: durationHours } } : {})
              })
            })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update member roles.')
            setQuickProfileMember(previous => previous?.userId === member.userId ? { ...previous, roleIds: data.roleIds, temporaryRoleAssignments: data.temporaryRoleAssignments } : previous)
            await loadSpace()
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not update member roles.')
          }
        }}
      />}
      {/* Discord Quick-Action Mod Context Menu */}
      {modMenuTarget && (
        <div className="fixed inset-0 z-[220]" onClick={() => setModMenuTarget(null)}>
          <div
            style={{
              left: Math.min(window.innerWidth - 200, Math.max(8, modMenuTarget.x)),
              top: Math.min(window.innerHeight - 280, Math.max(8, modMenuTarget.y))
            }}
            onClick={e => e.stopPropagation()}
            className="fixed z-[221] w-48 rounded-xl border border-white/20 bg-[var(--app-panel)]/95 p-1 shadow-2xl backdrop-blur-xl ring-1 ring-black/40 text-xs"
          >
            <button
              type="button"
              onClick={() => {
                const target = modMenuTarget.member
                setModMenuTarget(null)
                showSpaceProfile(target)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-surface)] text-[var(--text-primary)]"
            >
              <UserRound size={13} /> View Profile
            </button>
            <button
              type="button"
              onClick={() => {
                const target = modMenuTarget.member
                setModMenuTarget(null)
                mentionSpaceMember(target)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-surface)] text-[var(--text-primary)]"
            >
              <AtSign size={13} /> Mention
            </button>

            {(canManageNicknames || (canChangeOwnNickname && modMenuTarget.member.userId === user.userId)) && (
              <button
                type="button"
                onClick={() => {
                  const target = modMenuTarget.member
                  setModMenuTarget(null)
                  setNicknameValue(target.nickname || '')
                  setNicknameModalMember(target)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-surface)] text-[var(--text-primary)]"
              >
                <Edit3 size={13} /> Change Nickname
              </button>
            )}

            {canManageRoles && modMenuTarget.member.userId !== user.userId && (
              <button
                type="button"
                onClick={() => {
                  const target = modMenuTarget.member
                  setModMenuTarget(null)
                  setRolesModalMember(target)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-surface)] text-[var(--text-primary)]"
              >
                <Shield size={13} /> Manage Roles
              </button>
            )}

            <div className="my-1 border-t border-[var(--app-border)]" />

            {canModerate && modMenuTarget.member.userId !== user.userId && modMenuTarget.member.userId !== space.ownerId && (
              <button
                type="button"
                onClick={() => {
                  const target = modMenuTarget.member
                  setModMenuTarget(null)
                  setTimeoutModalMember(target)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/20 text-amber-300 font-medium"
              >
                <Clock size={13} /> {modMenuTarget.member.mutedUntil && new Date(modMenuTarget.member.mutedUntil) > new Date() ? 'Remove Timeout' : 'Timeout User'}
              </button>
            )}

            {canKick && modMenuTarget.member.userId !== user.userId && modMenuTarget.member.userId !== space.ownerId && (
              <button
                type="button"
                onClick={() => {
                  const target = modMenuTarget.member
                  setModMenuTarget(null)
                  setKickModalMember(target)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-red-500/20 text-red-300 font-medium"
              >
                <UserMinus size={13} /> Kick User
              </button>
            )}

            {canBan && modMenuTarget.member.userId !== user.userId && modMenuTarget.member.userId !== space.ownerId && (
              <button
                type="button"
                onClick={() => {
                  const target = modMenuTarget.member
                  setModMenuTarget(null)
                  setBanModalMember(target)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-red-600/20 text-red-400 font-medium"
              >
                <Ban size={13} /> Ban User
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                const target = modMenuTarget.member
                setModMenuTarget(null)
                await navigator.clipboard.writeText(target.userId)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
            >
              <Copy size={13} /> Copy ID
            </button>
          </div>
        </div>
      )}

      {/* Timeout Modal */}
      {timeoutModalMember && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-[var(--text-primary)]">
              Timeout {timeoutModalMember.nickname || timeoutModalMember.displayName || timeoutModalMember.username}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Prevent this member from sending messages or connecting to voice channels.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Duration</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  [1, '60 Seconds'],
                  [5, '5 Minutes'],
                  [10, '10 Minutes'],
                  [60, '1 Hour'],
                  [1440, '1 Day'],
                  [10080, '1 Week']
                ].map(([mins, label]) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimeoutDurationMinutes(Number(mins))}
                    className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                      timeoutDurationMinutes === mins
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/20 font-bold text-[var(--app-accent)]'
                        : 'border-[var(--app-border)] hover:bg-[var(--app-surface)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              {timeoutModalMember.mutedUntil && new Date(timeoutModalMember.mutedUntil) > new Date() && (
                <button
                  type="button"
                  onClick={() => void handleTimeoutMember(timeoutModalMember.userId, 0)}
                  className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                >
                  Remove Timeout
                </button>
              )}
              <button
                type="button"
                onClick={() => setTimeoutModalMember(null)}
                className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTimeoutMember(timeoutModalMember.userId, timeoutDurationMinutes)}
                className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110"
              >
                Apply Timeout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kick Modal */}
      {kickModalMember && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-red-400">
              Kick {kickModalMember.nickname || kickModalMember.displayName || kickModalMember.username}?
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              This member will be removed from the Space. They can rejoin with an invite link.
            </p>
            <label className="mt-4 block text-xs text-[var(--text-secondary)]">
              Reason (optional)
              <input
                value={kickReason}
                onChange={e => setKickReason(e.target.value)}
                maxLength={500}
                placeholder="Reason for kick"
                className="mt-1.5 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
            </label>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setKickModalMember(null); setKickReason('') }}
                className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleKickMember(kickModalMember.userId, kickReason)}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
              >
                Kick
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {banModalMember && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-red-400">
              Ban {banModalMember.nickname || banModalMember.displayName || banModalMember.username}?
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              This member will be permanently banned from the Space and cannot rejoin.
            </p>
            <label className="mt-4 block text-xs text-[var(--text-secondary)]">
              Reason (optional)
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                maxLength={500}
                placeholder="Reason for ban"
                className="mt-1.5 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
            </label>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setBanModalMember(null); setBanReason('') }}
                className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBanMember(banModalMember.userId, banReason)}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
              >
                Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nickname Modal */}
      {nicknameModalMember && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-[var(--text-primary)]">
              Change Nickname
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Set a server-specific nickname for {nicknameModalMember.displayName || nicknameModalMember.username}.
            </p>
            <input
              type="text"
              value={nicknameValue}
              onChange={e => setNicknameValue(e.target.value)}
              placeholder="Leave blank to reset"
              maxLength={32}
              className="mt-4 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
              autoFocus
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setNicknameModalMember(null); setNicknameValue('') }}
                className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpdateNickname(nicknameModalMember.userId, nicknameValue.trim())}
                className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {rolesModalMember && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-[var(--text-primary)]">
              Manage Roles for {rolesModalMember.nickname || rolesModalMember.displayName || rolesModalMember.username}
            </h3>
            <div className="mt-4 max-h-60 space-y-1.5 overflow-y-auto">
              {space.roles.filter(r => r.id !== 'everyone').sort((a, b) => b.position - a.position).map(role => {
                const isAssigned = rolesModalMember.roleIds.includes(role.id)
                const canAssign = isAdministrator || (canManageRoles && role.position < actorTopRolePosition)
                return (
                  <button
                    key={role.id}
                    type="button"
                    disabled={!canAssign}
                    onClick={() => void handleToggleMemberRole(rolesModalMember.userId, role.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                      isAssigned ? 'bg-[var(--app-surface-hover)]' : 'hover:bg-[var(--app-surface)]'
                    } ${!canAssign ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="flex items-center gap-2 font-medium" style={{ color: role.color }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                      {role.name}
                    </span>
                    {isAssigned && <Check size={14} className="text-[var(--app-accent)]" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setRolesModalMember(null)}
                className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Topic Modal */}
      {showTopicModal && selectedChannel && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowTopicModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[var(--app-panel)] p-6 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <Hash size={18} className="text-[var(--text-secondary)]" />
                {selectedChannel.name}
              </h3>
              <button onClick={() => setShowTopicModal(false)} className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface)]">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Channel Topic</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed">
                {selectedChannel.topic || 'No topic has been set for this channel.'}
              </p>
            </div>
            {Boolean(selectedChannel.slowmodeSeconds && selectedChannel.slowmodeSeconds > 0) && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
                <Clock size={15} />
                <span>Slowmode is enabled: Members can post once every {selectedChannel.slowmodeSeconds} seconds.</span>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Edit Modal */}
      {editingChannel && (
        <ChannelEditModal
          channel={editingChannel}
          categories={space.categories}
          roles={space.roles}
          members={space.members}
          spaceId={spaceId}
          onSave={async updates => {
            await saveSettings(`/channels/${editingChannel.id}`, 'PATCH', updates)
            await loadSpace()
            setEditingChannel(null)
          }}
          onSyncPermissions={async () => {
            const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${editingChannel.id}/sync-permissions`, {
              method: 'POST',
              headers: authHeaders()
            })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not sync permissions.')
            await loadSpace()
            setEditingChannel(data.channel)
          }}
          onDelete={async () => {
            await saveSettings(`/channels/${editingChannel.id}`, 'DELETE')
            await loadSpace()
            if (selectedChannelId === editingChannel.id) {
              setSelectedChannelId('')
            }
            setEditingChannel(null)
          }}
          onClose={() => setEditingChannel(null)}
        />
      )}

      {/* Category Edit Modal */}
      {editingCategory && (
        <CategoryEditModal
          category={editingCategory}
          roles={space.roles}
          members={space.members}
          spaceId={spaceId}
          onSave={async updates => {
            await saveSettings(`/categories/${editingCategory.id}`, 'PATCH', updates)
            await loadSpace()
            setEditingCategory(null)
          }}
          onSyncChannels={async () => {
            const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/categories/${editingCategory.id}/sync-channels`, {
              method: 'POST',
              headers: authHeaders()
            })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not sync channels.')
            await loadSpace()
          }}
          onDelete={async () => {
            await saveSettings(`/categories/${editingCategory.id}`, 'DELETE')
            await loadSpace()
            setEditingCategory(null)
          }}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {/* Create Channel Modal */}
      {createChannelModalOpen && (
        <CreateChannelModal
          categories={space.categories}
          initialCategoryId={createChannelTargetCategoryId}
          onClose={() => setCreateChannelModalOpen(false)}
          onCreate={async (name, type, catId) => {
            const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, type, categoryId: catId })
            })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create channel.')
            await loadSpace()
            if (data.channel?.id) setSelectedChannelId(data.channel.id)
          }}
        />
      )}

      {/* Create Category Modal */}
      {createCategoryModalOpen && (
        <CreateCategoryModal
          onClose={() => setCreateCategoryModalOpen(false)}
          onCreate={async name => {
            const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/categories`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ name })
            })
            const data = await response.json()
            if (!response.ok || !data.ok) throw new Error(data.message || 'Could not create category.')
            await loadSpace()
          }}
        />
      )}
    </div>
  )
}


function ChannelEntry({
  channel,
  selected,
  unread,
  onSelect,
  onOpenSettings
}: {
  channel: SpaceChannel
  selected: boolean
  unread?: boolean
  onSelect: () => void
  onOpenSettings?: () => void
}) {
  const isVoice = channel.type === 'voice'
  const isPrivate = Boolean(
    channel.permissionOverwrites?.some(
      ov => (ov.roleId === 'everyone' || ov.roleId.includes('everyone')) && (ov.deny & (1 << 0))
    )
  )

  return (
    <div
      onClick={onSelect}
      className={`group/channel relative flex h-[34px] min-h-[34px] w-full cursor-pointer items-center gap-1.5 rounded-[4px] px-2 text-left text-[13.5px] font-medium transition-colors select-none ${
        selected
          ? 'bg-white/10 dark:bg-[#35373c] text-white font-semibold'
          : unread
          ? 'text-white font-semibold hover:bg-white/5'
          : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
      }`}
    >
      {selected ? (
        <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white shadow-xs" />
      ) : unread ? (
        <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-2 w-1 rounded-r-full bg-white" />
      ) : (
        <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-2 w-1 rounded-r-full bg-white/60 opacity-0 group-hover/channel:opacity-100 transition-opacity" />
      )}
      <span className={`shrink-0 ${selected || unread ? 'text-white' : 'text-[var(--text-secondary)] group-hover/channel:text-[var(--text-primary)]'}`}>
        {isVoice ? (
          <Volume2 size={18} />
        ) : channel.type === 'announcement' ? (
          <Megaphone size={18} />
        ) : channel.type === 'forum' ? (
          <MessageSquare size={18} />
        ) : (
          <Hash size={18} />
        )}
      </span>
      <span className="truncate whitespace-nowrap min-w-0 flex-1">{channel.name}</span>
      {isPrivate && (
        <span title="Private channel" className="shrink-0 text-[var(--text-secondary)]">
          <Lock size={12} />
        </span>
      )}
      {channel.type === 'announcement' && (
        <span className="shrink-0 rounded bg-[var(--app-surface)] px-1 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">ANN</span>
      )}
      {channel.nsfw && (
        <span className="shrink-0 rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-bold text-red-300">18+</span>
      )}
      {onOpenSettings && (
        <button
          type="button"
          title="Channel Settings"
          onClick={e => {
            e.stopPropagation()
            onOpenSettings()
          }}
          className="ml-auto hidden group-hover/channel:flex shrink-0 items-center justify-center rounded p-1 text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  )
}

function PermissionToggleGrid({ value, onChange, excludeAdministrator = false }: { value: number; onChange: (permissions: number) => void; excludeAdministrator?: boolean }) {
  const toggle = (key: PermissionKey) => onChange(value & PERMISSION_BITS[key] ? value & ~PERMISSION_BITS[key] : value | PERMISSION_BITS[key])
  return <div className="space-y-3">
    {PERMISSION_GROUPS.map(group => {
      const keys = group.keys.filter(key => !excludeAdministrator || key !== 'ADMINISTRATOR')
      return <section key={group.title} className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5">
          <div><h4 className="text-xs font-bold">{group.title}</h4><p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{group.description}</p></div>
          <button type="button" onClick={() => {
            const allEnabled = keys.every(key => Boolean(value & PERMISSION_BITS[key]))
            const next = keys.reduce((permissions, key) => allEnabled ? permissions & ~PERMISSION_BITS[key] : permissions | PERMISSION_BITS[key], value)
            onChange(next)
          }} className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]">
            {keys.every(key => Boolean(value & PERMISSION_BITS[key])) ? 'Clear all' : 'Enable all'}
          </button>
        </header>
        <div className="grid gap-1 p-2 sm:grid-cols-2">
          {keys.map(key => {
            const permission = PERMISSIONS.find(([permissionKey]) => permissionKey === key)
            if (!permission) return null
            const [, label, description] = permission
            const enabled = Boolean(value & PERMISSION_BITS[key])
            return <button key={key} type="button" role="switch" aria-checked={enabled} onClick={() => toggle(key)} className={`flex min-w-0 items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${enabled ? 'border-[var(--app-accent)]/40 bg-[var(--app-accent)]/10' : 'border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-surface)]'}`}>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-secondary)]">{description}</span></span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} /></span>
            </button>
          })}
        </div>
      </section>
    })}
  </div>
}

function getMessagePreview(content: string) {
  try {
    const payload = JSON.parse(content) as { text?: string; mediaType?: string }
    if (payload.text?.trim()) return payload.text.trim()
    if (payload.mediaType === 'sticker') return 'Sticker'
    if (payload.mediaType) return 'Attachment'
  } catch {
    return content || 'Message'
  }
  return 'Message'
}

function truncateReplyPreview(content: string, limit = 120) {
  const excerpt = Array.from(content)
  return excerpt.length > limit ? `${excerpt.slice(0, limit).join('')}…` : content
}

function getThreadTitle(title: string) {
  try {
    const payload = JSON.parse(title) as { text?: unknown }
    if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim()
  } catch {
    return title
  }
  return title
}

function MessageList({
  messages,
  decrypted,
  emojis,
  members,
  roles,
  spaceId,
  channelId,
  currentUserId,
  memberNameColor,
  onViewProfile,
  onQuickProfile,
  onReply,
  onDelete,
  canDelete,
  onCopy,
  threads = [],
  onSelectThread,
  onStartThread
}: {
  messages: Message[]
  decrypted: Record<string, string>
  emojis: SpaceData['emojis']
  members: SpaceMember[]
  roles: SpaceData['roles']
  spaceId: string
  channelId?: string
  currentUserId: string
  memberNameColor: (userId: string) => string | undefined
  onViewProfile?: (member: SpaceMember) => void
  onQuickProfile?: (member: SpaceMember, event: { clientX: number; clientY: number }) => void
  onReply?: (message: Message) => void
  onDelete?: (message: Message) => void
  canDelete?: (message: Message) => boolean
  onCopy?: (message: Message) => void
  threads?: SpaceThread[]
  onSelectThread?: (thread: SpaceThread) => void
  onStartThread?: (message: Message) => void
}) {
  const [menuMessageId, setMenuMessageId] = useState('')
  if (messages.length === 0) return <p className="py-12 text-center text-sm text-[var(--text-secondary)]">No replies yet. Start the conversation.</p>
  return <div className="space-y-0.5">
    {messages.map((message, index) => {
      const previous = messages[index - 1]
      const groupedWithPrevious = Boolean(previous && previous.senderId === message.senderId &&
        new Date(message.timestamp).getTime() - new Date(previous.timestamp).getTime() < 5 * 60 * 1000)
      const sender = members.find(member => member.userId === message.senderId)
      const topRole = roles.filter(role => sender?.roleIds.includes(role.id)).sort((a, b) => b.position - a.position)[0]
      const isMentioned = (message.mentions || []).includes(currentUserId)

      let botMeta: { botName?: string; botAvatar?: string; isBot?: boolean } | null = null
      try {
        const parsed = JSON.parse(decrypted[message.id] || '')
        if (parsed && (parsed.isBot || parsed.botMeta || parsed.embeds || parsed.components)) {
          botMeta = {
            isBot: true,
            botName: parsed.botMeta?.botName || parsed.botName || 'Niko',
            botAvatar: parsed.botMeta?.botAvatar || parsed.botAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=NikoSpace&backgroundColor=5865f2'
          }
        }
      } catch {}

      return <article id={`space-message-${message.id}`} key={message.id} onContextMenu={event => {
        if (!sender || !onQuickProfile) return
        event.preventDefault()
        onQuickProfile(sender, event)
      }} className={`group relative flex gap-3 rounded-lg border-l-[3px] px-2 ${groupedWithPrevious ? 'py-0.5' : index > 0 ? 'mt-4 py-2' : 'py-2'} transition-colors ${isMentioned ? 'border-amber-400 bg-amber-400/10 hover:bg-amber-400/15' : 'border-transparent hover:bg-[var(--app-surface)]/50'}`}>
      <div className="w-9 shrink-0">
        {!groupedWithPrevious && (
          botMeta ? (
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#5865F2] ring-2 ring-[#5865F2]/20 shadow">
              <img src={botMeta.botAvatar} alt={botMeta.botName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <button type="button" aria-label={`Open ${message.senderName}'s full profile`} onClick={() => sender && onViewProfile?.(sender)} disabled={!sender || !onViewProfile} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--app-accent)] text-sm font-bold text-white disabled:cursor-default">
              {sender?.avatar ? <img src={sender.avatar} alt="" className="h-full w-full object-cover" /> : message.senderName?.[0]?.toUpperCase()}
            </button>
          )
        )}
      </div>
      <div className="min-w-0 flex-1">
        {message.replyTo && (() => {
          const repliedMessage = messages.find(item => item.id === message.replyTo)
          return repliedMessage ? <button onClick={() => document.getElementById(`space-message-${repliedMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mb-1 flex max-w-full items-center gap-1.5 truncate rounded-md border-l-2 border-[var(--app-accent)]/50 px-2 py-1 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--app-surface)]"><CornerUpLeft size={12} className="shrink-0" /><span className="shrink-0 font-semibold">{repliedMessage.senderName}</span><span className="truncate">{truncateReplyPreview(getMessagePreview(decrypted[repliedMessage.id] || ''))}</span></button> : null
        })()}
        {!groupedWithPrevious && (
          <div className="flex items-baseline gap-2">
            {botMeta ? (
              <span className="inline-flex items-center gap-1.5 text-left text-sm font-bold text-[var(--text-primary)]">
                {botMeta.botName}
                <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">BOT</span>
              </span>
            ) : (
              <button type="button" onClick={event => sender && onQuickProfile?.(sender, event)} disabled={!sender || !onQuickProfile} className="inline-flex items-center gap-1 text-left text-sm font-semibold disabled:cursor-default" style={{ color: memberNameColor(message.senderId) }}><RoleIcon icon={topRole?.icon} />{message.senderName}</button>
            )}
            <time className="text-[10px] text-[var(--text-secondary)]">{new Date(message.timestamp).toLocaleString()}</time>
          </div>
        )}
        <MessageContent content={decrypted[message.id] || 'Decrypting…'} emojis={emojis} members={members} roles={roles} spaceId={spaceId} channelId={channelId} />
        {threads.filter(thread => thread.starterMessageId === message.id).map(thread => <button key={thread.id} onClick={() => onSelectThread?.(thread)} className="mt-2 mr-2 inline-flex items-center gap-1 rounded-md bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]"><MessageSquare size={12} />{getThreadTitle(thread.title)}</button>)}
      </div>
      {(onReply || onStartThread || canDelete?.(message) || onCopy) && <div className="absolute right-3 top-0 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-lg">
          {onReply && <button aria-label="Reply to message" title="Reply" onClick={() => onReply(message)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent)]"><CornerUpLeft size={15} /></button>}
          <button aria-label="More message actions" title="More" aria-expanded={menuMessageId === message.id} onClick={() => setMenuMessageId(current => current === message.id ? '' : message.id)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"><MoreHorizontal size={16} /></button>
        </div>
        {menuMessageId === message.id && <div className="absolute right-0 top-full mt-1 min-w-44 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-xl">
          {onCopy && <button onClick={() => { onCopy(message); setMenuMessageId('') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-[var(--app-surface-hover)]"><Copy size={14} />Copy message text</button>}
          {onStartThread && <button onClick={() => { onStartThread(message); setMenuMessageId('') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-[var(--app-surface-hover)]"><MessageSquare size={14} />Start a thread</button>}
          {canDelete?.(message) && onDelete && <button onClick={() => { onDelete(message); setMenuMessageId('') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"><Trash2 size={14} />Delete message</button>}
        </div>}
      </div>}
    </article>
    })}
  </div>
}

function formatAuditAction(action: string) {
  const map: Record<string, string> = {
    'member.roles.updated': 'Updated Member Roles for',
    'member.timeout.updated': 'Updated Timeout for',
    'member.nickname.changed': 'Changed Nickname for',
    'member.nickname.moderated': 'Moderated Nickname for',
    'member.kicked': 'Kicked Member',
    'member.banned': 'Banned Member',
    'member.unbanned': 'Unbanned Member',
    'role.created': 'Created Role',
    'role.updated': 'Updated Role',
    'role.deleted': 'Deleted Role',
    'channel.created': 'Created Channel',
    'channel.updated': 'Updated Channel',
    'channel.deleted': 'Deleted Channel',
    'category.created': 'Created Category',
    'category.updated': 'Updated Category',
    'category.deleted': 'Deleted Category',
    'history.keys.shared': 'Shared Message Decryption Keys with',
    'space.updated': 'Updated Space Settings',
    'invite.created': 'Created Invite Link',
    'invite.revoked': 'Revoked Invite Link'
  };
  return map[action] || action.replace(/[._]/g, ' ');
}

function AuditLogDetails({ details, action, space }: { details: Record<string, unknown>; action: string; space: SpaceData }) {
  if (!details || Object.keys(details).length === 0) return null;

  if (action === 'member.roles.updated') {
    const added = Array.isArray(details.added) ? (details.added as string[]) : [];
    const removed = Array.isArray(details.removed) ? (details.removed as string[]) : [];
    const tempHours = details.temporaryRoleHours;

    if (added.length === 0 && removed.length === 0) {
      return (
        <div className="text-xs text-[var(--text-secondary)] pl-8">
          No role changes applied.
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5 pl-8 pt-0.5">
        {added.map(roleId => {
          const role = space.roles.find(r => r.id === roleId);
          return (
            <span
              key={`add-${roleId}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            >
              + @{role?.name || roleId}
            </span>
          );
        })}
        {removed.map(roleId => {
          const role = space.roles.find(r => r.id === roleId);
          return (
            <span
              key={`rem-${roleId}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 line-through opacity-85"
            >
              - @{role?.name || roleId}
            </span>
          );
        })}
        {Boolean(tempHours) && (
          <span className="text-[11px] text-[var(--text-secondary)] italic">
            ({String(tempHours)} hour temporary duration)
          </span>
        )}
      </div>
    );
  }

  if (action === 'member.timeout.updated') {
    return (
      <div className="text-xs text-amber-300 pl-8">
        {details.mutedUntil
          ? `Muted until: ${new Date(String(details.mutedUntil)).toLocaleString()}`
          : 'Timeout cleared / Member unmuted'}
      </div>
    );
  }

  if (action.includes('nickname')) {
    return (
      <div className="text-xs text-[var(--text-secondary)] pl-8">
        Nickname: <span className="font-semibold text-white">{String(details.nickname || '(Reset to default)')}</span>
      </div>
    );
  }

  if (action === 'history.keys.shared') {
    return (
      <div className="text-xs text-indigo-300 pl-8">
        Shared encryption keys for {String(details.messageCount || 0)} messages
      </div>
    );
  }

  const validEntries = Object.entries(details).filter(([k, v]) => v !== undefined && v !== null && k !== 'added' && k !== 'removed');
  if (validEntries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
      {validEntries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-[var(--text-secondary)]">
          <span className="font-medium text-white/70">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </span>
      ))}
    </div>
  );
}

function MessageGifCard({ url, alt = 'GIF' }: { url: string; alt?: string }) {
  const [favoriteGifs, setFavoriteGifs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('favorite-gifs') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setFavoriteGifs(e.detail);
        return;
      }
      try {
        setFavoriteGifs(JSON.parse(localStorage.getItem('favorite-gifs') || '[]'));
      } catch {}
    };
    window.addEventListener('favorite-gifs-updated', handleUpdate);
    return () => window.removeEventListener('favorite-gifs-updated', handleUpdate);
  }, []);

  const isFavorited = favoriteGifs.includes(url);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = isFavorited
      ? favoriteGifs.filter(u => u !== url)
      : [url, ...favoriteGifs.filter(u => u !== url)];
    setFavoriteGifs(updated);
    localStorage.setItem('favorite-gifs', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('favorite-gifs-updated', { detail: updated }));

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE}/api/auth/favorite-gifs`, {
          method: isFavorited ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url })
        });
      }
    } catch {}
  };

  return (
    <div className="relative group/gif mt-1 inline-block max-w-sm rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-md">
      <img src={url} alt={alt} className="max-h-64 rounded-xl object-contain" loading="lazy" />
      <button
        type="button"
        onClick={toggleFavorite}
        title={isFavorited ? 'Remove from favorite GIFs' : 'Save to favorite GIFs'}
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-lg backdrop-blur-md ${
          isFavorited
            ? 'bg-yellow-400 text-black scale-100 opacity-100 ring-2 ring-yellow-400/50'
            : 'bg-black/60 text-white opacity-0 group-hover/gif:opacity-100 hover:bg-black/80 hover:scale-110'
        }`}
      >
        {isFavorited ? '★' : '☆'}
      </button>
    </div>
  );
}

function MessageContent({
  content,
  emojis,
  members = [],
  roles = [],
  spaceId,
  channelId
}: {
  content: string
  emojis: SpaceData['emojis']
  members?: SpaceMember[]
  roles?: SpaceRole[]
  spaceId: string
  channelId?: string
}) {
  let payload: { text?: string; mediaType?: string; mediaUrl?: string; embeds?: any[]; components?: any[] }
  try {
    payload = JSON.parse(content)
  } catch {
    return <p className="whitespace-pre-wrap break-words text-sm">{renderMessageText(content, emojis, members, roles, spaceId)}</p>
  }
  if (payload.mediaType === 'sticker' && payload.mediaUrl) {
    return <img src={payload.mediaUrl} alt={payload.text || 'Sticker'} title={payload.text || 'Sticker'} className="mt-1 max-h-48 max-w-48 object-contain" />
  }

  const isGif = payload.mediaType === 'gif' || (payload.mediaUrl && /\.(gif|webp)($|\?)/i.test(payload.mediaUrl));
  if (isGif && payload.mediaUrl) {
    return (
      <div className="space-y-1">
        {payload.text && <p className="whitespace-pre-wrap break-words text-sm">{renderMessageText(payload.text, emojis, members, roles, spaceId)}</p>}
        <MessageGifCard url={payload.mediaUrl} alt={payload.text || 'GIF'} />
      </div>
    );
  }

  const hasEmbeds = Array.isArray(payload.embeds) && payload.embeds.length > 0
  const hasComponents = Array.isArray(payload.components) && payload.components.length > 0

  return (
    <div className="space-y-2">
      {payload.text && (
        <p className="whitespace-pre-wrap break-words text-sm">{renderMessageText(payload.text, emojis, members, roles, spaceId)}</p>
      )}
      {hasEmbeds && (
        <div className="space-y-2">
          {payload.embeds!.map((embed: any, idx: number) => (
            <NikoEmbedCard key={embed.id || idx} embed={embed} spaceId={spaceId} channelId={channelId} />
          ))}
        </div>
      )}
      {hasComponents && (
        <div className="pt-1">
          <NikoActionRows rows={payload.components!} spaceId={spaceId} channelId={channelId} />
        </div>
      )}
    </div>
  )
}

function renderMessageText(text: string, emojis: SpaceData['emojis'], members: SpaceMember[], roles: SpaceRole[], spaceId: string) {
  const roleTokens = roles.map(role => `@${role.name}`).sort((a, b) => b.length - a.length)
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rolePattern = roleTokens.map(escapeRegex).join('|')
  const tokenPattern = `(:sp[a-fA-F0-9]{24}_[A-Za-z0-9_]{1,32}:|:[A-Za-z0-9_]{1,32}:|@everyone\\b|@here\\b|${rolePattern ? `${rolePattern}|` : ''}@[\\w.-]+)`
  const parts = text.split(new RegExp(`(${tokenPattern})`, 'gi'))
  return parts.map((part, index) => {
    const qualifiedEmoji = /^:sp([a-fA-F0-9]{24})_([A-Za-z0-9_]{1,32}):$/.exec(part)
    const name = qualifiedEmoji?.[1].toLowerCase() === spaceId.toLowerCase() ? qualifiedEmoji[2] : qualifiedEmoji ? undefined : /^:([A-Za-z0-9_]{1,32}):$/.exec(part)?.[1]
    const emoji = name && emojis.find(item => item.name.toLowerCase() === name.toLowerCase())
    if (emoji) return <img key={`${emoji.id}-${index}`} src={emoji.url} alt={`:${emoji.name}:`} title={`:${emoji.name}:`} className="inline-block h-6 w-6 align-middle" />
    if (part.toLowerCase() === '@everyone' || part.toLowerCase() === '@here') return <span key={index} className="rounded bg-[var(--app-accent)]/15 px-1 font-semibold text-[var(--app-accent)]">{part}</span>
    const mentionedRole = roles.find(role => `@${role.name}`.toLowerCase() === part.toLowerCase())
    if (mentionedRole) return <span key={index} title={`@${mentionedRole.name}`} className="rounded bg-[var(--app-accent)]/15 px-1 font-semibold" style={{ color: mentionedRole.color }}>{part}</span>
    const mentionName = /^@([\w.-]+)$/.exec(part)?.[1]
    const mentionedMember = mentionName && members.find(item => item.username.toLowerCase() === mentionName.toLowerCase())
    return mentionedMember
      ? <span key={index} title={mentionedMember.username} className="rounded bg-[var(--app-accent)]/15 px-1 font-semibold text-[var(--app-accent)]">@{mentionedMember.nickname || mentionedMember.displayName || mentionedMember.username}</span>
      : <span key={index}>{part}</span>
  })
}

function PermissionOverwriteEditor({
  roles,
  members,
  overwrites,
  onChange
}: {
  roles: SpaceRole[]
  members: SpaceMember[]
  overwrites: SpacePermissionOverwrite[]
  onChange: (targetId: string, permission: keyof typeof PERMISSION_BITS, state: 'inherit' | 'allow' | 'deny') => void
}) {
  const targets = [
    ...roles.map(role => ({ id: role.id, name: role.name, key: `role-${role.id}` })),
    ...members.map(member => ({ id: member.userId, name: member.displayName || member.username, key: `member-${member.userId}` }))
  ]

  return <div className="mt-2 space-y-2">
    {targets.map(target => {
      const overwrite = overwrites.find(item => item.roleId === target.id)
      return <details key={target.key} className="rounded-lg border border-[var(--app-border)] p-2">
        <summary className="cursor-pointer text-xs">{target.name}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PERMISSIONS.map(([permission, label]) => {
            const bit = PERMISSION_BITS[permission]
            const value = ((overwrite?.allow || 0) & bit) ? 'allow' : ((overwrite?.deny || 0) & bit) ? 'deny' : 'inherit'
            return <label key={permission} className="flex items-center justify-between gap-2 text-xs">
              <span>{label}</span>
              <select
                value={value}
                onChange={event => onChange(target.id, permission, event.target.value as 'inherit' | 'allow' | 'deny')}
                className="rounded border border-[var(--app-border)] bg-[var(--app-panel)] px-1 py-1"
              >
                <option value="inherit">Default</option>
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
            </label>
          })}
        </div>
      </details>
    })}
  </div>
}

function RoleIcon({ icon }: { icon?: string }) {
  if (!icon) return null
  if (icon.startsWith('/uploads/spaces/') || /^https?:\/\//i.test(icon)) {
    return <img src={icon} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 rounded-sm object-contain" />
  }
  return <span aria-hidden="true" className="shrink-0">{icon}</span>
}

function RoleEditor({ spaceId, role, onSave, onError }: { spaceId: string; role: SpaceRole; onSave: () => Promise<void>; onError: (message: string) => void }) {
  const [name, setName] = useState(role.name)
  const [permissions, setPermissions] = useState(role.permissions)
  const [color, setColor] = useState(role.color)
  const uploadedRoleIcon = (value: string) => value.startsWith('/uploads/spaces/') || /^https?:\/\//i.test(value)
  const [icon, setIcon] = useState(uploadedRoleIcon(role.icon || '') ? '' : role.icon || '')
  const [iconUploading, setIconUploading] = useState(false)
  const [hoist, setHoist] = useState(Boolean(role.hoist))
  const [mentionable, setMentionable] = useState(Boolean(role.mentionable))

  useEffect(() => {
    setName(role.name)
    setPermissions(role.permissions)
    setColor(role.color)
    setIcon(uploadedRoleIcon(role.icon || '') ? '' : role.icon || '')
    setHoist(Boolean(role.hoist))
    setMentionable(Boolean(role.mentionable))
  }, [role])

  const save = async (iconOverride?: string) => {
    try {
      const updates = role.id === 'everyone'
        ? { color, permissions }
        : { name, color, ...((iconOverride !== undefined || !uploadedRoleIcon(role.icon || '') || icon) ? { icon: iconOverride ?? icon } : {}), permissions, hoist, mentionable }
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/roles/${role.id}`, { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update role.')
      await onSave()
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not update role.') }
  }
  const uploadRoleIcon = async (file: File | undefined) => {
    if (!file) return
    setIconUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/roles/${role.id}/icon`, { method: 'POST', headers: authHeaders(), body: formData })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not upload this role icon.')
      await onSave()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not upload this role icon.')
    } finally {
      setIconUploading(false)
    }
  }
  const activePermissions = PERMISSIONS.filter(([key]) => can(permissions, key)).length
  return <details className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
      <RoleIcon icon={role.icon} />
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: role.color }}>{role.name}</span>
      {role.id === 'everyone' && <span className="rounded-full bg-[var(--app-surface)] px-2 py-1 text-[9px] uppercase tracking-wide text-[var(--text-secondary)]">Default</span>}
      <span className="text-[10px] text-[var(--text-secondary)]">{activePermissions} permissions</span>
      <span className="text-xs text-[var(--text-secondary)]">⌄</span>
    </summary>
    <div className="space-y-3 border-t border-[var(--app-border)] p-3">
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={event => setName(event.target.value)} disabled={role.id === 'everyone'} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm disabled:opacity-50" />
        {role.id !== 'everyone' && <><input value={icon} onChange={event => setIcon(event.target.value)} placeholder="Icon emoji" aria-label={`${role.name} icon emoji`} maxLength={32} className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm" /><label className="role-icon-upload flex cursor-pointer items-center rounded-lg px-3 py-2 text-xs font-semibold">{iconUploading ? 'Uploading...' : 'Upload icon'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={iconUploading} aria-label={`Upload icon for ${role.name}`} onChange={event => { void uploadRoleIcon(event.target.files?.[0]); event.currentTarget.value = '' }} className="sr-only" /></label>{uploadedRoleIcon(role.icon || '') && <button type="button" onClick={() => void save('')} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--text-secondary)]">Remove icon</button>}</>}
        <label className="flex items-center gap-2 text-xs">Color<input type="color" value={color} onChange={event => setColor(event.target.value)} className="h-9 w-10 rounded border border-[var(--app-border)] bg-transparent" /></label>
      </div>
      {role.id === 'everyone' ? <>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Default member permissions</p>
        <PermissionToggleGrid value={permissions} onChange={setPermissions} excludeAdministrator />
        <button onClick={() => void save()} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs text-white">Save defaults</button>
      </> : <>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { label: 'Show role separately', description: 'Give this role its own place in the member list.', checked: hoist, update: setHoist },
            { label: 'Allow role mentions', description: 'Let members with mention permission tag this role.', checked: mentionable, update: setMentionable }
          ]).map(option => <button key={option.label} type="button" role="switch" aria-checked={option.checked} onClick={() => option.update(!option.checked)} className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left">
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="mt-1 block text-[10px] text-[var(--text-secondary)]">{option.description}</span></span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${option.checked ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border)]'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${option.checked ? 'translate-x-4' : 'translate-x-0.5'}`} /></span>
          </button>)}
        </div>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Permissions</p>
        <PermissionToggleGrid value={permissions} onChange={setPermissions} />
        <button onClick={() => void save()} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs text-white">Save role</button>
        <button onClick={async () => { try { const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/roles/${role.id}`, { method: 'DELETE', headers: authHeaders() }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'Could not delete role.'); await onSave() } catch (error) { onError(error instanceof Error ? error.message : 'Could not delete role.') } }} className="ml-3 text-xs text-red-300">Delete role</button>
      </>}
    </div>
  </details>
}

function MemberRoleEditor({ spaceId, member, roles, manageableRoleIds, canManage, canModerate, canKick, canBan, canManageNicknames, canChangeOwnNickname, onViewProfile, onQuickProfile, onSave, onError }: { spaceId: string; member: SpaceMember; roles: SpaceRole[]; manageableRoleIds: string[]; canManage: boolean; canModerate: boolean; canKick: boolean; canBan: boolean; canManageNicknames: boolean; canChangeOwnNickname: boolean; onViewProfile?: (member: SpaceMember) => void; onQuickProfile?: (member: SpaceMember, event: { clientX: number; clientY: number }) => void; onSave: () => Promise<void>; onError: (message: string) => void }) {
  const [selected, setSelected] = useState(member.roleIds)
  const [nickname, setNickname] = useState(member.nickname || '')
  const [expanded, setExpanded] = useState(false)
  const [moderation, setModeration] = useState<{ messageCount: number; lastMessageAt: string | null; accountCreatedAt: string | null; joinedAt: string; mutedUntil: string | null; roles: Array<{ id: string; name: string; color: string }>; messagesByChannel: Array<{ channelId: string; channelName: string; count: number }> } | null>(null)
  const [loadingModeration, setLoadingModeration] = useState(false)
  const [moderationError, setModerationError] = useState<string | null>(null)
  const [showModeratorView, setShowModeratorView] = useState(false)
  const displayName = member.nickname || member.displayName || member.username
  const highestRole = roles.filter(role => member.roleIds.includes(role.id)).sort((a, b) => b.position - a.position)[0]

  useEffect(() => {
    setSelected(member.roleIds)
    setNickname(member.nickname || '')
  }, [member])

  const save = async () => {
    try {
      const preservedRoleIds = member.roleIds.filter(id => !manageableRoleIds.includes(id))
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/roles`, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ roleIds: [...preservedRoleIds, ...selected.filter(id => manageableRoleIds.includes(id))] }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update member roles.')
      await onSave()
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not update member roles.') }
  }
  const saveNickname = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/nickname`, { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update nickname.')
      await onSave()
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not update nickname.') }
  }
  const moderate = async (action: 'kick' | 'ban') => {
    try {
      const reason = action === 'ban' ? window.prompt('Reason for this ban (optional):', '') : null
      if (action === 'ban' && reason === null) return
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/${action}`, {
        method: 'POST',
        headers: action === 'ban' ? { ...authHeaders(), 'Content-Type': 'application/json' } : authHeaders(),
        ...(action === 'ban' ? { body: JSON.stringify({ reason }) } : {})
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || `Could not ${action} member.`)
      await onSave()
    } catch (error) { onError(error instanceof Error ? error.message : `Could not ${action} member.`) }
  }
  const loadModeration = async () => {
    if (!canModerate && !canManage && !canKick && !canBan) return
    setLoadingModeration(true)
    setModerationError(null)
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/moderation`, { headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load member details.')
      setModeration(data.member)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load member details.'
      setModerationError(message)
      onError(message)
    }
    finally { setLoadingModeration(false) }
  }
  const setTimeoutMinutes = async (durationMinutes: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/spaces/${spaceId}/members/${member.userId}/timeout`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message || 'Could not update member timeout.')
      await loadModeration()
      await onSave()
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not update member timeout.') }
  }
  const openModeration = () => {
    setShowModeratorView(true)
    if (!moderation) void loadModeration()
  }
  return <>
  <article onContextMenu={event => { event.preventDefault(); onQuickProfile?.(member, event) }} className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
    <div className="flex items-center gap-3 p-3">
      <button type="button" onClick={() => onViewProfile?.(member)} aria-label={`Open ${displayName}'s full profile`} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--app-accent)]/15 text-sm font-bold text-[var(--app-accent)]">
        {member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : displayName.slice(0, 1).toUpperCase()}
      </button>
      <button type="button" onClick={event => onQuickProfile?.(member, event)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:bg-[var(--app-surface-hover)]" title={`View ${displayName}'s Space profile`}>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-1 truncate text-sm font-semibold" style={{ color: highestRole?.color }}><RoleIcon icon={highestRole?.icon} />{displayName}</span><span className="block truncate text-xs text-[var(--text-secondary)]">@{member.username} · {highestRole?.name || 'Member'}</span></span>
      </button>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="shrink-0 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface-hover)]">{expanded ? 'Close' : 'Manage'}</button>
    </div>
    {expanded && <div className="space-y-4 border-t border-[var(--app-border)] p-3 sm:p-4">
      {canManageNicknames || canChangeOwnNickname ? <div className="flex gap-2"><input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={32} placeholder="Space nickname" aria-label={`${displayName} Space nickname`} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs" /><button onClick={() => void saveNickname()} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white">Save name</button></div> : null}
      {roles.length > 0 && <section><h4 className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Roles</h4><div className="flex flex-wrap gap-2">
        {roles.map(role => {
          const checked = selected.includes(role.id)
          const canAssign = canManage && manageableRoleIds.includes(role.id)
          return <button key={role.id} type="button" role="switch" aria-checked={checked} disabled={!canAssign} onClick={() => setSelected(previous => checked ? previous.filter(id => id !== role.id) : [...previous, role.id])} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-70 ${checked ? 'bg-[var(--app-accent)]/10' : 'bg-[var(--app-panel)] opacity-70'}`} style={{ color: role.color, borderColor: `${role.color}66` }}>
            <RoleIcon icon={role.icon} /><span className={`h-2 w-2 rounded-full ${checked ? 'ring-2 ring-offset-1 ring-offset-[var(--app-surface)]' : ''}`} style={{ backgroundColor: role.color }} />{role.name}
          </button>
        })}
      </div>{canManage && <button onClick={() => void save()} className="mt-3 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white">Save roles</button>}</section>}
      {(canModerate || canManage || canKick || canBan) && <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
        <div className="flex items-center justify-between gap-2"><div><h4 className="text-xs font-semibold">Moderation view</h4><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Open member activity and account history separately.</p></div><button type="button" onClick={openModeration} className="rounded-md bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90">{loadingModeration ? 'Loading…' : 'Open moderator view'}</button></div>
      </section>}
      {canModerate && <section className="space-y-2 border-t border-[var(--app-border)] pt-3">
        <p className="text-xs font-semibold">Timeout member</p>
        <div className="flex flex-wrap gap-2">
          {[['10 minutes', 10], ['1 hour', 60], ['1 day', 1440], ['1 week', 10080]].map(([label, minutes]) => <button key={label} type="button" onClick={() => void setTimeoutMinutes(Number(minutes))} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs hover:bg-[var(--app-panel)]">{label}</button>)}
          {member.mutedUntil && new Date(member.mutedUntil) > new Date() && <button type="button" onClick={() => void setTimeoutMinutes(0)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-accent)] hover:bg-[var(--app-panel)]">Remove timeout</button>}
        </div>
      </section>}
      <div className="flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">{canKick && <button onClick={() => void moderate('kick')} className="rounded-lg border border-orange-400/30 px-3 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/10">Kick</button>}{canBan && <button onClick={() => void moderate('ban')} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">Ban</button>}</div>
    </div>}
  </article>
  {showModeratorView && <SpaceModeratorViewModal
    displayName={displayName}
    details={moderation}
    loading={loadingModeration}
    error={moderationError}
    onRefresh={() => void loadModeration()}
    onClose={() => setShowModeratorView(false)}
  />}
  </>
}

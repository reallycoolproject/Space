import React, { useState, useMemo, useEffect } from 'react'
import {
  Hash,
  Volume2,
  Megaphone,
  MessageSquare,
  GripVertical,
  Settings,
  Plus,
  Trash2,
  Check,
  X,
  Slash,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Folder,
  Sliders,
  ShieldCheck,
  Users,
  Shield,
  Search,
  Lock,
  Link2,
  Copy,
  Webhook,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
  Radio,
  Eye,
  EyeOff
} from 'lucide-react'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || ''
const authHeaders = () => {
  const token = localStorage.getItem('token') || ''
  return {
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export interface SpacePermissionOverwrite {
  roleId: string
  allow: number
  deny: number
}

export interface SpaceChannel {
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
  inactivityHideDays?: number
  permissionOverwrites: SpacePermissionOverwrite[]
}

export interface ChannelInvite {
  code: string
  channelId?: string
  inviterId: string
  inviterUsername?: string
  uses: number
  maxUses: number
  expiresAt?: string
  createdAt: string
}

export interface ChannelWebhook {
  id: string
  spaceId: string
  channelId: string
  name: string
  avatar?: string
  token: string
  creatorId: string
  createdAt: string
}

export interface SpaceCategory {
  id: string
  name: string
  parentId: string
  position: number
  permissionOverwrites: SpacePermissionOverwrite[]
}

export interface SpaceRole {
  id: string
  name: string
  color: string
  icon?: string
  permissions: number
  position: number
  hoist?: boolean
  mentionable?: boolean
}

export interface SpaceMember {
  userId: string
  username: string
  displayName?: string
  nickname?: string
  avatar?: string
  roleIds?: string[]
}

export const PERMISSIONS = [
  ['VIEW_CHANNEL', 'View channel', 'Members can view this channel and read its messages.'],
  ['SEND_MESSAGES', 'Send messages', 'Post messages in text and announcement channels.'],
  ['READ_MESSAGE_HISTORY', 'Read message history', 'See past messages sent in this channel.'],
  ['ADD_REACTIONS', 'Add reactions', 'React to messages with emoji.'],
  ['ATTACH_FILES', 'Attach files', 'Upload files, images, and audio attachments.'],
  ['EMBED_LINKS', 'Embed links', 'Rich previews are shown for shared links.'],
  ['MENTION_EVERYONE', 'Mention @everyone', 'Notify all members who can view this channel.'],
  ['MANAGE_MESSAGES', 'Manage messages', 'Delete messages from other members or pin messages.'],
  ['CONNECT', 'Connect to voice', 'Join this voice channel.'],
  ['SPEAK', 'Speak in voice', 'Transmit audio in this voice channel.'],
  ['CREATE_PUBLIC_THREADS', 'Create public threads', 'Start discussions from a channel message.'],
  ['CREATE_PRIVATE_THREADS', 'Create private threads', 'Start private invited discussions.'],
  ['SEND_MESSAGES_IN_THREADS', 'Send messages in threads', 'Reply in active thread discussions.'],
  ['MANAGE_THREADS', 'Manage threads', 'Archive, lock, or remove thread discussions.'],
  ['MANAGE_CHANNELS', 'Manage channel', 'Edit this channel’s name, topic, settings, and permissions.']
] as const

export type ChannelPermissionKey = typeof PERMISSIONS[number][0]

export const PERMISSION_BITS: Record<string, number> = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  READ_MESSAGE_HISTORY: 1 << 2,
  ADD_REACTIONS: 1 << 3,
  ATTACH_FILES: 1 << 4,
  EMBED_LINKS: 1 << 5,
  MENTION_EVERYONE: 1 << 6,
  MANAGE_MESSAGES: 1 << 7,
  CONNECT: 1 << 8,
  SPEAK: 1 << 9,
  MANAGE_CHANNELS: 1 << 15,
  CREATE_PUBLIC_THREADS: 1 << 20,
  CREATE_PRIVATE_THREADS: 1 << 21,
  SEND_MESSAGES_IN_THREADS: 1 << 22,
  MANAGE_THREADS: 1 << 23
}

export const SLOWMODE_STEPS = [
  { label: 'Off', seconds: 0 },
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '2h', seconds: 7200 },
  { label: '6h', seconds: 21600 }
]

// -------------------------------------------------------------
// Component: SlowmodeSlider
// -------------------------------------------------------------
export function SlowmodeSlider({
  value,
  onChange
}: {
  value: number
  onChange: (seconds: number) => void
}) {
  const currentIndex = useMemo(() => {
    const idx = SLOWMODE_STEPS.findIndex(s => s.seconds === value)
    if (idx >= 0) return idx
    // find closest
    let closest = 0
    let minDiff = Infinity
    SLOWMODE_STEPS.forEach((step, i) => {
      const diff = Math.abs(step.seconds - value)
      if (diff < minDiff) {
        minDiff = diff
        closest = i
      }
    })
    return closest
  }, [value])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-[var(--text-secondary)]">Slowmode cooldown</span>
        <span className="rounded-md bg-[var(--app-accent)]/15 px-2 py-0.5 font-bold text-[var(--app-accent)]">
          {SLOWMODE_STEPS[currentIndex].label === 'Off' ? 'Disabled' : SLOWMODE_STEPS[currentIndex].label}
        </span>
      </div>
      <div className="relative pt-1">
        <input
          type="range"
          min={0}
          max={SLOWMODE_STEPS.length - 1}
          step={1}
          value={currentIndex}
          onChange={e => {
            const step = SLOWMODE_STEPS[Number(e.target.value)]
            if (step) onChange(step.seconds)
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--app-surface)] accent-[var(--app-accent)] focus:outline-none"
        />
        <div className="mt-2 flex justify-between text-[10px] text-[var(--text-secondary)] font-mono">
          <span>Off</span>
          <span>15s</span>
          <span>1m</span>
          <span>5m</span>
          <span>30m</span>
          <span>6h</span>
        </div>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">
        Members are limited to sending one message and creating one thread per interval, unless they have Manage Messages.
      </p>
    </div>
  )
}

// -------------------------------------------------------------
// Component: ThreeStatePermissionMatrix
// -------------------------------------------------------------
export function ThreeStatePermissionMatrix({
  roles,
  members,
  overwrites,
  onChange,
  onAddRoleOrMember
}: {
  roles: SpaceRole[]
  members: SpaceMember[]
  overwrites: SpacePermissionOverwrite[]
  onChange: (targetId: string, permission: string, state: 'inherit' | 'allow' | 'deny') => void
  onAddRoleOrMember?: (targetId: string) => void
}) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('everyone')
  const [targetSearch, setTargetSearch] = useState('')

  // Build target options: @everyone, existing overwrite targets, then other roles/members
  const everyoneRole = roles.find(r => r.id === 'everyone') || { id: 'everyone', name: '@everyone', color: '#99aab5', permissions: 0, position: 0 }
  
  const configuredTargets = useMemo(() => {
    const list: Array<{ id: string; name: string; color?: string; isRole: boolean; isEveryone?: boolean }> = [
      { id: 'everyone', name: '@everyone', color: everyoneRole.color, isRole: true, isEveryone: true }
    ]
    
    // Add roles with overwrites
    roles.filter(r => r.id !== 'everyone').forEach(role => {
      if (overwrites.some(o => o.roleId === role.id)) {
        list.push({ id: role.id, name: `@${role.name}`, color: role.color, isRole: true })
      }
    })

    // Add members with overwrites
    members.forEach(member => {
      if (overwrites.some(o => o.roleId === member.userId)) {
        list.push({
          id: member.userId,
          name: member.nickname || member.displayName || member.username,
          isRole: false
        })
      }
    })

    return list
  }, [roles, members, overwrites, everyoneRole.color])

  // Available to add
  const availableToAdd = useMemo(() => {
    const configuredIds = new Set(configuredTargets.map(t => t.id))
    const list: Array<{ id: string; name: string; color?: string; isRole: boolean }> = []
    roles.filter(r => !configuredIds.has(r.id)).forEach(role => {
      list.push({ id: role.id, name: `@${role.name}`, color: role.color, isRole: true })
    })
    members.filter(m => !configuredIds.has(m.userId)).slice(0, 15).forEach(member => {
      list.push({
        id: member.userId,
        name: member.nickname || member.displayName || member.username,
        isRole: false
      })
    })
    return list
  }, [configuredTargets, roles, members])

  const selectedTarget = configuredTargets.find(t => t.id === selectedTargetId) || configuredTargets[0]
  const currentOverwrite = overwrites.find(o => o.roleId === selectedTarget?.id)

  return (
    <div className="flex flex-col gap-4 sm:flex-row min-h-[380px]">
      {/* Target Selector Sidebar */}
      <div className="w-full sm:w-48 shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/60 p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Roles / Members
        </div>
        <div className="space-y-0.5 max-h-56 sm:max-h-[320px] overflow-y-auto">
          {configuredTargets.map(target => {
            const isSelected = target.id === selectedTarget?.id
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => setSelectedTargetId(target.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-[var(--app-accent)] text-white font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {target.isRole ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: target.color || 'var(--app-accent)' }}
                  />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)]/20 text-[9px] font-bold">
                    {target.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{target.name}</span>
              </button>
            )
          })}
        </div>

        {availableToAdd.length > 0 && (
          <div className="border-t border-[var(--app-border)] pt-2 mt-2">
            <select
              aria-label="Add role or member"
              value=""
              onChange={e => {
                if (e.target.value) {
                  setSelectedTargetId(e.target.value)
                  onAddRoleOrMember?.(e.target.value)
                }
              }}
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] focus:outline-none"
            >
              <option value="">+ Add role or member</option>
              {availableToAdd.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3-State Permission Matrix Table */}
      <div className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 mb-3">
          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
              Permissions for <span style={{ color: selectedTarget?.color }}>{selectedTarget?.name}</span>
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {selectedTarget?.isEveryone
                ? 'Applies to everyone in this Space unless overridden by another role.'
                : 'Specific permissions for this role/member.'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-semibold">
            <span className="flex items-center gap-1 text-red-400"><X size={11} /> Deny</span>
            <span className="flex items-center gap-1"><Slash size={11} className="rotate-45" /> Inherit</span>
            <span className="flex items-center gap-1 text-emerald-400"><Check size={11} /> Allow</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {PERMISSIONS.map(([key, label, desc]) => {
            const bit = PERMISSION_BITS[key] || 0
            const isAllowed = Boolean((currentOverwrite?.allow || 0) & bit)
            const isDenied = Boolean((currentOverwrite?.deny || 0) & bit)
            const currentState: 'inherit' | 'allow' | 'deny' = isAllowed ? 'allow' : isDenied ? 'deny' : 'inherit'

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-[var(--app-border)] hover:bg-[var(--app-surface)]/40"
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">{label}</span>
                  <span className="block text-[10px] text-[var(--text-secondary)] leading-tight">{desc}</span>
                </div>

                {/* 3-State Matrix Button Group */}
                <div className="flex shrink-0 items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-0.5 shadow-inner">
                  {/* DENY ✖ */}
                  <button
                    type="button"
                    onClick={() => onChange(selectedTarget.id, key, 'deny')}
                    title={`Deny ${label}`}
                    aria-label={`Deny ${label}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                      currentState === 'deny'
                        ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] font-bold'
                        : 'text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10'
                    }`}
                  >
                    <X size={14} />
                  </button>

                  {/* INHERIT / */}
                  <button
                    type="button"
                    onClick={() => onChange(selectedTarget.id, key, 'inherit')}
                    title={`Inherit / Reset ${label}`}
                    aria-label={`Inherit ${label}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                      currentState === 'inherit'
                        ? 'bg-slate-600/80 text-white border border-slate-500/80 shadow-sm font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
                    }`}
                  >
                    <Slash size={12} className="rotate-45" />
                  </button>

                  {/* ALLOW ✔ */}
                  <button
                    type="button"
                    onClick={() => onChange(selectedTarget.id, key, 'allow')}
                    title={`Allow ${label}`}
                    aria-label={`Allow ${label}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                      currentState === 'allow'
                        ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)] font-bold'
                        : 'text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component: PrivateAccessManager
// -------------------------------------------------------------
function PrivateAccessManager({
  roles,
  members,
  overwrites,
  onToggleTarget
}: {
  roles: SpaceRole[]
  members: SpaceMember[]
  overwrites: SpacePermissionOverwrite[]
  onToggleTarget: (targetId: string, allowed: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<'roles' | 'members'>('roles')
  const [search, setSearch] = useState('')

  const activeRoles = roles.filter(r => r.name !== '@everyone' && r.id !== 'everyone')
  const allowedRolesCount = activeRoles.filter(r => {
    const ov = overwrites.find(o => o.roleId === r.id)
    return Boolean(ov && (ov.allow & PERMISSION_BITS.VIEW_CHANNEL))
  }).length

  const allowedMembersCount = members.filter(m => {
    const ov = overwrites.find(o => o.roleId === m.userId)
    return Boolean(ov && (ov.allow & PERMISSION_BITS.VIEW_CHANNEL))
  }).length

  const filteredRoles = activeRoles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredMembers = members.filter(m =>
    (m.nickname || m.displayName || m.username || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="mt-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)]/80 p-4 shadow-sm backdrop-blur-md space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h5 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#5865F2]" /> Who Can Access
          </h5>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Grant channel view permission to specific roles or individual members.
          </p>
        </div>
        <div className="inline-flex self-start sm:self-auto rounded-lg bg-[var(--app-surface)] p-0.5 border border-[var(--app-border)]">
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'roles'
                ? 'bg-[#5865F2] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Roles ({allowedRolesCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'members'
                ? 'bg-[#5865F2] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Members ({allowedMembersCount})
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={activeTab === 'roles' ? 'Filter roles...' : 'Filter members...'}
          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
        />
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {activeTab === 'roles' ? (
          filteredRoles.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-secondary)]">No roles found</div>
          ) : (
            filteredRoles.map(role => {
              const ov = overwrites.find(o => o.roleId === role.id)
              const isAllowed = Boolean(ov && (ov.allow & PERMISSION_BITS.VIEW_CHANNEL))
              return (
                <div
                  key={role.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isAllowed
                      ? 'border-[#5865F2]/40 bg-[#5865F2]/10 shadow-xs'
                      : 'border-transparent bg-[var(--app-surface)]/50 hover:bg-[var(--app-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-xs ring-1 ring-white/20"
                      style={{ backgroundColor: role.color || '#5865F2' }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[var(--text-primary)]">@{role.name}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {members.filter(m => m.roleIds?.includes(role.id)).length} members
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAllowed}
                    onClick={() => onToggleTarget(role.id, !isAllowed)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAllowed ? 'bg-[#5865F2]' : 'bg-[var(--app-border)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isAllowed ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )
        ) : (
          filteredMembers.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-secondary)]">No members found</div>
          ) : (
            filteredMembers.map(member => {
              const ov = overwrites.find(o => o.roleId === member.userId)
              const isAllowed = Boolean(ov && (ov.allow & PERMISSION_BITS.VIEW_CHANNEL))
              const displayName = member.nickname || member.displayName || member.username
              return (
                <div
                  key={member.userId}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isAllowed
                      ? 'border-[#5865F2]/40 bg-[#5865F2]/10 shadow-xs'
                      : 'border-transparent bg-[var(--app-surface)]/50 hover:bg-[var(--app-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-[var(--app-accent)] flex items-center justify-center text-xs font-bold text-white shadow-xs">
                      {member.avatar ? (
                        <img src={member.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        displayName[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[var(--text-primary)]">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        @{member.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAllowed}
                    onClick={() => onToggleTarget(member.userId, !isAllowed)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAllowed ? 'bg-[#5865F2]' : 'bg-[var(--app-border)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isAllowed ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component: ChannelEditModal
// -------------------------------------------------------------
export function ChannelEditModal({
  channel,
  categories,
  roles,
  members,
  spaceId,
  onSave,
  onSyncPermissions,
  onDelete,
  onClose
}: {
  channel: SpaceChannel
  categories: SpaceCategory[]
  roles: SpaceRole[]
  members: SpaceMember[]
  spaceId?: string
  onSave: (updates: Partial<SpaceChannel>) => Promise<void>
  onSyncPermissions: () => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'permissions' | 'invites' | 'integrations' | 'delete'>('overview')
  const [name, setName] = useState(channel.name)
  const [topic, setTopic] = useState(channel.topic || '')
  const [categoryId, setCategoryId] = useState(channel.categoryId || '')
  const [slowmode, setSlowmode] = useState(channel.slowmodeSeconds || 0)
  const [nsfw, setNsfw] = useState(Boolean(channel.nsfw))
  const [inactivityHideDays, setInactivityHideDays] = useState(channel.inactivityHideDays ?? 0)
  const [bitrate, setBitrate] = useState(channel.bitrate || 64000)
  const [userLimit, setUserLimit] = useState(channel.userLimit || 0)
  const [forumTags, setForumTags] = useState((channel.forumTags || []).join(', '))
  const [permissionOverwrites, setPermissionOverwrites] = useState<SpacePermissionOverwrite[]>(
    channel.permissionOverwrites ? JSON.parse(JSON.stringify(channel.permissionOverwrites)) : []
  )
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')

  // Invites tab state
  const [invites, setInvites] = useState<ChannelInvite[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteMaxUses, setInviteMaxUses] = useState(0)
  const [inviteExpiresHours, setInviteExpiresHours] = useState(24)
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null)

  // Integrations tab state
  const [webhooks, setWebhooks] = useState<ChannelWebhook[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)
  const [creatingWebhook, setCreatingWebhook] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null)
  const [testWebhookStatus, setTestWebhookStatus] = useState<Record<string, string>>({})

  const isVoice = channel.type === 'voice'
  const parentCategory = categories.find(c => c.id === categoryId)

  // Check if channel permissions are synced with parent category
  const isSyncedWithCategory = useMemo(() => {
    if (!parentCategory) return true
    return JSON.stringify(permissionOverwrites || []) === JSON.stringify(parentCategory.permissionOverwrites || [])
  }, [parentCategory, permissionOverwrites])

  // Private channel state: @everyone has VIEW_CHANNEL denied
  const everyoneRole = roles.find(r => r.name === '@everyone' || r.id === 'everyone')
  const everyoneId = everyoneRole?.id || 'everyone'
  const isPrivate = useMemo(() => {
    const ov = permissionOverwrites.find(o => o.roleId === everyoneId)
    return Boolean(ov && (ov.deny & PERMISSION_BITS.VIEW_CHANNEL))
  }, [permissionOverwrites, everyoneId])

  const togglePrivateChannel = (nextPrivate: boolean) => {
    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let ov = copy.find(o => o.roleId === everyoneId)
      if (nextPrivate) {
        if (!ov) {
          copy.push({ roleId: everyoneId, allow: 0, deny: PERMISSION_BITS.VIEW_CHANNEL })
        } else {
          ov.deny |= PERMISSION_BITS.VIEW_CHANNEL
          ov.allow &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      } else {
        if (ov) {
          ov.deny &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      }
      return copy
    })
  }

  const toggleTargetAccess = (targetId: string, allowed: boolean) => {
    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let ov = copy.find(o => o.roleId === targetId)
      if (allowed) {
        if (!ov) {
          copy.push({ roleId: targetId, allow: PERMISSION_BITS.VIEW_CHANNEL, deny: 0 })
        } else {
          ov.allow |= PERMISSION_BITS.VIEW_CHANNEL
          ov.deny &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      } else {
        if (ov) {
          ov.allow &= ~PERMISSION_BITS.VIEW_CHANNEL
          ov.deny |= PERMISSION_BITS.VIEW_CHANNEL
        } else {
          copy.push({ roleId: targetId, allow: 0, deny: PERMISSION_BITS.VIEW_CHANNEL })
        }
      }
      return copy
    })
  }

  // Load invites when invites tab is opened
  useEffect(() => {
    if (tab === 'invites' && spaceId) {
      setLoadingInvites(true)
      fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${channel.id}/invites`, {
        headers: authHeaders()
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok && Array.isArray(data.invites)) setInvites(data.invites)
        })
        .catch(err => console.error('Failed to load invites', err))
        .finally(() => setLoadingInvites(false))
    }
  }, [tab, spaceId, channel.id])

  // Load webhooks when integrations tab is opened
  useEffect(() => {
    if (tab === 'integrations' && spaceId) {
      setLoadingWebhooks(true)
      fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${channel.id}/webhooks`, {
        headers: authHeaders()
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok && Array.isArray(data.webhooks)) setWebhooks(data.webhooks)
        })
        .catch(err => console.error('Failed to load webhooks', err))
        .finally(() => setLoadingWebhooks(false))
    }
  }, [tab, spaceId, channel.id])

  const handleCreateInvite = async () => {
    if (!spaceId) return
    setCreatingInvite(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${channel.id}/invites`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          maxUses: inviteMaxUses,
          expiresInHours: inviteExpiresHours === 0 ? undefined : inviteExpiresHours
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Could not create invite.')
      setInvites(prev => [data.invite, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite.')
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleDeleteInvite = async (code: string) => {
    if (!spaceId) return
    try {
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${channel.id}/invites/${code}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (data.ok) {
        setInvites(prev => prev.filter(inv => inv.code !== code))
      }
    } catch (err) {
      console.error('Failed to delete invite', err)
    }
  }

  const handleCreateWebhook = async () => {
    if (!spaceId) return
    setCreatingWebhook(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/channels/${channel.id}/webhooks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: newWebhookName.trim() || `${channel.name}-bot`
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Could not create webhook.')
      setWebhooks(prev => [data.webhook, ...prev])
      setNewWebhookName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create webhook.')
    } finally {
      setCreatingWebhook(false)
    }
  }

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!spaceId) return
    try {
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (data.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== webhookId))
      }
    } catch (err) {
      console.error('Failed to delete webhook', err)
    }
  }

  const handleTestWebhook = async (w: ChannelWebhook) => {
    setTestWebhookStatus(prev => ({ ...prev, [w.id]: 'sending' }))
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/${w.id}/${w.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚀 Webhook **${w.name}** test executed successfully!`
        })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestWebhookStatus(prev => ({ ...prev, [w.id]: 'success' }))
      } else {
        setTestWebhookStatus(prev => ({ ...prev, [w.id]: 'failed' }))
      }
    } catch {
      setTestWebhookStatus(prev => ({ ...prev, [w.id]: 'failed' }))
    }
    setTimeout(() => {
      setTestWebhookStatus(prev => {
        const next = { ...prev }
        delete next[w.id]
        return next
      })
    }, 4000)
  }

  const hasUnsavedChanges = useMemo(() => {
    if (name !== channel.name) return true
    if (topic !== (channel.topic || '')) return true
    if (categoryId !== (channel.categoryId || '')) return true
    if (slowmode !== (channel.slowmodeSeconds || 0)) return true
    if (nsfw !== Boolean(channel.nsfw)) return true
    if (inactivityHideDays !== (channel.inactivityHideDays ?? 0)) return true
    if (isVoice && bitrate !== (channel.bitrate || 64000)) return true
    if (isVoice && userLimit !== (channel.userLimit || 0)) return true
    if (channel.type === 'forum' && forumTags !== (channel.forumTags || []).join(', ')) return true
    if (JSON.stringify(permissionOverwrites) !== JSON.stringify(channel.permissionOverwrites || [])) return true
    return false
  }, [name, topic, categoryId, slowmode, nsfw, inactivityHideDays, bitrate, userLimit, forumTags, permissionOverwrites, channel, isVoice])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const parsedTags = channel.type === 'forum' ? forumTags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      await onSave({
        name: isVoice ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: topic.slice(0, 1024),
        categoryId,
        slowmodeSeconds: slowmode,
        nsfw,
        inactivityHideDays,
        ...(isVoice ? { bitrate, userLimit } : {}),
        ...(channel.type === 'forum' ? { forumTags: parsedTags } : {}),
        permissionOverwrites
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save channel changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncPermissions = async () => {
    setSyncing(true)
    setError('')
    try {
      await onSyncPermissions()
      if (parentCategory) {
        setPermissionOverwrites(JSON.parse(JSON.stringify(parentCategory.permissionOverwrites || [])))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync permissions.')
    } finally {
      setSyncing(false)
    }
  }

  const handlePermissionChange = (targetId: string, permission: string, state: 'inherit' | 'allow' | 'deny') => {
    const bit = PERMISSION_BITS[permission] || 0
    if (!bit) return

    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let existingIndex = copy.findIndex(item => item.roleId === targetId)
      let overwrite = existingIndex >= 0 ? { ...copy[existingIndex] } : { roleId: targetId, allow: 0, deny: 0 }

      if (state === 'allow') {
        overwrite.allow |= bit
        overwrite.deny &= ~bit
      } else if (state === 'deny') {
        overwrite.deny |= bit
        overwrite.allow &= ~bit
      } else {
        // inherit
        overwrite.allow &= ~bit
        overwrite.deny &= ~bit
      }

      if (existingIndex >= 0) {
        if (overwrite.allow === 0 && overwrite.deny === 0) {
          copy.splice(existingIndex, 1)
        } else {
          copy[existingIndex] = overwrite
        }
      } else if (overwrite.allow !== 0 || overwrite.deny !== 0) {
        copy.push(overwrite)
      }
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-2 sm:p-6 backdrop-blur-md">
      <div
        className="relative flex h-[min(90vh,760px)] max-h-[90vh] w-full max-w-4xl flex-col sm:flex-row overflow-hidden rounded-2xl border border-white/20 bg-[var(--app-panel)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Left Sidebar */}
        <div className="flex w-full sm:w-56 shrink-0 flex-row sm:flex-col justify-between border-b sm:border-b-0 sm:border-r border-[var(--app-border)] bg-[var(--app-surface)]/70 p-3 sm:p-5">
          <div className="space-y-1 w-full">
            <div className="mb-4 hidden sm:block px-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
                Channel Settings
              </span>
              <h3 className="flex items-center gap-1.5 truncate text-base font-bold text-[var(--text-primary)]">
                {isVoice ? <Volume2 size={16} /> : channel.type === 'announcement' ? <Megaphone size={16} /> : channel.type === 'forum' ? <MessageSquare size={16} /> : <Hash size={16} />}
                {name || channel.name}
              </h3>
            </div>

            <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'overview'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sliders size={15} />
                Overview
              </button>

              <button
                type="button"
                onClick={() => setTab('permissions')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'permissions'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <ShieldCheck size={15} />
                Permissions
              </button>

              <button
                type="button"
                onClick={() => setTab('invites')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'invites'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Link2 size={15} />
                Invites
              </button>

              <button
                type="button"
                onClick={() => setTab('integrations')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'integrations'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Webhook size={15} />
                Integrations
              </button>

              <div className="my-2 hidden sm:block border-t border-[var(--app-border)]/60" />

              <button
                type="button"
                onClick={() => setTab('delete')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'delete'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                }`}
              >
                <Trash2 size={15} />
                Delete Channel
              </button>
            </nav>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={14} /> Close (ESC)
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {tab === 'overview'
                  ? 'Channel Overview'
                  : tab === 'permissions'
                  ? 'Channel Permissions'
                  : tab === 'invites'
                  ? 'Channel Invites'
                  : tab === 'integrations'
                  ? 'Channel Integrations'
                  : 'Delete Channel'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {tab === 'overview'
                  ? 'Configure general properties, topic, slowmode, and inactivity visibility.'
                  : tab === 'permissions'
                  ? 'Manage private access, role overwrites, and category sync.'
                  : tab === 'invites'
                  ? 'Manage invites that direct members straight to this channel.'
                  : tab === 'integrations'
                  ? 'Create Discord-style webhooks to post messages into this channel.'
                  : 'Permanently remove this channel from the Space.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Body Tabs */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            {tab === 'overview' && (
              <div className="max-w-2xl space-y-5">
                {/* Channel Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Channel Name
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[var(--text-secondary)]">
                      {isVoice ? <Volume2 size={16} /> : channel.type === 'announcement' ? <Megaphone size={16} /> : <Hash size={16} />}
                    </span>
                    <input
                      type="text"
                      value={name}
                      maxLength={100}
                      onChange={e => {
                        const val = isVoice ? e.target.value : e.target.value.toLowerCase().replace(/\s+/g, '-')
                        setName(val)
                      }}
                      placeholder="new-channel"
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-9 pr-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                    />
                  </div>
                  {!isVoice && (
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Spaces are automatically converted to hyphens and lowercase.
                    </p>
                  )}
                </div>

                {/* Channel Topic (Non-voice) */}
                {!isVoice && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        Channel Topic
                      </label>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                        {topic.length}/1024
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={topic}
                      maxLength={1024}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="Let everyone know what this channel is for!"
                      className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                    />
                  </div>
                )}

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Parent Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    <option value="">(Uncategorized / Root)</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice-specific sliders: Bitrate & User Limit */}
                {isVoice && (
                  <div className="space-y-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                    {/* Bitrate */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[var(--text-secondary)]">Audio Bitrate</span>
                        <span className="font-bold text-[var(--app-accent)]">{Math.round(bitrate / 1000)} kbps</span>
                      </div>
                      <input
                        type="range"
                        min={8000}
                        max={128000}
                        step={8000}
                        value={bitrate}
                        onChange={e => setBitrate(Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--app-panel)] accent-[var(--app-accent)] focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-mono">
                        <span>8 kbps</span>
                        <span>64 kbps (Standard)</span>
                        <span>96 kbps</span>
                        <span>128 kbps</span>
                      </div>
                    </div>

                    {/* User Limit */}
                    <div className="space-y-2 pt-2 border-t border-[var(--app-border)]/50">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[var(--text-secondary)]">User Limit</span>
                        <span className="font-bold text-[var(--app-accent)]">
                          {userLimit === 0 ? 'No Limit' : `${userLimit} ${userLimit === 1 ? 'user' : 'users'}`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={99}
                        step={1}
                        value={userLimit}
                        onChange={e => setUserLimit(Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--app-panel)] accent-[var(--app-accent)] focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-mono">
                        <span>No limit</span>
                        <span>25</span>
                        <span>50</span>
                        <span>99 users</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Slowmode (Non-voice) */}
                {!isVoice && (
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                    <SlowmodeSlider value={slowmode} onChange={setSlowmode} />
                  </div>
                )}

                {/* Age-Restricted Switch */}
                <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Age-Restricted Channel (NSFW)
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Users will need to confirm they are 18+ to view the content in this channel.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={nsfw}
                    onClick={() => setNsfw(!nsfw)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      nsfw ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-[var(--app-border)]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        nsfw ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Inactivity Hide Setting */}
                <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Clock size={14} className="text-[var(--app-accent)]" />
                        Hide Channel After Inactivity
                      </span>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        Automatically collapse or hide this channel from members' sidebars when inactive for X days.
                      </p>
                    </div>
                  </div>
                  <select
                    value={inactivityHideDays}
                    onChange={e => setInactivityHideDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    <option value={0}>Never (Always Visible)</option>
                    <option value={1}>1 Day of inactivity</option>
                    <option value={3}>3 Days of inactivity</option>
                    <option value={7}>7 Days of inactivity</option>
                    <option value={14}>14 Days of inactivity</option>
                    <option value={30}>30 Days of inactivity</option>
                  </select>
                </div>

                {/* Forum Tags */}
                {channel.type === 'forum' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Forum Tags
                    </label>
                    <input
                      type="text"
                      value={forumTags}
                      onChange={e => setForumTags(e.target.value)}
                      placeholder="e.g. Help, Showcase, Bug Report, Discussion"
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                    />
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Separate tags with commas. Members can attach these tags to forum posts.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === 'permissions' && (
              <div className="space-y-5">
                {/* Sync status banner */}
                {parentCategory ? (
                  isSyncedWithCategory ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                        <span>
                          Permissions are <strong>synced</strong> with category <strong>{parentCategory.name}</strong>.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="shrink-0 text-amber-400" />
                        <span>
                          Permissions are <strong>unsynced</strong> with category <strong>{parentCategory.name}</strong>.
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={syncing}
                        onClick={handleSyncPermissions}
                        className="rounded-lg bg-amber-500/20 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors disabled:opacity-50"
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-3 text-xs text-[var(--text-secondary)]">
                    This channel is outside of any category. Custom permissions apply directly.
                  </div>
                )}

                {/* Discord-style Private Channel Switch */}
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Lock size={14} className={isPrivate ? 'text-amber-400' : 'text-[var(--text-secondary)]'} />
                        Private Channel
                      </span>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        By making a channel private, only selected roles and members will be able to view this channel.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPrivate}
                      onClick={() => togglePrivateChannel(!isPrivate)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isPrivate ? 'bg-[#5865F2]' : 'bg-[var(--app-border)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isPrivate ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {isPrivate && (
                    <PrivateAccessManager
                      roles={roles}
                      members={members}
                      overwrites={permissionOverwrites}
                      onToggleTarget={toggleTargetAccess}
                    />
                  )}
                </div>

                {/* 3-State Permission Matrix */}
                <ThreeStatePermissionMatrix
                  roles={roles}
                  members={members}
                  overwrites={permissionOverwrites}
                  onChange={handlePermissionChange}
                />
              </div>
            )}

            {tab === 'invites' && (
              <div className="max-w-2xl space-y-6">
                {/* Header & Create Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Link2 size={15} className="text-[var(--app-accent)]" /> Channel-Specific Invites
                    </h4>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Members who join using these links will be directed directly into <strong>#{channel.name}</strong>.
                    </p>
                  </div>
                </div>

                {/* Create Invite Form */}
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/30 p-4 space-y-3">
                  <h5 className="text-xs font-bold text-[var(--text-primary)]">Create an Invite Link</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Max Uses
                      </label>
                      <select
                        value={inviteMaxUses}
                        onChange={e => setInviteMaxUses(Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value={0}>No Limit</option>
                        <option value={1}>1 use</option>
                        <option value={5}>5 uses</option>
                        <option value={10}>10 uses</option>
                        <option value={25}>25 uses</option>
                        <option value={50}>50 uses</option>
                        <option value={100}>100 uses</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Expire After
                      </label>
                      <select
                        value={inviteExpiresHours}
                        onChange={e => setInviteExpiresHours(Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value={1}>1 hour</option>
                        <option value={6}>6 hours</option>
                        <option value={12}>12 hours</option>
                        <option value={24}>1 day</option>
                        <option value={168}>7 days</option>
                        <option value={0}>Never</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={creatingInvite}
                    onClick={handleCreateInvite}
                    className="flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Plus size={14} />
                    {creatingInvite ? 'Generating...' : 'Generate New Link'}
                  </button>
                </div>

                {/* Invites List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Active Invites ({invites.length})
                  </span>

                  {loadingInvites ? (
                    <div className="p-6 text-center text-xs text-[var(--text-secondary)]">Loading invites...</div>
                  ) : invites.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-border)] p-6 text-center text-xs text-[var(--text-secondary)]">
                      No invites created for this channel yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {invites.map(inv => {
                        const fullUrl = `${window.location.origin}/invite/${inv.code}`
                        const isCopied = copiedInviteCode === inv.code
                        return (
                          <div
                            key={inv.code}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/40 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-[var(--app-accent)]">
                                  {inv.code}
                                </span>
                                <span className="rounded bg-[var(--app-panel)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                  {inv.maxUses === 0 ? `${inv.uses} uses (unlimited)` : `${inv.uses} / ${inv.maxUses} uses`}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                                {inv.expiresAt ? `Expires: ${new Date(inv.expiresAt).toLocaleDateString()}` : 'Never expires'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(fullUrl)
                                  setCopiedInviteCode(inv.code)
                                  setTimeout(() => setCopiedInviteCode(null), 2500)
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-[var(--app-panel)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--app-surface-hover)] transition-colors"
                              >
                                {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                {isCopied ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                title="Revoke Invite"
                                onClick={() => handleDeleteInvite(inv.code)}
                                className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'integrations' && (
              <div className="max-w-2xl space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Webhook size={15} className="text-[var(--app-accent)]" /> Webhooks
                    </h4>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Webhooks are an easy way to post automated messages from GitHub, GitLab, bots, and CI/CD directly into #{channel.name}.
                    </p>
                  </div>
                </div>

                {/* Create Webhook Form */}
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/30 p-4 space-y-3">
                  <h5 className="text-xs font-bold text-[var(--text-primary)]">New Webhook</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newWebhookName}
                      onChange={e => setNewWebhookName(e.target.value)}
                      placeholder={`e.g. ${channel.name}-bot`}
                      className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={creatingWebhook}
                      onClick={handleCreateWebhook}
                      className="flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      <Plus size={14} />
                      {creatingWebhook ? 'Creating...' : 'Create Webhook'}
                    </button>
                  </div>
                </div>

                {/* Webhooks List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Configured Webhooks ({webhooks.length})
                  </span>

                  {loadingWebhooks ? (
                    <div className="p-6 text-center text-xs text-[var(--text-secondary)]">Loading webhooks...</div>
                  ) : webhooks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-border)] p-6 text-center text-xs text-[var(--text-secondary)]">
                      No webhooks configured for this channel yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {webhooks.map(w => {
                        const webhookUrl = `${window.location.origin}/api/webhooks/${w.id}/${w.token}`
                        const isCopied = copiedWebhookId === w.id
                        const testStatus = testWebhookStatus[w.id]
                        return (
                          <div
                            key={w.id}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/40 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-accent)]/20 text-[var(--app-accent)] font-bold">
                                  <Webhook size={16} />
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-[var(--text-primary)]">{w.name}</h5>
                                  <span className="text-[10px] text-[var(--text-secondary)]">
                                    Created {new Date(w.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTestWebhook(w)}
                                  disabled={testStatus === 'sending'}
                                  className="flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                  {testStatus === 'sending' ? (
                                    'Testing...'
                                  ) : testStatus === 'success' ? (
                                    <span className="text-emerald-400 font-bold">Sent!</span>
                                  ) : testStatus === 'failed' ? (
                                    <span className="text-red-400 font-bold">Failed</span>
                                  ) : (
                                    'Test Webhook'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Delete Webhook"
                                  onClick={() => handleDeleteWebhook(w.id)}
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Webhook URL Input */}
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                readOnly
                                value={webhookUrl}
                                className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)] select-all focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(webhookUrl)
                                  setCopiedWebhookId(w.id)
                                  setTimeout(() => setCopiedWebhookId(null), 2500)
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 shrink-0 transition-opacity"
                              >
                                {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                {isCopied ? 'Copied' : 'Copy URL'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'delete' && (
              <div className="max-w-lg space-y-4">
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-3">
                  <h4 className="font-bold text-sm text-red-400 flex items-center gap-2">
                    <Trash2 size={16} /> Delete Channel
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Are you sure you want to delete <strong>#{channel.name}</strong>? All messages, threads, and media sent in this channel will be permanently erased.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition-colors"
                  >
                    Delete Channel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Unsaved Changes Bar */}
          {hasUnsavedChanges && (
            <div className="flex items-center justify-between border-t border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-3 shadow-lg">
              <span className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={14} /> Careful — you have unsaved changes!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setName(channel.name)
                    setTopic(channel.topic || '')
                    setCategoryId(channel.categoryId || '')
                    setSlowmode(channel.slowmodeSeconds || 0)
                    setNsfw(Boolean(channel.nsfw))
                    setInactivityHideDays(channel.inactivityHideDays ?? 0)
                    setBitrate(channel.bitrate || 64000)
                    setUserLimit(channel.userLimit || 0)
                    setForumTags((channel.forumTags || []).join(', '))
                    setPermissionOverwrites(channel.permissionOverwrites ? JSON.parse(JSON.stringify(channel.permissionOverwrites)) : [])
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-panel)]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  onClick={handleSave}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-red-400">Delete Channel</h3>
            <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete <strong>#{channel.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--app-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDelete()
                    setShowDeleteConfirm(false)
                    onClose()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not delete channel.')
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Component: CategoryEditModal
// -------------------------------------------------------------
export function CategoryEditModal({
  category,
  roles,
  members,
  spaceId,
  onSave,
  onSyncChannels,
  onDelete,
  onClose
}: {
  category: SpaceCategory
  roles: SpaceRole[]
  members: SpaceMember[]
  spaceId?: string
  onSave: (updates: Partial<SpaceCategory>) => Promise<void>
  onSyncChannels?: () => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'permissions' | 'delete'>('overview')
  const [name, setName] = useState(category.name)
  const [permissionOverwrites, setPermissionOverwrites] = useState<SpacePermissionOverwrite[]>(
    category.permissionOverwrites ? JSON.parse(JSON.stringify(category.permissionOverwrites)) : []
  )
  const [saving, setSaving] = useState(false)
  const [syncingChannels, setSyncingChannels] = useState(false)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')

  // Private Category: @everyone denied VIEW_CHANNEL
  const everyoneRole = roles.find(r => r.name === '@everyone' || r.id === 'everyone')
  const everyoneId = everyoneRole?.id || 'everyone'
  const isPrivate = useMemo(() => {
    const ov = permissionOverwrites.find(o => o.roleId === everyoneId)
    return Boolean(ov && (ov.deny & PERMISSION_BITS.VIEW_CHANNEL))
  }, [permissionOverwrites, everyoneId])

  const togglePrivateCategory = (nextPrivate: boolean) => {
    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let ov = copy.find(o => o.roleId === everyoneId)
      if (nextPrivate) {
        if (!ov) {
          copy.push({ roleId: everyoneId, allow: 0, deny: PERMISSION_BITS.VIEW_CHANNEL })
        } else {
          ov.deny |= PERMISSION_BITS.VIEW_CHANNEL
          ov.allow &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      } else {
        if (ov) {
          ov.deny &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      }
      return copy
    })
  }

  const toggleTargetAccess = (targetId: string, allowed: boolean) => {
    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let ov = copy.find(o => o.roleId === targetId)
      if (allowed) {
        if (!ov) {
          copy.push({ roleId: targetId, allow: PERMISSION_BITS.VIEW_CHANNEL, deny: 0 })
        } else {
          ov.allow |= PERMISSION_BITS.VIEW_CHANNEL
          ov.deny &= ~PERMISSION_BITS.VIEW_CHANNEL
        }
      } else {
        if (ov) {
          ov.allow &= ~PERMISSION_BITS.VIEW_CHANNEL
          ov.deny |= PERMISSION_BITS.VIEW_CHANNEL
        } else {
          copy.push({ roleId: targetId, allow: 0, deny: PERMISSION_BITS.VIEW_CHANNEL })
        }
      }
      return copy
    })
  }

  const handleSyncChannels = async () => {
    setSyncingChannels(true)
    setError('')
    setSyncSuccessMsg('')
    try {
      if (onSyncChannels) {
        await onSyncChannels()
      } else if (spaceId) {
        const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/categories/${category.id}/sync-channels`, {
          method: 'POST',
          headers: authHeaders()
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not sync channels.')
      }
      setSyncSuccessMsg('All channels in this category have been synced successfully!')
      setTimeout(() => setSyncSuccessMsg(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync channels.')
    } finally {
      setSyncingChannels(false)
    }
  }

  const hasUnsavedChanges = useMemo(() => {
    if (name !== category.name) return true
    if (JSON.stringify(permissionOverwrites) !== JSON.stringify(category.permissionOverwrites || [])) return true
    return false
  }, [name, permissionOverwrites, category])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        permissionOverwrites
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category changes.')
    } finally {
      setSaving(false)
    }
  }

  const handlePermissionChange = (targetId: string, permission: string, state: 'inherit' | 'allow' | 'deny') => {
    const bit = PERMISSION_BITS[permission] || 0
    if (!bit) return

    setPermissionOverwrites(prev => {
      const copy = [...prev]
      let existingIndex = copy.findIndex(item => item.roleId === targetId)
      let overwrite = existingIndex >= 0 ? { ...copy[existingIndex] } : { roleId: targetId, allow: 0, deny: 0 }

      if (state === 'allow') {
        overwrite.allow |= bit
        overwrite.deny &= ~bit
      } else if (state === 'deny') {
        overwrite.deny |= bit
        overwrite.allow &= ~bit
      } else {
        overwrite.allow &= ~bit
        overwrite.deny &= ~bit
      }

      if (existingIndex >= 0) {
        if (overwrite.allow === 0 && overwrite.deny === 0) {
          copy.splice(existingIndex, 1)
        } else {
          copy[existingIndex] = overwrite
        }
      } else if (overwrite.allow !== 0 || overwrite.deny !== 0) {
        copy.push(overwrite)
      }
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-2 sm:p-6 backdrop-blur-md">
      <div
        className="relative flex h-[min(90vh,760px)] max-h-[90vh] w-full max-w-4xl flex-col sm:flex-row overflow-hidden rounded-2xl border border-white/20 bg-[var(--app-panel)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Left Sidebar */}
        <div className="flex w-full sm:w-56 shrink-0 flex-row sm:flex-col justify-between border-b sm:border-b-0 sm:border-r border-[var(--app-border)] bg-[var(--app-surface)]/70 p-3 sm:p-5">
          <div className="space-y-1 w-full">
            <div className="mb-4 hidden sm:block px-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
                Category Settings
              </span>
              <h3 className="truncate text-base font-bold text-[var(--text-primary)]">
                {name || category.name}
              </h3>
            </div>

            <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'overview'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sliders size={15} />
                Overview
              </button>

              <button
                type="button"
                onClick={() => setTab('permissions')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'permissions'
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <ShieldCheck size={15} />
                Permissions
              </button>

              <div className="my-2 hidden sm:block border-t border-[var(--app-border)]/60" />

              <button
                type="button"
                onClick={() => setTab('delete')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  tab === 'delete'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                }`}
              >
                <Trash2 size={15} />
                Delete Category
              </button>
            </nav>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={14} /> Close (ESC)
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)]">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {tab === 'overview' ? 'Category Overview' : tab === 'permissions' ? 'Category Permissions' : 'Delete Category'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {tab === 'overview'
                  ? 'Change the category name and general properties.'
                  : tab === 'permissions'
                  ? 'Manage role permissions and synchronize with child channels.'
                  : 'Remove this category from the Space.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close category settings"
              className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {syncSuccessMsg && (
            <div className="mx-6 mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} /> {syncSuccessMsg}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            {tab === 'overview' && (
              <div className="max-w-2xl space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    maxLength={100}
                    onChange={e => setName(e.target.value)}
                    placeholder="CATEGORY NAME"
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] uppercase focus:border-[var(--app-accent)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {tab === 'permissions' && (
              <div className="space-y-5">
                {/* Private Category Switch */}
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                        <Lock size={14} className={isPrivate ? 'text-amber-400' : 'text-[var(--text-secondary)]'} />
                        Private Category
                      </span>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        By making a category private, only selected roles and members will be able to view this category and its synced channels.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPrivate}
                      onClick={() => togglePrivateCategory(!isPrivate)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isPrivate ? 'bg-[#5865F2]' : 'bg-[var(--app-border)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isPrivate ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {isPrivate && (
                    <PrivateAccessManager
                      roles={roles}
                      members={members}
                      overwrites={permissionOverwrites}
                      onToggleTarget={toggleTargetAccess}
                    />
                  )}
                </div>

                {/* Sync Permissions with child channels button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/60 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Sync With All Child Channels</h4>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Overwrite and synchronize permissions for all channels inside this category to match these settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={syncingChannels}
                    onClick={handleSyncChannels}
                    className="flex items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                  >
                    <RefreshCw size={14} className={syncingChannels ? 'animate-spin' : ''} />
                    {syncingChannels ? 'Syncing Channels...' : 'Sync Now with Channels'}
                  </button>
                </div>

                {/* 3-State Permission Matrix */}
                <ThreeStatePermissionMatrix
                  roles={roles}
                  members={members}
                  overwrites={permissionOverwrites}
                  onChange={handlePermissionChange}
                />
              </div>
            )}

            {tab === 'delete' && (
              <div className="max-w-lg space-y-4">
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-3">
                  <h4 className="font-bold text-sm text-red-400 flex items-center gap-2">
                    <Trash2 size={16} /> Delete Category
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Are you sure you want to delete <strong>{category.name}</strong>? Channels inside this category will not be deleted; they will become uncategorized.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition-colors"
                  >
                    Delete Category
                  </button>
                </div>
              </div>
            )}
          </div>

          {hasUnsavedChanges && (
            <div className="flex items-center justify-between border-t border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-3 shadow-lg">
              <span className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={14} /> Careful — you have unsaved changes!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setName(category.name)
                    setPermissionOverwrites(category.permissionOverwrites ? JSON.parse(JSON.stringify(category.permissionOverwrites)) : [])
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-panel)]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  onClick={handleSave}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[var(--app-panel)] p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="font-bold text-base text-red-400">Delete Category</h3>
            <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to delete <strong>{category.name}</strong>? Child channels will become uncategorized.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--app-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDelete()
                    setShowDeleteConfirm(false)
                    onClose()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not delete category.')
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Component: CreateChannelModal
// -------------------------------------------------------------
export function CreateChannelModal({
  categories,
  initialCategoryId = '',
  onClose,
  onCreate
}: {
  categories: SpaceCategory[]
  initialCategoryId?: string
  onClose: () => void
  onCreate: (name: string, type: 'text' | 'voice' | 'announcement' | 'forum', categoryId: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'text' | 'voice' | 'announcement' | 'forum'>('text')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onCreate(
        type === 'voice' ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
        categoryId
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-md rounded-2xl border border-white/20 bg-[var(--app-panel)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Create Channel</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create channel modal"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Channel Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Channel Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'text' as const, label: 'Text', desc: 'Post messages, images, & memes', icon: Hash },
                { id: 'voice' as const, label: 'Voice', desc: 'Hang out with voice & video', icon: Volume2 },
                { id: 'announcement' as const, label: 'Announcement', desc: 'Broadcast updates to members', icon: Megaphone },
                { id: 'forum' as const, label: 'Forum', desc: 'Structured topics & threads', icon: MessageSquare }
              ].map(item => {
                const Icon = item.icon
                const selected = type === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                      selected
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent)]/15 shadow-sm'
                        : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)]'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 mt-0.5 ${selected ? 'text-[var(--app-accent)]' : 'text-[var(--text-secondary)]'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-[var(--text-primary)]">{item.label}</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] leading-tight">{item.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[var(--text-secondary)]">
                {type === 'voice' ? <Volume2 size={16} /> : type === 'announcement' ? <Megaphone size={16} /> : <Hash size={16} />}
              </span>
              <input
                type="text"
                value={name}
                maxLength={100}
                required
                autoFocus
                onChange={e => {
                  const val = type === 'voice' ? e.target.value : e.target.value.toLowerCase().replace(/\s+/g, '-')
                  setName(val)
                }}
                placeholder={type === 'voice' ? 'General Voice' : 'new-channel'}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Category
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
            >
              <option value="">(No Category)</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--app-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-40"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component: CreateCategoryModal
// -------------------------------------------------------------
export function CreateCategoryModal({
  onClose,
  onCreate
}: {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await onCreate(name.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-md rounded-2xl border border-white/20 bg-[var(--app-panel)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Create Category</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create category modal"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              maxLength={100}
              required
              autoFocus
              onChange={e => setName(e.target.value)}
              placeholder="TEXT CHANNELS"
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-semibold uppercase text-[var(--text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-xs font-semibold hover:bg-[var(--app-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-40"
            >
              {loading ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component: ChannelsSettingsTreeView
// -------------------------------------------------------------
export function ChannelsSettingsTreeView({
  channels,
  categories,
  onOpenChannelSettings,
  onOpenCategorySettings,
  onCreateChannelInCategory,
  onCreateCategory,
  onReorderChannels,
  onReorderCategories
}: {
  channels: SpaceChannel[]
  categories: SpaceCategory[]
  onOpenChannelSettings: (channel: SpaceChannel) => void
  onOpenCategorySettings: (category: SpaceCategory) => void
  onCreateChannelInCategory: (categoryId: string) => void
  onCreateCategory: () => void
  onReorderChannels: (reordered: Array<{ id: string; position: number; categoryId: string }>) => Promise<void>
  onReorderCategories: (reordered: Array<{ id: string; position: number }>) => Promise<void>
}) {
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([])
  const [draggedItem, setDraggedItem] = useState<{ type: 'channel' | 'category'; id: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.position - b.position)
  }, [categories])

  const uncategorizedChannels = useMemo(() => {
    return channels.filter(c => !c.categoryId).sort((a, b) => a.position - b.position)
  }, [channels])

  // Helper to determine if a channel is synced with its parent category
  const isChannelSynced = (channel: SpaceChannel, category?: SpaceCategory) => {
    if (!category) return true
    return JSON.stringify(channel.permissionOverwrites || []) === JSON.stringify(category.permissionOverwrites || [])
  }

  // Handle Drag & Drop Channels Reorder
  const handleDropOnChannel = async (targetChannel: SpaceChannel, place: 'before' | 'after') => {
    if (!draggedItem || draggedItem.type !== 'channel' || draggedItem.id === targetChannel.id) return

    const dragged = channels.find(c => c.id === draggedItem.id)
    if (!dragged) return

    // Reorder inside or move across category
    const list = [...channels].sort((a, b) => a.position - b.position)
    const filtered = list.filter(c => c.id !== dragged.id)
    const targetIdx = filtered.findIndex(c => c.id === targetChannel.id)
    if (targetIdx < 0) return

    const insertIdx = place === 'before' ? targetIdx : targetIdx + 1
    const newChannel = { ...dragged, categoryId: targetChannel.categoryId || '' }
    filtered.splice(insertIdx, 0, newChannel)

    const updates = filtered.map((c, idx) => ({
      id: c.id,
      position: idx,
      categoryId: c.id === dragged.id ? targetChannel.categoryId || '' : c.categoryId || ''
    }))

    await onReorderChannels(updates)
  }

  const handleDropOnCategory = async (category: SpaceCategory) => {
    if (!draggedItem) return

    if (draggedItem.type === 'category') {
      if (draggedItem.id === category.id) return
      const list = [...categories].sort((a, b) => a.position - b.position)
      const dragged = list.find(c => c.id === draggedItem.id)
      if (!dragged) return

      const filtered = list.filter(c => c.id !== dragged.id)
      const targetIdx = filtered.findIndex(c => c.id === category.id)
      if (targetIdx < 0) return

      filtered.splice(targetIdx, 0, dragged)
      const updates = filtered.map((c, idx) => ({ id: c.id, position: idx }))
      await onReorderCategories(updates)
      return
    }

    if (draggedItem.type === 'channel') {
      const dragged = channels.find(c => c.id === draggedItem.id)
      if (!dragged) return

      // Move channel to this category at the top or bottom
      const list = [...channels].sort((a, b) => a.position - b.position)
      const filtered = list.filter(c => c.id !== dragged.id)
      const lastInCatIdx = filtered.reduce((last, c, idx) => c.categoryId === category.id ? idx : last, -1)
      const insertIdx = lastInCatIdx >= 0 ? lastInCatIdx + 1 : filtered.length

      filtered.splice(insertIdx, 0, { ...dragged, categoryId: category.id })
      const updates = filtered.map((c, idx) => ({
        id: c.id,
        position: idx,
        categoryId: c.id === dragged.id ? category.id : c.categoryId || ''
      }))

      await onReorderChannels(updates)
    }
  }

  const handleDropOnUncategorizedRoot = async () => {
    if (!draggedItem || draggedItem.type !== 'channel') return
    const dragged = channels.find(c => c.id === draggedItem.id)
    if (!dragged) return

    const list = [...channels].sort((a, b) => a.position - b.position)
    const filtered = list.filter(c => c.id !== dragged.id)
    filtered.push({ ...dragged, categoryId: '' })

    const updates = filtered.map((c, idx) => ({
      id: c.id,
      position: idx,
      categoryId: c.id === dragged.id ? '' : c.categoryId || ''
    }))

    await onReorderChannels(updates)
  }

  return (
    <div className="space-y-4">
      {/* Top action bar matching Discord Server Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Channels & Categories</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage channel hierarchy, reorder by dragging handles, and edit overwrites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateChannelInCategory('')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3.5 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all"
          >
            <Plus size={15} /> Create Channel
          </button>
          <button
            type="button"
            onClick={onCreateCategory}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-all"
          >
            <Folder size={15} /> Create Category
          </button>
        </div>
      </div>

      {/* Tree View Container */}
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/30 p-3 sm:p-4 space-y-4">
        {/* Categories Accordions */}
        {sortedCategories.map(category => {
          const childChannels = channels
            .filter(c => c.categoryId === category.id)
            .sort((a, b) => a.position - b.position)
          const isCollapsed = collapsedCategories.includes(category.id)

          return (
            <div
              key={category.id}
              className={`rounded-xl border border-[var(--app-border)]/70 bg-[var(--app-panel)] overflow-hidden transition-all ${
                draggedItem?.id === category.id ? 'opacity-40 ring-2 ring-[var(--app-accent)]' : ''
              }`}
            >
              {/* Category Header Bar */}
              <div
                draggable
                onDragStart={e => {
                  setDraggedItem({ type: 'category', id: category.id })
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', category.id)
                }}
                onDragEnd={() => setDraggedItem(null)}
                onDragOver={e => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  void handleDropOnCategory(category)
                  setDraggedItem(null)
                }}
                className="group flex h-11 items-center justify-between px-3 hover:bg-[var(--app-surface-hover)]/70 transition-colors cursor-pointer select-none"
                onClick={() => toggleCategoryCollapse(category.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="cursor-grab active:cursor-grabbing text-[var(--text-secondary)] opacity-50 hover:opacity-100 p-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <GripVertical size={15} />
                  </span>
                  <button
                    type="button"
                    aria-label={isCollapsed ? 'Expand category' : 'Collapse category'}
                    className="text-[var(--text-secondary)] transition-transform duration-150"
                  >
                    {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <span className="truncate text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {category.name}
                  </span>
                  <span className="rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {childChannels.length}
                  </span>
                </div>

                {/* Right actions: [+] Add Channel, [⚙] Settings */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Create Channel in Category"
                    onClick={() => onCreateChannelInCategory(category.id)}
                    className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    type="button"
                    title="Category Settings"
                    onClick={() => onOpenCategorySettings(category)}
                    className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Settings size={15} />
                  </button>
                </div>
              </div>

              {/* Nested Indented Child Channels */}
              {!isCollapsed && (
                <div
                  className="ml-6 pl-4 border-l-2 border-[var(--app-border)]/50 py-1.5 pr-2 space-y-1"
                  onDragOver={e => {
                    if (draggedItem?.type === 'channel') e.preventDefault()
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleDropOnCategory(category)
                    setDraggedItem(null)
                  }}
                >
                  {childChannels.length === 0 ? (
                    <div className="py-2.5 text-center text-xs text-[var(--text-secondary)] font-medium italic">
                      No channels in this category. Drag channels here or click +
                    </div>
                  ) : (
                    childChannels.map(channel => {
                      const synced = isChannelSynced(channel, category)
                      const isVoice = channel.type === 'voice'

                      return (
                        <div
                          key={channel.id}
                          draggable
                          onDragStart={e => {
                            e.stopPropagation()
                            setDraggedItem({ type: 'channel', id: channel.id })
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', channel.id)
                          }}
                          onDragEnd={() => setDraggedItem(null)}
                          onDragOver={e => {
                            if (draggedItem?.type === 'channel') {
                              e.preventDefault()
                              e.stopPropagation()
                            }
                          }}
                          onDrop={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleDropOnChannel(channel, 'after')
                            setDraggedItem(null)
                          }}
                          className={`group flex h-9 items-center justify-between rounded-lg px-2.5 transition-colors ${
                            draggedItem?.id === channel.id
                              ? 'opacity-40 bg-[var(--app-accent)]/20'
                              : 'hover:bg-[var(--app-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity">
                              <GripVertical size={13} />
                            </span>
                            <span className="shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                              {isVoice ? <Volume2 size={15} /> : channel.type === 'announcement' ? <Megaphone size={15} /> : channel.type === 'forum' ? <MessageSquare size={15} /> : <Hash size={15} />}
                            </span>
                            <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                              {channel.name}
                            </span>
                            {channel.nsfw && (
                              <span className="rounded bg-red-500/10 px-1 py-0.2 text-[9px] font-bold text-red-300">
                                18+
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Synced tag indicator */}
                            {synced ? (
                              <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                <Check size={10} /> Synced
                              </span>
                            ) : (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                Unsynced
                              </span>
                            )}

                            {/* Action Gear ⚙ */}
                            <button
                              type="button"
                              title="Edit Channel Settings"
                              onClick={() => onOpenChannelSettings(channel)}
                              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              <Settings size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Uncategorized Channels Section */}
        <div
          onDragOver={e => {
            if (draggedItem?.type === 'channel') e.preventDefault()
          }}
          onDrop={e => {
            e.preventDefault()
            e.stopPropagation()
            void handleDropOnUncategorizedRoot()
            setDraggedItem(null)
          }}
          className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-panel)]/40 p-3"
        >
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <span>Channels Without Category</span>
            <span className="text-[10px] opacity-70">Drag channels here to uncategorize</span>
          </div>

          <div className="space-y-1">
            {uncategorizedChannels.length === 0 ? (
              <p className="py-2 text-center text-xs text-[var(--text-secondary)] italic">
                All channels are organized into categories.
              </p>
            ) : (
              uncategorizedChannels.map(channel => {
                const isVoice = channel.type === 'voice'
                return (
                  <div
                    key={channel.id}
                    draggable
                    onDragStart={e => {
                      e.stopPropagation()
                      setDraggedItem({ type: 'channel', id: channel.id })
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', channel.id)
                    }}
                    onDragEnd={() => setDraggedItem(null)}
                    onDragOver={e => {
                      if (draggedItem?.type === 'channel') e.preventDefault()
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      void handleDropOnChannel(channel, 'after')
                      setDraggedItem(null)
                    }}
                    className={`group flex h-9 items-center justify-between rounded-lg px-2.5 transition-colors ${
                      draggedItem?.id === channel.id
                        ? 'opacity-40 bg-[var(--app-accent)]/20'
                        : 'hover:bg-[var(--app-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={13} />
                      </span>
                      <span className="shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                        {isVoice ? <Volume2 size={15} /> : channel.type === 'announcement' ? <Megaphone size={15} /> : channel.type === 'forum' ? <MessageSquare size={15} /> : <Hash size={15} />}
                      </span>
                      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {channel.name}
                      </span>
                      {channel.nsfw && (
                        <span className="rounded bg-red-500/10 px-1 py-0.2 text-[9px] font-bold text-red-300">
                          18+
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Edit Channel Settings"
                        onClick={() => onOpenChannelSettings(channel)}
                        className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

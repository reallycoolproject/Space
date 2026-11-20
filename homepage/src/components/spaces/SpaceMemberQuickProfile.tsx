import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AtSign, Copy, ExternalLink, MessageCircle, Plus, X, Clock, UserMinus, Ban, Edit3, ShieldAlert, Search, Check, Lock, ShieldCheck, Link2 } from 'lucide-react'
import { RichPresenceCard } from '../connections/RichPresenceCard'
import { ConnectionIcon, getProviderColor } from '../connections/ConnectionIcons'

interface QuickProfileMember {
  userId: string
  username: string
  displayName?: string
  nickname?: string
  avatar?: string
  banner?: string
  bio?: string
  pronouns?: string
  customActivity?: string
  activity?: any
  connections?: any[]
  status?: 'active' | 'inactive' | 'dnd'
  accountCreatedAt?: string
  themeGradient?: { color1?: string; color2?: string; angle?: number }
  joinedAt?: string
  roleIds: string[]
  temporaryRoleAssignments?: Array<{ roleId: string; expiresAt: string }>
  mutedUntil?: string | null
}

interface SpaceMemberQuickProfileProps {
  member: QuickProfileMember
  spaceName: string
  roles: Array<{ id: string; name: string; color: string; icon?: string; position: number }>
  anchor?: { x: number; y: number } | null
  onClose: () => void
  onViewFullProfile: () => void
  onMention: () => void
  onMessage?: () => void
  canManageRoles?: boolean
  assignableRoleIds?: string[]
  onToggleRole?: (roleId: string, durationHours?: number) => Promise<void>
  canModerate?: boolean
  canKick?: boolean
  canBan?: boolean
  canManageNicknames?: boolean
  isOwner?: boolean
  onTimeout?: (durationMinutes: number) => Promise<void>
  onKick?: (reason?: string) => Promise<void>
  onBan?: (reason?: string) => Promise<void>
  onChangeNickname?: (nickname: string) => Promise<void>
}

export function SpaceMemberQuickProfile({
  member,
  spaceName,
  roles,
  anchor,
  onClose,
  onViewFullProfile,
  onMention,
  onMessage,
  canManageRoles = false,
  assignableRoleIds = [],
  onToggleRole,
  canModerate = false,
  canKick = false,
  canBan = false,
  canManageNicknames = false,
  isOwner = false,
  onTimeout,
  onKick,
  onBan,
  onChangeNickname
}: SpaceMemberQuickProfileProps) {
  const [temporaryDuration, setTemporaryDuration] = useState('0')
  const [editingNick, setEditingNick] = useState(false)
  const [nicknameInput, setNicknameInput] = useState(member.nickname || '')
  const [timeoutOpen, setTimeoutOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [roleSearch, setRoleSearch] = useState('')

  const displayName = member.nickname || member.displayName || member.username
  const isMuted = Boolean(member.mutedUntil && new Date(member.mutedUntil) > new Date())
  const temporaryExpirations = new Map((member.temporaryRoleAssignments || []).map(assignment => [assignment.roleId, Date.parse(assignment.expiresAt)]))
  const memberRoles = roles.filter(role => member.roleIds.includes(role.id) &&
    (!temporaryExpirations.has(role.id) || (temporaryExpirations.get(role.id) || 0) > Date.now())
  ).sort((a, b) => b.position - a.position)

  const hasGradient = Boolean(member.themeGradient?.color1 || member.themeGradient?.color2)
  const cardColor1 = member.themeGradient?.color1 || '#0099ff'
  const cardColor2 = member.themeGradient?.color2 || '#7928ca'
  const cardAngle = member.themeGradient?.angle ?? 135

  const width = Math.min(384, window.innerWidth - 32)
  const height = Math.min(620, window.innerHeight - 32)
  const left = anchor
    ? Math.max(16, Math.min(window.innerWidth - width - 16, anchor.x + width + 16 > window.innerWidth ? anchor.x - width - 12 : anchor.x + 12))
    : (window.innerWidth - width) / 2
  const top = anchor
    ? Math.max(16, Math.min(window.innerHeight - height - 16, anchor.y + height + 12 > window.innerHeight ? anchor.y - height - 12 : anchor.y + 12))
    : (window.innerHeight - height) / 2

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(member.userId)
    } catch (error) {
      console.error('Could not copy member ID:', error)
    }
  }

  const handleSaveNickname = async () => {
    if (!onChangeNickname) return
    setIsSubmitting(true)
    try {
      await onChangeNickname(nicknameInput.trim())
      setEditingNick(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTimeoutChoice = async (minutes: number) => {
    if (!onTimeout) return
    setIsSubmitting(true)
    try {
      await onTimeout(minutes)
      setTimeoutOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKickAction = async () => {
    if (!onKick) return
    const reason = window.prompt(`Kick ${displayName} from ${spaceName}? (Optional reason):`, '')
    if (reason === null) return
    setIsSubmitting(true)
    try {
      await onKick(reason)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBanAction = async () => {
    if (!onBan) return
    const reason = window.prompt(`Ban ${displayName} from ${spaceName}? (Optional reason):`, '')
    if (reason === null) return
    setIsSubmitting(true)
    try {
      await onBan(reason)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[180]">
      <button type="button" aria-label="Close member preview" onClick={onClose} className="pointer-events-auto absolute inset-0 cursor-default" />
      <section
        role="dialog"
        aria-label={`${displayName}'s ${spaceName} profile`}
        style={{
          left,
          top,
          maxHeight: height,
          width,
          background: hasGradient
            ? `linear-gradient(${cardAngle}deg, ${cardColor1} 0%, ${cardColor2} 100%)`
            : undefined,
          boxShadow: hasGradient
            ? `0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 35px ${cardColor1}50`
            : undefined
        }}
        className={`pointer-events-auto fixed overflow-y-auto rounded-2xl border ${
          hasGradient ? 'border-white/30 text-white' : 'border-white/20 bg-[var(--app-panel)]/95 ring-1 ring-black/40'
        } shadow-2xl backdrop-blur-xl`}
      >
        <div
          className="relative h-24 bg-gradient-to-br from-[var(--app-accent)]/80 to-[var(--app-surface-hover)] overflow-visible"
          style={
            member.banner
              ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35)),url("${member.banner}")`, backgroundPosition: 'center', backgroundSize: 'cover' }
              : { background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.3) 100%)' }
          }
        >
          <button type="button" onClick={onClose} aria-label="Close member preview" className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md hover:bg-black/60 transition-colors z-20">
            <X size={15} />
          </button>

          {/* Floating Y2K Frutiger Thought Bubble over Avatar */}
          {member.customActivity && (
            <div 
              className="absolute -bottom-16 left-2 px-3 py-1 rounded-2xl text-xs font-bold text-slate-900 shadow-xl pointer-events-none z-30 flex items-center gap-1.5 select-none animate-in fade-in max-w-[240px]"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(225, 245, 255, 0.92) 55%, rgba(190, 230, 255, 0.95) 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.9)',
                boxShadow: '0 4px 15px rgba(0, 140, 255, 0.35), inset 0 1px 1px #ffffff'
              }}
            >
              <span className="text-xs shrink-0">💭</span>
              <span className="truncate">{member.customActivity}</span>
              <div 
                className="absolute -bottom-1 left-4 w-2.5 h-2.5 rotate-45"
                style={{
                  background: 'rgba(190, 230, 255, 0.95)',
                  borderRight: '1.5px solid rgba(255, 255, 255, 0.9)',
                  borderBottom: '1.5px solid rgba(255, 255, 255, 0.9)'
                }}
              />
            </div>
          )}

          <button type="button" onClick={onViewFullProfile} aria-label={`Open ${displayName}'s full profile`} className="absolute -bottom-8 left-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--app-panel)] bg-[var(--app-surface)] text-lg font-bold text-[var(--app-accent)] shadow-lg ring-1 ring-black/20 z-10">
            {member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : displayName.slice(0, 1).toUpperCase()}
            <span
              aria-label={member.status === 'dnd' ? 'Do not disturb' : member.status === 'inactive' ? 'Idle' : member.status === 'active' ? 'Active' : 'Offline'}
              className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--app-panel)] ${
                member.status === 'dnd' ? 'bg-red-500' :
                member.status === 'inactive' ? 'bg-amber-400' :
                member.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
              }`}
            />
          </button>
        </div>

        <div className={`px-5 pb-5 pt-11 ${hasGradient ? 'bg-slate-950/60 backdrop-blur-xl' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button type="button" onClick={onViewFullProfile} className="flex items-center gap-1.5 text-left hover:underline">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{displayName}</h2>
                {isOwner && <span title="Server Owner" className="select-none text-sm">👑</span>}
                {isMuted && <span title="Timed out" className="rounded bg-amber-500/20 px-1 py-0.2 text-[10px] font-bold text-amber-300">⏱️ TIMED OUT</span>}
              </button>
              <p className="text-xs text-[var(--text-secondary)]">@{member.username}</p>
            </div>
            {canManageNicknames && !editingNick && (
              <button
                type="button"
                onClick={() => setEditingNick(true)}
                title="Change server nickname"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>

          {editingNick ? (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5">
              <input
                type="text"
                value={nicknameInput}
                onChange={event => setNicknameInput(event.target.value)}
                placeholder="Server nickname"
                maxLength={32}
                className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs outline-none text-[var(--text-primary)]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void handleSaveNickname()}
                disabled={isSubmitting}
                className="rounded-md bg-[var(--app-accent)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setEditingNick(false); setNicknameInput(member.nickname || '') }}
                className="rounded-md px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            member.nickname && member.nickname !== member.displayName && (
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Server nickname · {member.nickname}</p>
            )
          )}

          <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Member of {spaceName}</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">{member.joinedAt ? new Date(member.joinedAt).toLocaleString() : 'Join date unavailable'}</p>
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Account created {member.accountCreatedAt ? new Date(member.accountCreatedAt).toLocaleDateString() : 'date unavailable'}</p>
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Status · {member.status === 'dnd' ? 'Do not disturb' : member.status === 'inactive' ? 'Idle' : member.status === 'active' ? 'Active' : 'Offline'}</p>
            {isMuted && member.mutedUntil && (
              <p className="mt-1 text-[10px] font-semibold text-amber-400">Timed out until {new Date(member.mutedUntil).toLocaleString()}</p>
            )}
          </div>

          {member.pronouns && <p className="mt-2 text-xs font-medium text-[var(--app-accent)]">{member.pronouns}</p>}
          
          {/* Live Rich Presence Activity */}
          {member.activity && (
            <div className="mt-3">
              <RichPresenceCard activity={member.activity} />
            </div>
          )}

          {member.customActivity && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] text-xs text-[var(--text-primary)] shadow-xs">
              <span className="text-xs">💭</span>
              <span className="font-semibold truncate max-w-[260px]">{member.customActivity}</span>
            </div>
          )}

          {/* Connected Accounts Quick Bar */}
          {member.connections && member.connections.length > 0 && (
            <section className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Link2 size={12} /> Connected Accounts ({member.connections.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {member.connections.map((conn: any) => (
                  <a
                    key={conn.id || conn.provider}
                    href={conn.profileUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[var(--app-panel)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] transition-all shadow-xs"
                  >
                    <div className="w-3 h-3 flex items-center justify-center" style={{ color: getProviderColor(conn.provider) }}>
                      <ConnectionIcon provider={conn.provider} size={12} />
                    </div>
                    <span className="truncate max-w-[100px]">{conn.displayName || conn.username}</span>
                    <span className="text-blue-400 text-[10px]">✓</span>
                  </a>
                ))}
              </div>
            </section>
          )}
          {member.bio && (
            <section className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">About me</p>
              <p className="whitespace-pre-wrap break-words text-xs text-[var(--text-primary)]">{member.bio}</p>
            </section>
          )}

          {(memberRoles.length > 0 || canManageRoles) && (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Roles</p>
                {canManageRoles && (
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--app-accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--app-accent)] hover:bg-[var(--app-accent)] hover:text-white transition-all shadow-xs cursor-pointer"
                    title="Open Role Management Window"
                  >
                    <Plus size={12} /> Manage
                  </button>
                )}
              </div>
              {canManageRoles && (
                <label className="mb-2 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                  Assignment duration
                  <select
                    value={temporaryDuration}
                    onChange={event => setTemporaryDuration(event.target.value)}
                    className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  >
                    <option value="0">Permanent</option>
                    <option value="1">1 hour</option>
                    <option value="24">1 day</option>
                    <option value="168">7 days</option>
                    <option value="720">30 days</option>
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-1.5">
                {roles.filter(role => role.id !== 'everyone').sort((a, b) => b.position - a.position).map(role => {
                  const assigned = member.roleIds.includes(role.id) && !((member.temporaryRoleAssignments || []).some(item => item.roleId === role.id && Date.parse(item.expiresAt) <= Date.now()))
                  const canAssign = canManageRoles && assignableRoleIds.includes(role.id)
                  return canAssign ? (
                    <button
                      key={role.id}
                      type="button"
                      aria-pressed={assigned}
                      onClick={() => void onToggleRole?.(role.id, assigned ? undefined : Number(temporaryDuration) || undefined)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${assigned ? 'ring-1 ring-white/20' : 'opacity-40'}`}
                      style={{ color: role.color, borderColor: `${role.color}66`, backgroundColor: assigned ? `${role.color}22` : 'transparent' }}
                      title={member.temporaryRoleAssignments?.find(item => item.roleId === role.id && Date.parse(item.expiresAt) > Date.now()) ? `Expires ${new Date(member.temporaryRoleAssignments.find(item => item.roleId === role.id)!.expiresAt).toLocaleString()}` : undefined}
                    >
                      {role.icon ? `${role.icon} ` : ''}{role.name}
                    </button>
                  ) : assigned ? (
                    <span
                      key={role.id}
                      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-sm"
                      style={{ color: role.color, borderColor: `${role.color}66`, backgroundColor: `${role.color}22` }}
                    >
                      {role.icon ? `${role.icon} ` : ''}{role.name}
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Quick Moderation Row if authorized */}
          {(canModerate || canKick || canBan) && !isOwner && (
            <div className="mt-4 border-t border-[var(--app-border)] pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
                <ShieldAlert size={12} className="text-amber-400" />
                Moderation Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {canModerate && onTimeout && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTimeoutOpen(open => !open)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                    >
                      <Clock size={13} />
                      {isMuted ? 'Remove Timeout' : 'Timeout'}
                    </button>
                    {timeoutOpen && (
                      <div className="absolute left-0 bottom-full mb-1 z-30 w-36 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-1 shadow-2xl">
                        {isMuted && (
                          <button
                            type="button"
                            onClick={() => void handleTimeoutChoice(0)}
                            className="flex w-full items-center px-2 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-[var(--app-surface)] rounded-lg"
                          >
                            Remove Timeout
                          </button>
                        )}
                        {[
                          [1, '60 Seconds'],
                          [5, '5 Minutes'],
                          [10, '10 Minutes'],
                          [60, '1 Hour'],
                          [1440, '1 Day'],
                          [10080, '1 Week']
                        ].map(([minutes, label]) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => void handleTimeoutChoice(Number(minutes))}
                            className="flex w-full items-center px-2 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--app-surface)] rounded-lg"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {canKick && onKick && (
                  <button
                    type="button"
                    onClick={() => void handleKickAction()}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <UserMinus size={13} />
                    Kick
                  </button>
                )}
                {canBan && onBan && (
                  <button
                    type="button"
                    onClick={() => void handleBanAction()}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-600/40 bg-red-600/20 px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-600/30 transition-colors"
                  >
                    <Ban size={13} />
                    Ban
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">
            <button type="button" onClick={onMention} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] transition-colors"><AtSign size={14} />Mention</button>
            {onMessage && <button type="button" onClick={onMessage} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] transition-colors"><MessageCircle size={14} />Message</button>}
            <button type="button" onClick={onViewFullProfile} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:brightness-110 transition-all"><ExternalLink size={14} />Full profile</button>
            <button type="button" onClick={() => void copyUserId()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] transition-colors"><Copy size={14} />Copy ID</button>
          </div>
        </div>
      </section>

      {showRoleModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--app-panel)] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent)]/20 text-[var(--app-accent)]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Manage Roles</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">{displayName} · {spaceName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Controls */}
            <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)]/50 p-3 space-y-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Filter server roles..."
                  value={roleSearch}
                  onChange={e => setRoleSearch(e.target.value)}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--bg-input)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-input)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
                <span>Assignment duration</span>
                <select
                  value={temporaryDuration}
                  onChange={event => setTemporaryDuration(event.target.value)}
                  className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs text-[var(--text-primary)] font-medium"
                >
                  <option value="0">Permanent</option>
                  <option value="1">1 hour</option>
                  <option value="24">1 day</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
            </div>

            {/* Role List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {roles
                .filter(role => role.id !== 'everyone' && (!roleSearch || role.name.toLowerCase().includes(roleSearch.toLowerCase())))
                .sort((a, b) => b.position - a.position)
                .map(role => {
                  const assigned = member.roleIds.includes(role.id) && !((member.temporaryRoleAssignments || []).some(item => item.roleId === role.id && Date.parse(item.expiresAt) <= Date.now()))
                  const canAssign = canManageRoles && assignableRoleIds.includes(role.id)
                  const tempExpiry = member.temporaryRoleAssignments?.find(item => item.roleId === role.id && Date.parse(item.expiresAt) > Date.now())

                  return (
                    <button
                      key={role.id}
                      type="button"
                      disabled={!canAssign}
                      onClick={() => void onToggleRole?.(role.id, assigned ? undefined : Number(temporaryDuration) || undefined)}
                      className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all ${
                        assigned
                          ? 'border-[var(--app-accent)]/50 bg-[var(--app-accent)]/10 text-[var(--text-primary)] font-semibold'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)]/60 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]'
                      } ${!canAssign ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                        <span className="truncate">{role.icon ? `${role.icon} ` : ''}{role.name}</span>
                        {tempExpiry && (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                            Expires {new Date(tempExpiry.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!canAssign && <span title="Locked by role hierarchy"><Lock size={12} className="text-[var(--text-secondary)]" /></span>}
                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          assigned
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-[var(--app-border)] bg-[var(--app-panel)]'
                        }`}>
                          {assigned && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    </button>
                  )
                })}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-xl frutiger-btn frutiger-btn-primary px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}

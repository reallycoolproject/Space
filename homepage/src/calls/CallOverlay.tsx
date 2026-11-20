import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Headphones,
  Loader2,
  Minimize2,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Users,
  Video,
  Wifi,
  WifiOff,
  X
} from 'lucide-react'
import { API_BASE } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from './CallContext'
import { CallControls } from './CallControls'
import { CallParticipantTile } from './CallParticipantTile'
import { CallSettingsModal } from './CallSettingsModal'
import { RemoteAudio } from './RemoteAudio'
import FrutigerLiveKitRoom from './FrutigerLiveKitRoom'
import type { CallSession } from './types'

interface InviteMember {
  userId: string
  username: string
  displayName?: string
  avatar?: string
}

const formatDuration = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

const initials = (name?: string) => (name || '?').trim().slice(0, 1).toUpperCase()

const callStatusText = (
  call: CallSession,
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting',
  durationSeconds: number
) => {
  if (call.status === 'ringing') return 'Ringing…'
  if (connectionState === 'reconnecting') return 'Reconnecting…'
  if (connectionState === 'connecting') return 'Connecting…'
  return formatDuration(durationSeconds)
}

function Avatar({ name, avatar, className = 'h-10 w-10 text-sm' }: { name?: string; avatar?: string; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] font-bold text-white ${className}`}>
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  )
}

export function CallOverlay() {
  const { user } = useAuth()
  const {
    activeCall,
    incomingCall,
    voiceRoom,
    remoteStreams,
    localStream,
    peerStates,
    selfParticipant,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    isVoiceConnecting,
    connectionState,
    callDurationSeconds,
    callOverlayOpen,
    voiceStageVisible,
    selectedDevices,
    mediaError,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    leaveVoice,
    inviteToCall,
    expandCall,
    minimizeCall,
    clearMediaError
  } = useCall()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteMembers, setInviteMembers] = useState<InviteMember[]>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([])
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!inviteOpen || activeCall?.kind !== 'group') return
    let cancelled = false
    setInviteLoading(true)
    setInviteError('')
    fetch(`${API_BASE}/api/groups/${activeCall.roomId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load group members.')
        if (!cancelled) setInviteMembers(data.group?.members || [])
      })
      .catch(error => {
        if (!cancelled) setInviteError(error instanceof Error ? error.message : 'Could not load group members.')
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false)
      })
    return () => { cancelled = true }
  }, [activeCall?.kind, activeCall?.roomId, inviteOpen])

  useEffect(() => {
    if (!inviteOpen) return
    setSelectedInviteIds([])
  }, [inviteOpen])

  useEffect(() => {
    if (!activeCall) {
      setInviteOpen(false)
      setSettingsOpen(false)
    }
  }, [activeCall])

  const audioNodes = useMemo(() => Object.entries(remoteStreams).map(([userId, stream]) => (
    <RemoteAudio
      key={userId}
      stream={stream}
      muted={isDeafened}
      sinkId={selectedDevices.speakerId}
    />
  )), [isDeafened, remoteStreams, selectedDevices.speakerId])

  const participants = useMemo(() => {
    if (!activeCall) return []
    return [...activeCall.participants].sort((left, right) => {
      if (left.userId === selfParticipant?.userId) return -1
      if (right.userId === selfParticipant?.userId) return 1
      return left.joinedAt - right.joinedAt
    })
  }, [activeCall, selfParticipant?.userId])

  const inviteCandidates = useMemo(() => {
    if (!activeCall) return []
    const participantIds = new Set(activeCall.participants.map(participant => participant.userId))
    const invitedIds = new Set(activeCall.invitedUserIds)
    return inviteMembers.filter(member =>
      member.userId !== activeCall.callerId || !participantIds.has(member.userId)
    ).filter(member => !participantIds.has(member.userId) && !invitedIds.has(member.userId))
  }, [activeCall, inviteMembers])

  const openVoiceChannel = () => {
    if (!voiceRoom) return
    window.dispatchEvent(new CustomEvent('space:open-voice', {
      detail: { spaceId: voiceRoom.spaceId, channelId: voiceRoom.channelId }
    }))
  }

  const handleAccept = async () => {
    setAccepting(true)
    try {
      await acceptCall()
    } finally {
      setAccepting(false)
    }
  }

  const handleInvite = () => {
    if (!selectedInviteIds.length) return
    inviteToCall(selectedInviteIds)
    setInviteOpen(false)
  }

  const ringing = Boolean(activeCall && activeCall.status === 'ringing' && activeCall.participants.length <= 1)
  const remoteConnectionIssue = Object.values(peerStates).some(state => state === 'failed' || state === 'disconnected')
  const gridClass = participants.length <= 1
    ? 'mx-auto grid w-full max-w-4xl grid-cols-1 gap-3'
    : participants.length === 2
      ? 'mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2'
      : participants.length <= 4
        ? 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2'
        : 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'

  return (
    <>
      {audioNodes}

      {mediaError && !settingsOpen && (
        <div className="fixed left-1/2 top-4 z-[220] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-[var(--app-panel)] px-3 py-2.5 text-xs text-red-300 shadow-2xl">
          <span>{mediaError}</span>
          <button type="button" onClick={clearMediaError} aria-label="Dismiss media error" className="shrink-0 font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
            >
              <div className="relative overflow-hidden px-6 pb-7 pt-9 text-center">
                <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-[var(--app-accent)]/25 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-[var(--app-accent-secondary)]/20 blur-3xl" />
                <div className="relative mx-auto mb-5 flex h-28 w-28 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--app-accent)]/20" />
                  <span className="absolute inset-2 animate-pulse rounded-full bg-[var(--app-accent)]/15" />
                  <Avatar
                    name={incomingCall.caller.displayName || incomingCall.caller.username}
                    avatar={incomingCall.caller.avatar}
                    className="relative h-24 w-24 text-3xl shadow-2xl ring-4 ring-[var(--app-panel)]"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[var(--app-panel)] bg-[var(--app-accent)] text-white shadow-lg">
                    {incomingCall.call.media === 'video' ? <Video className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
                  </span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-accent)]">
                  Incoming {incomingCall.call.kind === 'group' ? 'group ' : ''}{incomingCall.call.media === 'video' ? 'video' : 'voice'} call
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                  {incomingCall.caller.displayName || incomingCall.caller.username}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {incomingCall.call.kind === 'group'
                    ? `${incomingCall.call.conversationName || 'Group chat'} · ${incomingCall.call.participants.length} ${incomingCall.call.participants.length === 1 ? 'person' : 'people'} waiting`
                    : 'is calling you'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-[var(--app-border)] p-5">
                <button
                  type="button"
                  onClick={declineCall}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20"
                >
                  <PhoneOff className="h-4 w-4" /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="frutiger-btn frutiger-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  {accepting ? 'Connecting…' : 'Accept'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCall && callOverlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[170] flex flex-col bg-[var(--app-bg)] text-[var(--text-primary)]"
          >
            {ringing ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[var(--app-accent)]/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-[var(--app-accent-secondary)]/15 blur-3xl" />

                <div className="relative mb-6">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--app-accent)]/25" />
                  <span className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-[var(--app-panel)] border border-[var(--app-border)] text-[var(--app-accent)] shadow-2xl backdrop-blur-xl">
                    <PhoneIncoming className="h-12 w-12 animate-pulse" />
                  </span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--app-accent)] mb-1">
                  Outgoing {activeCall.kind === 'group' ? 'group ' : ''}{activeCall.media === 'video' ? 'video' : 'voice'} call
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">
                  {activeCall.conversationName || (activeCall.kind === 'group' ? 'Group call' : activeCall.callerName)}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm">
                  {activeCall.invitedUserIds.length
                    ? `Waiting for ${activeCall.invitedUserIds.length} ${activeCall.invitedUserIds.length === 1 ? 'person' : 'people'} to answer…`
                    : 'Ringing… Waiting for answer…'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={minimizeCall}
                    className="frutiger-btn frutiger-btn-secondary px-5 py-3 rounded-2xl text-xs font-bold text-[var(--text-primary)]"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={cancelCall}
                    className="frutiger-btn-danger px-8 py-3.5 rounded-2xl text-white font-bold flex items-center gap-2.5 shadow-xl transition-all active:scale-95 text-sm"
                  >
                    <PhoneOff className="w-5 h-5" /> Cancel Call
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden">
                <FrutigerLiveKitRoom
                  roomName={`call-${activeCall.id}`}
                  userName={selfParticipant?.displayName || selfParticipant?.username || user?.displayName || user?.username || 'User'}
                  callTitle={activeCall.conversationName || (activeCall.kind === 'group' ? 'Group Call' : activeCall.callerName)}
                  initialMedia={activeCall.media}
                  isVoiceChannel={false}
                  onLeave={endCall}
                  onMinimize={minimizeCall}
                  onInvite={() => setInviteOpen(true)}
                  showInvite={activeCall.kind === 'group'}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {activeCall && !callOverlayOpen && !ringing && (
        <div className="hidden" aria-hidden="true">
          <FrutigerLiveKitRoom
            roomName={`call-${activeCall.id}`}
            userName={selfParticipant?.displayName || selfParticipant?.username || user?.displayName || user?.username || 'User'}
            initialMedia={activeCall.media}
            isVoiceChannel={false}
            onLeave={endCall}
          />
        </div>
      )}

      <AnimatePresence>
        {activeCall && !callOverlayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-4 right-4 z-[150] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)]/95 p-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <button type="button" onClick={expandCall} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent)]/15 text-[var(--app-accent)]">
                  {activeCall.media === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                  {connectionState === 'reconnecting' && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-[var(--app-panel)] bg-amber-400" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
                    {activeCall.conversationName || (activeCall.kind === 'group' ? 'Group call' : activeCall.callerName)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
                    {callStatusText(activeCall, connectionState, callDurationSeconds)}
                    {ringing ? ' · waiting for answer' : ''}
                  </span>
                </span>
              </button>
              <CallControls
                variant="dock"
                compact
                showCamera={false}
                showScreen={false}
                showSettings={false}
                showExpand
                onExpand={expandCall}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {voiceRoom && !voiceStageVisible && (
        <div className="hidden" aria-hidden="true">
          <FrutigerLiveKitRoom
            roomName={`voice-${voiceRoom.spaceId}-${voiceRoom.channelId}`}
            userName={selfParticipant?.displayName || selfParticipant?.username || user?.displayName || user?.username || 'User'}
            isVoiceChannel={true}
            onLeave={leaveVoice}
          />
        </div>
      )}

      <AnimatePresence>
        {voiceRoom && !voiceStageVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-4 left-4 z-[150] w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)]/95 p-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Headphones className="h-5 w-5" />
              </span>
              <button type="button" onClick={openVoiceChannel} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{voiceRoom.channelName || 'Voice channel'}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
                  Voice connected · {formatDuration(callDurationSeconds)} · {voiceRoom.participants.length} {voiceRoom.participants.length === 1 ? 'person' : 'people'}
                </span>
              </button>
              <button
                type="button"
                onClick={openVoiceChannel}
                className="shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]"
              >
                Open
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2">
              <div className="flex -space-x-2 pl-1">
                {voiceRoom.participants.slice(0, 5).map(participant => (
                  <span key={participant.userId} title={participant.displayName || participant.username} className={`relative h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--app-panel)] ${participant.speaking ? 'ring-2 ring-emerald-400' : ''}`}>
                    <Avatar name={participant.displayName || participant.username} avatar={participant.avatar} className="h-full w-full text-[10px]" />
                  </span>
                ))}
                {voiceRoom.participants.length > 5 && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--app-panel)] bg-[var(--app-surface)] text-[10px] font-bold text-[var(--text-secondary)]">
                    +{voiceRoom.participants.length - 5}
                  </span>
                )}
              </div>
              <CallControls
                variant="dock"
                compact
                showCamera
                showScreen={false}
                showSettings
                onSettings={() => setSettingsOpen(true)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CallSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AnimatePresence>
        {inviteOpen && activeCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[205] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            onClick={() => setInviteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-call-title"
              className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
                <div>
                  <h2 id="invite-call-title" className="text-lg font-bold text-[var(--text-primary)]">Invite to call</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Bring more members of {activeCall.conversationName || 'this group'} into the call.</p>
                </div>
                <button type="button" onClick={() => setInviteOpen(false)} aria-label="Close invite dialog" className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"><X className="h-5 w-5" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {inviteLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading group members…</div>
                ) : inviteError ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{inviteError}</p>
                ) : inviteCandidates.length === 0 ? (
                  <div className="py-10 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-[var(--text-secondary)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Everyone is already here or invited</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">There is no one else in this group to invite right now.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {inviteCandidates.map(member => {
                      const busy = activeCall.busyUserIds.includes(member.userId)
                      const selected = selectedInviteIds.includes(member.userId)
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          disabled={busy}
                          onClick={() => setSelectedInviteIds(previous => selected ? previous.filter(id => id !== member.userId) : [...previous, member.userId])}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            busy
                              ? 'cursor-not-allowed border-transparent opacity-55'
                              : selected
                                ? 'border-[var(--app-accent)]/50 bg-[var(--app-accent)]/10'
                                : 'border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-surface)]'
                          }`}
                        >
                          <Avatar name={member.displayName || member.username} avatar={member.avatar} className="h-9 w-9 text-xs" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{member.displayName || member.username}</span>
                            <span className="block truncate text-[11px] text-[var(--text-secondary)]">@{member.username}{busy ? ' · In another call' : ''}</span>
                          </span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-[var(--app-accent)] bg-[var(--app-accent)] text-white' : 'border-[var(--app-border)]'}`}>
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] px-5 py-3">
                <button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]">Cancel</button>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={!selectedInviteIds.length || inviteLoading}
                  className="frutiger-btn frutiger-btn-primary rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Send {selectedInviteIds.length ? `${selectedInviteIds.length} ` : ''}invite{selectedInviteIds.length === 1 ? '' : 's'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isVoiceConnecting && voiceRoom && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[160] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]/95 px-4 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xl backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--app-accent)]" /> Connecting to voice…
        </div>
      )}
    </>
  )
}

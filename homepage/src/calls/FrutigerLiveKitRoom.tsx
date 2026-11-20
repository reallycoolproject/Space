import React, { useState, useEffect, useMemo, useRef } from 'react'
import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useParticipants,
  useTracks,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Headphones,
  HeadphoneOff,
  PhoneOff,
  Minimize2,
  Users,
  ShieldCheck,
  Radio,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  Volume2
} from 'lucide-react'
import { API_BASE } from '../config'

const LIVEKIT_URL = 'wss://space-e99bkuh6.livekit.cloud'

interface FrutigerLiveKitRoomProps {
  roomName: string
  userName: string
  userAvatar?: string
  callTitle?: string
  initialMedia?: 'audio' | 'video'
  isVoiceChannel?: boolean
  canSpeak?: boolean
  onLeave: () => void
  onMinimize?: () => void
  onInvite?: () => void
  showInvite?: boolean
  className?: string
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

/**
 * Frutiger Aero / Metro LiveKit Stage Component
 * Renders the participants grid, video tracks, screen shares, and glossy control bar.
 */
function FrutigerConferenceStage({
  callTitle,
  isVoiceChannel,
  canSpeak = true,
  onLeave,
  onMinimize,
  onInvite,
  showInvite,
}: {
  callTitle?: string
  isVoiceChannel?: boolean
  canSpeak?: boolean
  onLeave: () => void
  onMinimize?: () => void
  onInvite?: () => void
  showInvite?: boolean
}) {
  const room = useRoomContext()
  const connectionState = useConnectionState()
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()

  // Track publications for Camera and ScreenShare
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false })

  const [callDuration, setCallDuration] = useState(0)
  const [isDeafened, setIsDeafened] = useState(false)
  const [mediaError, setMediaError] = useState('')

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Deafen effect: mutes/unmutes all remote audio elements in room
  useEffect(() => {
    if (!room) return
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        if (pub.track) {
          pub.track.mediaStreamTrack.enabled = !isDeafened
        }
      }
    }
  }, [isDeafened, room])

  const isMicEnabled = Boolean(localParticipant?.isMicrophoneEnabled)
  const isCamEnabled = Boolean(localParticipant?.isCameraEnabled)
  const isScreenSharing = Boolean(localParticipant?.isScreenShareEnabled)

  const toggleMic = async () => {
    if (!localParticipant || !canSpeak) return
    try {
      setMediaError('')
      await localParticipant.setMicrophoneEnabled(!isMicEnabled)
    } catch (err: any) {
      console.error('[LiveKit] Toggle mic error:', err)
      setMediaError(err?.message || 'Could not toggle microphone.')
    }
  }

  const toggleCam = async () => {
    if (!localParticipant) return
    try {
      setMediaError('')
      await localParticipant.setCameraEnabled(!isCamEnabled)
    } catch (err: any) {
      console.error('[LiveKit] Toggle camera error:', err)
      setMediaError(err?.message || 'Could not toggle camera.')
    }
  }

  const toggleScreen = async () => {
    if (!localParticipant) return
    try {
      setMediaError('')
      await localParticipant.setScreenShareEnabled(!isScreenSharing)
    } catch (err: any) {
      console.error('[LiveKit] Toggle screen share error:', err)
      setMediaError(err?.message || 'Could not toggle screen share.')
    }
  }

  const toggleDeafen = () => {
    setIsDeafened(prev => !prev)
  }

  const handleDisconnect = () => {
    try {
      room?.disconnect()
    } finally {
      onLeave()
    }
  }

  // Active Screen Share (if anyone is sharing screen, feature it in a prominent spotlight)
  const activeScreenTrack = useMemo(() => {
    return screenTracks.find(t => t.publication && t.publication.track)
  }, [screenTracks])

  // Active speaker detection
  const activeSpeaker = useMemo(() => {
    const speaker = participants.find(p => p.isSpeaking)
    return speaker ? (speaker.name || speaker.identity) : null
  }, [participants])

  // Dynamic grid class based on participant count
  const count = participants.length
  const gridClass = count <= 1
    ? 'mx-auto grid w-full max-w-4xl grid-cols-1 gap-4'
    : count === 2
      ? 'mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2'
      : count <= 4
        ? 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2'
        : 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden select-none bg-[var(--app-bg)] text-[var(--text-primary)]">
      {/* ── Top Ambient Frutiger Glow ── */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[75vw] rounded-full bg-gradient-to-b from-[var(--app-accent)]/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-gradient-to-t from-[var(--app-accent-secondary)]/15 to-transparent blur-3xl" />

      {/* ── Header Bar ── */}
      <header className="relative z-20 shrink-0 border-b border-[var(--app-border)] bg-[var(--app-panel)]/80 px-4 py-3 sm:px-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LiveKit Cloud SFU
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                {isVoiceChannel ? 'Voice Channel' : 'Encrypted Call'}
              </span>
            </div>
            <h1 className="mt-1 truncate text-lg font-bold sm:text-xl text-[var(--text-primary)]">
              {callTitle || room.name || 'Space Call'}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              {connectionState === ConnectionState.Reconnecting ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <WifiOff className="h-3.5 w-3.5" /> Reconnecting…
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="h-3.5 w-3.5" /> Connected
                </span>
              )}
              <span className="text-[var(--app-border)]">·</span>
              <span>{formatDuration(callDuration)}</span>
              <span className="text-[var(--app-border)]">·</span>
              <span>{participants.length} {participants.length === 1 ? 'member' : 'members'}</span>
              {activeSpeaker && (
                <>
                  <span className="text-[var(--app-border)] hidden sm:inline">·</span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <Volume2 className="h-3 w-3 animate-pulse" /> {activeSpeaker} speaking
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showInvite && onInvite && (
              <button
                type="button"
                onClick={onInvite}
                className="frutiger-btn frutiger-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Invite</span>
              </button>
            )}

            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                title="Minimize Call"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--text-primary)] transition-all hover:bg-[var(--app-surface-hover)] active:scale-95 shadow-sm"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Error Banner if any ── */}
      {mediaError && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs font-semibold text-red-300 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{mediaError}</span>
          <button type="button" onClick={() => setMediaError('')} className="underline ml-2">Dismiss</button>
        </div>
      )}

      {/* ── Main Stage Area ── */}
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-6 sm:py-6">
        {/* If Screen Share is active, render Spotlight layout */}
        {activeScreenTrack ? (
          <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
            {/* Spotlight Screen Share Stage */}
            <div className="relative flex-1 min-h-[320px] overflow-hidden rounded-2xl sm:rounded-3xl border border-[var(--app-border)] bg-black shadow-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent z-10" />
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md shadow-md">
                <MonitorUp className="h-3.5 w-3.5" />
                <span>{activeScreenTrack.participant.name || activeScreenTrack.participant.identity}'s Screen</span>
              </div>
              <VideoTrack trackRef={activeScreenTrack} className="h-full w-full object-contain" />
            </div>

            {/* Filmstrip Row of Camera/Voice Tiles */}
            <div className="flex shrink-0 gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {participants.map(participant => (
                <FrutigerParticipantTile
                  key={participant.identity}
                  participant={participant}
                  cameraTracks={cameraTracks}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          /* Normal Conference Grid */
          <div className={gridClass}>
            {participants.map(participant => (
              <FrutigerParticipantTile
                key={participant.identity}
                participant={participant}
                cameraTracks={cameraTracks}
                className={count === 1 ? 'aspect-video max-h-[64vh]' : 'aspect-video'}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Frutiger Aero Glossy Control Pill Bar ── */}
      <footer className="relative z-30 shrink-0 border-t border-[var(--app-border)] bg-[var(--app-panel)]/80 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 sm:gap-3">
          {/* Microphone Toggle */}
          <button
            type="button"
            onClick={toggleMic}
            disabled={!canSpeak}
            title={!canSpeak ? 'You do not have permission to speak' : isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-95 shadow-md ${
              !isMicEnabled
                ? 'frutiger-btn-danger text-white'
                : 'frutiger-btn-secondary text-[var(--text-primary)] hover:border-emerald-400/50'
            }`}
          >
            {!isMicEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-emerald-400" />}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={toggleCam}
            title={isCamEnabled ? 'Turn off camera' : 'Turn on camera'}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-95 shadow-md ${
              isCamEnabled
                ? 'frutiger-btn-primary text-white'
                : 'frutiger-btn-secondary text-[var(--text-primary)]'
            }`}
          >
            {isCamEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-[var(--text-secondary)]" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={toggleScreen}
            title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-95 shadow-md ${
              isScreenSharing
                ? 'frutiger-btn-primary text-white shadow-cyan-500/30'
                : 'frutiger-btn-secondary text-[var(--text-primary)]'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5 text-cyan-300" /> : <MonitorUp className="h-5 w-5 text-[var(--text-secondary)]" />}
          </button>

          {/* Deafen Toggle */}
          <button
            type="button"
            onClick={toggleDeafen}
            title={isDeafened ? 'Undeafen audio' : 'Deafen (mute incoming audio)'}
            className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-all active:scale-95 shadow-md ${
              isDeafened
                ? 'bg-amber-500 text-slate-900 border border-amber-400 shadow-amber-500/20'
                : 'frutiger-btn-secondary text-[var(--text-primary)]'
            }`}
          >
            {isDeafened ? <HeadphoneOff className="h-5 w-5" /> : <Headphones className="h-5 w-5 text-[var(--text-secondary)]" />}
          </button>

          {/* End Call / Leave Voice */}
          <button
            type="button"
            onClick={handleDisconnect}
            title="Leave Call"
            className="frutiger-btn-danger flex h-11 sm:h-12 items-center justify-center gap-2 px-5 sm:px-6 rounded-2xl text-white font-bold text-sm shadow-lg shadow-red-500/25 transition-all active:scale-95"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </footer>
    </div>
  )
}

/**
 * Individual Frutiger Participant Tile
 */
function FrutigerParticipantTile({
  participant,
  cameraTracks,
  compact = false,
  className = '',
}: {
  participant: any
  cameraTracks: any[]
  compact?: boolean
  className?: string
}) {
  const isSpeaking = participant.isSpeaking
  const isLocal = participant.isLocal
  const displayName = participant.name || participant.identity || 'User'
  const isMuted = !participant.isMicrophoneEnabled

  // Find camera track publication for this participant
  const cameraTrack = cameraTracks.find(
    t => t.participant.identity === participant.identity && t.publication && t.publication.track
  )
  const hasVideo = Boolean(cameraTrack && participant.isCameraEnabled)

  return (
    <div
      className={`group relative flex items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300 ${
        isSpeaking
          ? 'border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.35),0_0_30px_rgba(52,211,153,0.25)]'
          : 'border-[var(--app-border)] shadow-lg'
      } bg-[var(--app-panel)] ${compact ? 'h-32 w-48 shrink-0' : 'w-full'} ${className}`}
    >
      {/* ── Frutiger Gloss Reflection on Top Half ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent z-10" />

      {/* ── Background Radial Gradient ── */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--app-accent)_15%,transparent),transparent_75%)] bg-[var(--app-surface)]" />

      {/* ── Video Track Layer ── */}
      {hasVideo ? (
        <div className="absolute inset-0 h-full w-full bg-black z-0">
          <VideoTrack
            trackRef={cameraTrack}
            className={`h-full w-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
          />
        </div>
      ) : (
        /* ── Frutiger Avatar Center (when camera is off) ── */
        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
          <div
            className={`relative flex items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 ${
              compact
                ? 'h-14 w-14 text-xl'
                : isSpeaking
                  ? 'h-24 w-24 sm:h-28 sm:w-28 text-3xl sm:text-4xl ring-4 ring-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]'
                  : 'h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl ring-2 ring-white/20'
            } bg-gradient-to-br from-[var(--app-accent)] via-blue-500 to-[var(--app-accent-hover)]`}
          >
            {/* Top gloss arc in avatar */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/35 to-transparent" />
            <span>{initials(displayName)}</span>
          </div>

          {!compact && (
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                {displayName}
              </span>
              {isLocal && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  you
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Top-Right Status Badges ── */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {isSpeaking && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-md shadow-md animate-pulse">
            <Volume2 className="h-3 w-3" />
            <span>Speaking</span>
          </span>
        )}

        {isMuted && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 border border-red-400/50 text-white backdrop-blur-md shadow-md">
            <MicOff className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* ── Bottom-Left Participant Name Tag (When video is active) ── */}
      {hasVideo && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-xl bg-black/60 border border-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-md">
          <span className="truncate max-w-[140px]">{displayName}</span>
          {isLocal && <span className="text-[10px] text-white/60 font-normal">(you)</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Main FrutigerLiveKitRoom Export
 * Handles token fetching and wraps everything in LiveKitRoom.
 */
export default function FrutigerLiveKitRoom({
  roomName,
  userName,
  userAvatar,
  callTitle,
  initialMedia = 'audio',
  isVoiceChannel = false,
  canSpeak = true,
  onLeave,
  onMinimize,
  onInvite,
  showInvite = false,
  className = '',
}: FrutigerLiveKitRoomProps) {
  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // Fetch token for this room and user
  useEffect(() => {
    let cancelled = false
    const fetchToken = async () => {
      setLoading(true)
      setError('')

      const cleanRoom = (roomName || '').trim()
      const cleanUser = (userName || 'user').trim()

      if (!cleanRoom) {
        setError('No call room specified.')
        setLoading(false)
        return
      }

      const baseUrls = [
        API_BASE || '',
        `${window.location.protocol}//${window.location.hostname}:3000`,
        'http://localhost:3000',
      ]

      let tokenResult = ''
      let lastErr: any = null

      for (const base of baseUrls) {
        try {
          const res = await fetch(`${base}/api/get-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName: cleanRoom, userName: cleanUser }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.token) {
              tokenResult = data.token
              break
            }
          }
        } catch (err) {
          lastErr = err
        }
      }

      if (cancelled) return

      if (tokenResult) {
        setToken(tokenResult)
        setLoading(false)
      } else {
        console.error('[LiveKit] Token fetch failed:', lastErr)
        setError('Could not connect to LiveKit Cloud. Retrying…')
        setLoading(false)
      }
    }

    void fetchToken()
    return () => {
      cancelled = true
    }
  }, [roomName, userName])

  // Loading State
  if (loading) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center p-6 text-center bg-[var(--app-bg)] text-[var(--text-primary)] ${className}`}>
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--app-accent)]/15 border border-[var(--app-accent)]/30 shadow-xl backdrop-blur-xl">
          <span className="absolute inset-0 rounded-3xl bg-[var(--app-accent)]/15 animate-ping" />
          <Loader2 className="h-8 w-8 animate-spin text-[var(--app-accent)]" />
        </div>
        <h3 className="text-lg font-bold">Connecting to call…</h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Establishing secure LiveKit Cloud audio/video connection</p>
      </div>
    )
  }

  // Error State
  if (error || !token) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center p-6 text-center bg-[var(--app-bg)] text-[var(--text-primary)] ${className}`}>
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-xl">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-red-300">Connection Error</h3>
        <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">{error || 'Failed to acquire session token.'}</p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="frutiger-btn frutiger-btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white"
          >
            Retry Connection
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="frutiger-btn frutiger-btn-secondary px-4 py-2 rounded-xl text-xs font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Connected State with LiveKitRoom & AudioRenderer
  return (
    <div className={`h-full w-full ${className}`}>
      <LiveKitRoom
        token={token}
        serverUrl={LIVEKIT_URL}
        connect={true}
        audio={true}
        video={initialMedia === 'video'}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: '100%', width: '100%' }}
      >
        {/* Plays all incoming audio streams */}
        <RoomAudioRenderer />

        {/* Custom Frutiger Aero Calling Stage */}
        <FrutigerConferenceStage
          callTitle={callTitle}
          isVoiceChannel={isVoiceChannel}
          canSpeak={canSpeak}
          onLeave={onLeave}
          onMinimize={onMinimize}
          onInvite={onInvite}
          showInvite={showInvite}
        />
      </LiveKitRoom>
    </div>
  )
}

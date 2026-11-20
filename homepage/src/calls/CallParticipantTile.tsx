import { useEffect, useRef } from 'react'
import { Headphones, Loader2, MicOff, MonitorUp, WifiOff } from 'lucide-react'
import type { CallParticipant } from './types'

interface CallParticipantTileProps {
  participant: CallParticipant
  stream?: MediaStream | null
  isSelf?: boolean
  isCameraOn?: boolean
  isScreenSharing?: boolean
  className?: string
  onClick?: () => void
}

const initials = (participant: CallParticipant) =>
  (participant.displayName || participant.username || '?').trim().slice(0, 1).toUpperCase()

export function CallParticipantTile({
  participant,
  stream,
  isSelf,
  isCameraOn,
  isScreenSharing,
  className = '',
  onClick
}: CallParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const displayName = participant.displayName || participant.username

  const hasVideoTrack = Boolean(
    stream && stream.getVideoTracks().some(track => track.readyState === 'live')
  )
  const isScreen = isSelf ? Boolean(isScreenSharing) : Boolean(participant.screen)
  const isCameraActive = isSelf ? Boolean(isCameraOn) : Boolean(participant.camera)
  const showVideo = Boolean((isCameraActive || isScreen) && hasVideoTrack)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Video MUST always be muted in the element so mobile browsers never block autoplay!
    // Remote audio is streamed through RemoteAudio.tsx.
    video.muted = true
    video.defaultMuted = true

    if (video.srcObject !== stream) {
      video.srcObject = stream || null
    }

    if (stream && showVideo) {
      const playPromise = video.play()
      if (playPromise) {
        playPromise.catch(err => {
          console.warn('[WebRTC] Video play waiting for document interaction:', err)
          const unlock = () => {
            if (videoRef.current) void videoRef.current.play().catch(() => {})
            window.removeEventListener('click', unlock)
            window.removeEventListener('keydown', unlock)
            window.removeEventListener('pointerdown', unlock)
          }
          window.addEventListener('click', unlock, { once: true })
          window.addEventListener('keydown', unlock, { once: true })
          window.addEventListener('pointerdown', unlock, { once: true })
        })
      }
    }
  }, [stream, showVideo])

  useEffect(() => {
    if (!stream) return
    const handleTrackChange = () => {
      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }
      if (videoRef.current && showVideo) {
        void videoRef.current.play().catch(() => {})
      }
    }
    stream.addEventListener('addtrack', handleTrackChange)
    stream.addEventListener('removetrack', handleTrackChange)
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('unmute', handleTrackChange)
    }
    return () => {
      stream.removeEventListener('addtrack', handleTrackChange)
      stream.removeEventListener('removetrack', handleTrackChange)
      for (const track of stream.getVideoTracks()) {
        track.removeEventListener('unmute', handleTrackChange)
      }
    }
  }, [stream, showVideo])

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={event => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`group relative flex min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-[var(--app-panel)] transition-all ${
        participant.speaking
          ? 'border-emerald-400/80 shadow-[0_0_0_3px_rgba(52,211,153,0.25),0_0_30px_rgba(52,211,153,0.2)]'
          : 'border-[var(--app-border)]'
      } ${participant.connection === 'reconnecting' ? 'border-amber-400/60' : ''} ${onClick ? 'cursor-pointer hover:border-[var(--app-accent)]/60' : ''} ${className}`}
      title={`${displayName}${isSelf ? ' (you)' : ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,var(--app-accent)_0%,transparent_48%),radial-gradient(circle_at_75%_80%,var(--app-accent-secondary)_0%,transparent_45%)] bg-[var(--app-surface)]">
        {/* Base Avatar Layer (shown when camera is off or loading) */}
        <div className={`flex flex-col items-center gap-3 px-4 text-center transition-opacity duration-300 ${showVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className={`relative flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)] font-bold text-white shadow-xl ${
            participant.speaking ? 'h-24 w-24 text-3xl ring-4 ring-emerald-400/50' : 'h-20 w-20 text-2xl'
          }`}>
            {participant.avatar ? (
              <img src={participant.avatar} alt="" className="h-full w-full object-cover" />
            ) : initials(participant)}
            {participant.connection === 'reconnecting' && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                <WifiOff className="h-6 w-6 text-amber-300" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{displayName}</span>
            {isSelf && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">you</span>}
          </div>
        </div>

        {/* Video Layer (always mounted to prevent decoder re-init and black screens) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          onLoadedMetadata={() => {
            if (videoRef.current) void videoRef.current.play().catch(() => {})
          }}
          onCanPlay={() => {
            if (videoRef.current) void videoRef.current.play().catch(() => {})
          }}
          className={`absolute inset-0 h-full w-full bg-black transition-opacity duration-200 ${isScreen ? 'object-contain' : 'object-cover'} ${isSelf && !isScreen ? 'scale-x-[-1]' : ''} ${showVideo ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
        />
      </div>

      {/* Top right badges */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-md shadow-md">
        {participant.connection === 'reconnecting' ? (
          <span className="flex items-center gap-1 text-amber-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[10px]">Reconnecting</span>
          </span>
        ) : null}
        {isScreen ? <MonitorUp className="h-3.5 w-3.5 text-cyan-300" /> : null}
        {participant.deafened ? (
          <Headphones className="h-3.5 w-3.5 text-amber-300" />
        ) : participant.muted ? (
          <MicOff className="h-3.5 w-3.5 text-red-400" />
        ) : null}
      </div>

      {/* Bottom left name tag overlay */}
      {showVideo && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md shadow-md">
          <span className="truncate max-w-[140px]">{displayName}</span>
        </div>
      )}
    </div>
  )
}

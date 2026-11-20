import {
  HeadphoneOff,
  Headphones,
  Maximize2,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings2,
  UserPlus,
  Video,
  VideoOff
} from 'lucide-react'
import { useCall } from './CallContext'

interface CallControlsProps {
  variant?: 'overlay' | 'stage' | 'dock'
  compact?: boolean
  showCamera?: boolean
  showScreen?: boolean
  showInvite?: boolean
  showSettings?: boolean
  showExpand?: boolean
  canSpeak?: boolean
  onInvite?: () => void
  onSettings?: () => void
  onExpand?: () => void
  onEnd?: () => void
  endLabel?: string
  className?: string
}

export function CallControls({
  variant = 'overlay',
  compact,
  showCamera = true,
  showScreen = true,
  showInvite = false,
  showSettings = true,
  showExpand = false,
  canSpeak = true,
  onInvite,
  onSettings,
  onExpand,
  onEnd,
  endLabel,
  className = ''
}: CallControlsProps) {
  const {
    activeCall,
    voiceRoom,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    isVoiceConnecting,
    connectionState,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    cancelCall,
    endCall,
    leaveVoice
  } = useCall()

  const inCall = Boolean(activeCall)
  const isRinging = Boolean(activeCall && activeCall.status === 'ringing' && activeCall.participants.length <= 1)
  const size = compact || variant === 'dock' ? 'h-9 w-9' : 'h-11 w-11'
  const iconSize = compact || variant === 'dock' ? 'h-4 w-4' : 'h-5 w-5'
  const neutral = 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)]'
  const danger = 'border border-red-500 bg-red-500 text-white hover:bg-red-600'
  const accent = 'border border-[var(--app-accent)] bg-[var(--app-accent)] text-white hover:brightness-110'
  const buttonClass = `${size} flex shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`

  const handleEnd = () => {
    if (onEnd) {
      onEnd()
      return
    }
    if (inCall) {
      if (isRinging) cancelCall()
      else endCall()
    } else {
      leaveVoice()
    }
  }

  const defaultEndLabel = isRinging ? 'Cancel call' : inCall ? 'End call' : 'Leave voice channel'

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleMute}
        disabled={!canSpeak || isVoiceConnecting}
        title={!canSpeak ? "You don't have permission to speak in this channel" : isMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={isMuted}
        className={`${buttonClass} ${isMuted ? danger : neutral}`}
      >
        {isMuted ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
      </button>

      <button
        type="button"
        onClick={toggleDeafen}
        title={isDeafened ? 'Undeafen' : 'Deafen'}
        aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
        aria-pressed={isDeafened}
        className={`${buttonClass} ${isDeafened ? danger : neutral}`}
      >
        {isDeafened ? <HeadphoneOff className={iconSize} /> : <Headphones className={iconSize} />}
      </button>

      {showCamera && (
        <button
          type="button"
          onClick={() => void toggleCamera()}
          disabled={isVoiceConnecting}
          title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
          aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
          aria-pressed={isCameraOn}
          className={`${buttonClass} ${isCameraOn ? accent : neutral}`}
        >
          {isCameraOn ? <Video className={iconSize} /> : <VideoOff className={iconSize} />}
        </button>
      )}

      {showScreen && (
        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          disabled={isVoiceConnecting}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          aria-pressed={isScreenSharing}
          className={`${buttonClass} ${isScreenSharing ? accent : neutral}`}
        >
          {isScreenSharing ? <MonitorOff className={iconSize} /> : <MonitorUp className={iconSize} />}
        </button>
      )}

      {showInvite && (
        <button
          type="button"
          onClick={onInvite}
          title="Invite people to this call"
          aria-label="Invite people to this call"
          className={`${buttonClass} ${neutral}`}
        >
          <UserPlus className={iconSize} />
        </button>
      )}

      {showSettings && (
        <button
          type="button"
          onClick={onSettings}
          title="Voice & video settings"
          aria-label="Voice and video settings"
          className={`${buttonClass} ${neutral}`}
        >
          <Settings2 className={iconSize} />
        </button>
      )}

      {showExpand && (
        <button
          type="button"
          onClick={onExpand}
          title="Return to call"
          aria-label="Return to call"
          className={`${buttonClass} ${neutral}`}
        >
          <Maximize2 className={iconSize} />
        </button>
      )}

      <button
        type="button"
        onClick={handleEnd}
        title={endLabel || defaultEndLabel}
        aria-label={endLabel || defaultEndLabel}
        className={`${buttonClass} ${danger}`}
      >
        <PhoneOff className={iconSize} />
      </button>

      {variant === 'dock' && connectionState === 'reconnecting' && (
        <span className="ml-1 hidden text-[10px] font-semibold text-amber-400 sm:inline">Reconnecting…</span>
      )}
    </div>
  )
}

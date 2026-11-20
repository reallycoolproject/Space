import { useEffect, useMemo } from 'react'
import { Headphones, Loader2, Lock, MicOff, Radio, Users, WifiOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from './CallContext'
import { CallControls } from './CallControls'
import { CallParticipantTile } from './CallParticipantTile'
import FrutigerLiveKitRoom from './FrutigerLiveKitRoom'

interface VoiceChannelStageProps {
  spaceId: string
  channel: { id: string; name: string; topic?: string }
  canConnect: boolean
  canSpeak: boolean
  onOpenSettings?: () => void
}

const formatDuration = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export function VoiceChannelStage({ spaceId, channel, canConnect, canSpeak }: VoiceChannelStageProps) {
  const { user } = useAuth()
  const {
    activeCall,
    incomingCall,
    voiceRoom,
    voiceRoomsBySpace,
    localStream,
    remoteStreams,
    selfParticipant,
    isVoiceConnecting,
    connectionState,
    callDurationSeconds,
    joinVoice,
    leaveVoice,
    setVoiceStageVisible
  } = useCall()

  const isActiveChannel = voiceRoom?.spaceId === spaceId && voiceRoom.channelId === channel.id
  const room = isActiveChannel
    ? voiceRoom
    : (voiceRoomsBySpace[spaceId] || []).find(item => item.channelId === channel.id)
  const participants = room?.participants || []
  const joinedElsewhere = Boolean(voiceRoom && !isActiveChannel)
  const busyWithCall = Boolean(activeCall || incomingCall)

  useEffect(() => {
    if (!isActiveChannel) {
      setVoiceStageVisible(false)
      return
    }
    setVoiceStageVisible(true)
    return () => setVoiceStageVisible(false)
  }, [isActiveChannel, setVoiceStageVisible])

  const handleJoin = () => {
    if (!canConnect || busyWithCall || isVoiceConnecting) return
    void joinVoice(spaceId, channel.id, { muted: !canSpeak })
  }

  const sortedParticipants = useMemo(() => [...participants].sort((left, right) => {
    if (left.userId === selfParticipant?.userId) return -1
    if (right.userId === selfParticipant?.userId) return 1
    return left.joinedAt - right.joinedAt
  }), [participants, selfParticipant?.userId])

  if (isActiveChannel) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--app-border)]">
        <FrutigerLiveKitRoom
          roomName={`voice-${spaceId}-${channel.id}`}
          userName={selfParticipant?.displayName || selfParticipant?.username || user?.displayName || user?.username || 'User'}
          callTitle={`# ${channel.name}`}
          isVoiceChannel={true}
          canSpeak={canSpeak}
          onLeave={leaveVoice}
        />
      </div>
    )
  }

  const gridClass = sortedParticipants.length <= 1
    ? 'mx-auto grid w-full max-w-3xl grid-cols-1 gap-3'
    : sortedParticipants.length === 2
      ? 'mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2'
      : 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="flex min-h-full flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel)),var(--app-panel)_42%,color-mix(in_srgb,var(--app-accent-secondary)_8%,var(--app-panel)))]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--app-border)] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent)]/15 text-[var(--app-accent)]">
            <Headphones className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Voice channel</p>
            <h1 className="truncate text-xl font-bold text-[var(--text-primary)]">{channel.name}</h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {participants.length} {participants.length === 1 ? 'person' : 'people'} connected
              {isActiveChannel ? ` · ${formatDuration(callDurationSeconds)}` : ''}
            </p>
          </div>
        </div>
        {isActiveChannel && (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            {connectionState === 'reconnecting'
              ? <><WifiOff className="h-3.5 w-3.5" /> Reconnecting…</>
              : <><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Voice connected</>}
          </div>
        )}
      </header>

      {isActiveChannel && connectionState === 'reconnecting' && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          Reconnecting to voice. Your microphone will resume automatically.
        </div>
      )}

      {isActiveChannel && !canSpeak && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          <MicOff className="mr-1 inline h-3.5 w-3.5" /> You joined muted because you do not have permission to speak in this channel.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-6 sm:py-6">
        {sortedParticipants.length > 0 ? (
          <div className={gridClass}>
            {sortedParticipants.map(participant => {
              const isSelf = participant.userId === selfParticipant?.userId
              return (
                <CallParticipantTile
                  key={participant.userId}
                  participant={participant}
                  stream={isSelf ? localStream : remoteStreams[participant.userId]}
                  isSelf={isSelf}
                  isCameraOn={isSelf ? participant.camera : participant.camera}
                  isScreenSharing={isSelf ? participant.screen : participant.screen}
                  className={sortedParticipants.length === 1 ? 'aspect-video max-h-[52vh]' : 'aspect-video'}
                />
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <span className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--app-accent)]/10 text-[var(--app-accent)]">
              <span className="absolute inset-0 rounded-full border border-[var(--app-accent)]/20" />
              <span className="absolute inset-3 rounded-full border border-[var(--app-accent)]/15" />
              <Headphones className="relative h-10 w-10" />
            </span>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">No one is here yet</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Join the channel to start talking. Space voice channels only ring the people who join — nobody else in the Space is notified.
            </p>
            <div className="mt-4 flex items-center gap-1.5 rounded-full bg-[var(--app-surface)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
              <Users className="h-3.5 w-3.5" /> Only members with Connect permission can see this room
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-panel)]/70 px-4 py-4 backdrop-blur">
        {isActiveChannel ? (
          <CallControls canSpeak={canSpeak} showCamera showScreen showSettings onSettings={undefined} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
            {!canConnect ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <Lock className="h-4 w-4" /> You do not have permission to connect to this voice channel.
              </div>
            ) : busyWithCall ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
                {incomingCall ? 'Answer or decline the incoming call before joining voice.' : 'End your current call before joining a voice channel.'}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={isVoiceConnecting}
                  className="frutiger-btn frutiger-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isVoiceConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  {isVoiceConnecting ? 'Connecting…' : joinedElsewhere ? `Switch to #${channel.name}` : 'Join voice'}
                </button>
                <p className="text-center text-[11px] text-[var(--text-secondary)]">
                  {joinedElsewhere
                    ? `You are connected to ${voiceRoom?.channelName || 'another voice channel'}. Switching moves you here.`
                    : canSpeak
                      ? 'Joining will connect your microphone. Nobody in the Space is rung.'
                      : 'You will join muted because you do not have permission to speak here.'}
                </p>
              </>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

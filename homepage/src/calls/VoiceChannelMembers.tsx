import { Headphones, MicOff } from 'lucide-react'
import { useCall } from './CallContext'

interface VoiceChannelMembersProps {
  spaceId: string
  channelId: string
  onViewProfile?: (userId: string) => void
}

export function VoiceChannelMembers({ spaceId, channelId, onViewProfile }: VoiceChannelMembersProps) {
  const { voiceRoom, voiceRoomsBySpace } = useCall()
  const room = voiceRoom?.spaceId === spaceId && voiceRoom.channelId === channelId
    ? voiceRoom
    : (voiceRoomsBySpace[spaceId] || []).find(item => item.channelId === channelId)

  if (!room || room.participants.length === 0) return null

  return (
    <div className="mb-1 ml-6 space-y-0.5 border-l border-[var(--app-border)] pl-2">
      {room.participants.map(participant => {
        const name = participant.displayName || participant.username
        return (
          <button
            key={participant.userId}
            type="button"
            onClick={() => onViewProfile?.(participant.userId)}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-[var(--app-surface)]"
            title={`${name}${participant.muted ? ' · muted' : ''}${participant.connection === 'reconnecting' ? ' · reconnecting' : ''}`}
          >
            <span className={`relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--app-surface-hover)] text-[9px] font-bold text-[var(--text-primary)] ${participant.speaking ? 'ring-2 ring-emerald-400' : ''}`}>
              {participant.avatar
                ? <img src={participant.avatar} alt="" className="h-full w-full object-cover" />
                : name.slice(0, 1).toUpperCase()}
              {participant.speaking && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--app-panel)] bg-emerald-400" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-secondary)]">{name}</span>
            {participant.deafened
              ? <Headphones className="h-3 w-3 shrink-0 text-amber-400" />
              : participant.muted
                ? <MicOff className="h-3 w-3 shrink-0 text-red-400" />
                : null}
          </button>
        )
      })}
    </div>
  )
}

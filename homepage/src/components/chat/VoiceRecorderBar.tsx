import { Pause, Play, Send, Trash2 } from 'lucide-react'

interface VoiceRecorderBarProps {
  isRecording: boolean
  isPaused: boolean
  durationMs: number
  levels: number[]
  onPauseResume: () => void
  onCancel: () => void
  onSend: () => void
  disabled?: boolean
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function VoiceRecorderBar({
  isRecording,
  isPaused,
  durationMs,
  levels,
  onPauseResume,
  onCancel,
  onSend,
  disabled
}: VoiceRecorderBarProps) {
  if (!isRecording) return null

  const bars = levels.length ? levels.slice(-40) : Array.from({ length: 24 }, (_, index) => 12 + (index % 5) * 5)

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-between gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 shadow-[0_-5px_20px_rgba(0,0,0,0.25)]">
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-500/15"
          title="Delete recording"
          aria-label="Delete recording"
        >
          <Trash2 className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full bg-red-500 ${isPaused ? 'opacity-40' : 'animate-pulse'}`} />
          <span className="font-mono text-sm font-bold tracking-wider text-[var(--text-primary)]">{formatTime(durationMs)}</span>
        </div>
      </div>

      <div className="flex h-7 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden px-2">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-[3px] shrink-0 rounded-full bg-[var(--app-accent)] transition-all duration-100"
            style={{ height: isPaused ? '6px' : `${Math.max(8, Math.min(100, height))}%`, opacity: isPaused ? 0.35 : 0.85 }}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onPauseResume}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-primary)] transition-colors hover:bg-[var(--app-surface-hover)]"
          title={isPaused ? 'Resume recording' : 'Pause recording'}
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          className="frutiger-btn frutiger-btn-primary flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  )
}

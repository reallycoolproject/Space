import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

interface VoiceMessagePlayerProps {
  src: string
  durationMs?: number
  waveform?: number[]
  isMine?: boolean
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

const fallbackWaveform = (count = 40) =>
  Array.from({ length: count }, (_, index) => 20 + Math.round(Math.abs(Math.sin(index * 0.55)) * 55))

export function VoiceMessagePlayer({ src, durationMs, waveform, isMine }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0)
  const [speed, setSpeed] = useState(1)

  const bars = useMemo(() => (waveform?.length ? waveform : fallbackWaveform()), [waveform])
  const total = duration || (durationMs ? durationMs / 1000 : 0)
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handleTime = () => setCurrentTime(audio.currentTime)
    const handleMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
    }
    const handleEnd = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }
    audio.addEventListener('timeupdate', handleTime)
    audio.addEventListener('loadedmetadata', handleMeta)
    audio.addEventListener('ended', handleEnd)
    return () => {
      audio.removeEventListener('timeupdate', handleTime)
      audio.removeEventListener('loadedmetadata', handleMeta)
      audio.removeEventListener('ended', handleEnd)
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const seek = (ratio: number) => {
    const audio = audioRef.current
    if (!audio || !total) return
    const next = Math.max(0, Math.min(total, ratio * total))
    audio.currentTime = next
    setCurrentTime(next)
  }

  const accent = isMine ? 'rgba(255,255,255,0.95)' : 'var(--app-accent)'
  const mutedBar = isMine ? 'rgba(255,255,255,0.35)' : 'color-mix(in srgb, var(--app-accent) 28%, transparent)'

  return (
    <div className="flex w-full max-w-sm min-w-[220px] items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/80 p-2.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
        style={{ background: 'var(--app-accent)' }}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            seek((event.clientX - rect.left) / rect.width)
          }}
          className="flex h-9 w-full items-center gap-[2px]"
          aria-label="Seek voice message"
        >
          {bars.map((height, index) => {
            const barProgress = index / bars.length
            const active = barProgress <= progress
            return (
              <span
                key={index}
                className="min-w-[2px] flex-1 rounded-full transition-colors"
                style={{
                  height: `${Math.max(10, Math.min(100, height))}%`,
                  background: active ? accent : mutedBar
                }}
              />
            )
          })}
        </button>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
          <span>{formatTime(isPlaying || currentTime > 0 ? currentTime : total)}</span>
          <span>{formatTime(total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSpeed(previous => previous === 1 ? 1.5 : previous === 1.5 ? 2 : 1)}
        className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]"
        title="Playback speed"
        aria-label={`Playback speed ${speed}x`}
      >
        {speed}x
      </button>
    </div>
  )
}

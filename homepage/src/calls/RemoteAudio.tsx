import { useEffect, useRef } from 'react'

interface RemoteAudioProps {
  stream: MediaStream | null | undefined
  muted?: boolean
  sinkId?: string
  volume?: number
}

/**
 * Dedicated audio sink for a remote WebRTC stream.
 * Uses native HTMLAudioElement with user-gesture autoplay unlock and track event binding.
 */
export function RemoteAudio({ stream, muted = false, sinkId, volume = 1 }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.muted = Boolean(muted)
    audio.defaultMuted = false

    if (audio.srcObject !== stream) {
      audio.srcObject = stream || null
    }

    const tryPlay = () => {
      if (!stream || stream.getAudioTracks().length === 0) return
      const playPromise = audio.play()
      if (playPromise) {
        playPromise.catch(err => {
          console.warn('[WebRTC] RemoteAudio play waiting for document interaction:', err)
          const unlock = () => {
            if (audioRef.current) void audioRef.current.play().catch(() => {})
            window.removeEventListener('click', unlock)
            window.removeEventListener('touchstart', unlock)
            window.removeEventListener('pointerdown', unlock)
          }
          window.addEventListener('click', unlock, { once: true })
          window.addEventListener('touchstart', unlock, { once: true })
          window.addEventListener('pointerdown', unlock, { once: true })
        })
      }
    }

    tryPlay()

    const handleTrackChange = () => tryPlay()
    if (stream) {
      stream.addEventListener('addtrack', handleTrackChange)
      stream.addEventListener('removetrack', handleTrackChange)
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('unmute', handleTrackChange)
      }
    }

    return () => {
      if (stream) {
        stream.removeEventListener('addtrack', handleTrackChange)
        stream.removeEventListener('removetrack', handleTrackChange)
        for (const track of stream.getAudioTracks()) {
          track.removeEventListener('unmute', handleTrackChange)
        }
      }
    }
  }, [stream, muted])

  useEffect(() => {
    const audio = audioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    if (!audio || !sinkId || typeof audio.setSinkId !== 'function') return
    void audio.setSinkId(sinkId).catch(error => console.warn('[WebRTC] Could not route call audio to speaker', error))
  }, [sinkId])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume))
      audioRef.current.muted = Boolean(muted)
    }
  }, [volume, muted])

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap'
      }}
    />
  )
}

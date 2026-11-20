import { useCallback, useEffect, useRef, useState } from 'react'

export interface VoiceRecordingResult {
  blob: Blob
  durationMs: number
  waveform: number[]
}

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac'
  ]
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

const downsample = (values: number[], buckets = 40) => {
  if (!values.length) return Array.from({ length: buckets }, (_, index) => 18 + Math.round(Math.sin(index / 2) * 6))
  const result: number[] = []
  const step = values.length / buckets
  for (let index = 0; index < buckets; index += 1) {
    const start = Math.floor(index * step)
    const end = Math.max(start + 1, Math.floor((index + 1) * step))
    let total = 0
    for (let cursor = start; cursor < end && cursor < values.length; cursor += 1) total += values[cursor]
    result.push(Math.max(8, Math.min(100, Math.round(total / Math.max(1, end - start)))))
  }
  return result
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [error, setError] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const durationRef = useRef(0)
  const levelsRef = useRef<number[]>([])
  const isPausedRef = useRef(false)
  const sampleRef = useRef<number>(0)

  const clearResources = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    const context = audioContextRef.current
    audioContextRef.current = null
    analyserRef.current = null
    if (context && context.state !== 'closed') void context.close().catch(() => {})
    const mediaStream = streamRef.current
    streamRef.current = null
    setStream(null)
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        track.onended = null
        try { track.stop() } catch { /* ignore */ }
      }
    }
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      try { recorder.stop() } catch { /* ignore */ }
    }
    recorderRef.current = null
    chunksRef.current = []
    levelsRef.current = []
    durationRef.current = 0
    isPausedRef.current = false
    setIsRecording(false)
    setIsPaused(false)
    setDurationMs(0)
    setLevels([])
    clearResources()
  }, [clearResources])

  const stop = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cancel()
      return null
    }

    const duration = durationRef.current
    const waveform = downsample(levelsRef.current)
    const mimeType = recorder.mimeType || 'audio/webm'
    const blob = await new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }))
      try { recorder.stop() } catch { resolve(new Blob(chunksRef.current, { type: mimeType })) }
    })

    recorderRef.current = null
    chunksRef.current = []
    levelsRef.current = []
    durationRef.current = 0
    isPausedRef.current = false
    setIsRecording(false)
    setIsPaused(false)
    setDurationMs(0)
    setLevels([])
    clearResources()

    if (!blob.size) return null
    return { blob, durationMs: duration, waveform }
  }, [cancel, clearResources])

  const start = useCallback(async (deviceId?: string) => {
    setError('')
    if (isRecording) return false
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.')
      return false
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })
      streamRef.current = mediaStream
      setStream(mediaStream)

      const mimeType = pickMimeType()
      const recorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(250)

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          const context = new AudioContextClass()
          audioContextRef.current = context
          const source = context.createMediaStreamSource(mediaStream)
          const analyser = context.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          analyserRef.current = analyser
          const data = new Uint8Array(analyser.fftSize)
          const sample = () => {
            if (analyserRef.current && !isPausedRef.current) {
              analyserRef.current.getByteTimeDomainData(data)
              let sum = 0
              for (const value of data) {
                const centered = (value - 128) / 128
                sum += centered * centered
              }
              const rms = Math.sqrt(sum / data.length)
              const level = Math.max(6, Math.min(100, Math.round(rms * 260)))
              levelsRef.current.push(level)
              if (levelsRef.current.length > 160) levelsRef.current.shift()
              sampleRef.current += 1
              if (sampleRef.current % 2 === 0) setLevels([...levelsRef.current].slice(-48))
            }
            animationRef.current = requestAnimationFrame(sample)
          }
          sample()
        }
      } catch (visualizerError) {
        console.warn('Could not start voice visualizer', visualizerError)
      }

      durationRef.current = 0
      setDurationMs(0)
      setIsRecording(true)
      setIsPaused(false)
      isPausedRef.current = false
      timerRef.current = window.setInterval(() => {
        if (isPausedRef.current) return
        durationRef.current += 100
        setDurationMs(durationRef.current)
      }, 100)

      recorder.onerror = () => {
        setError('Recording failed. Try again.')
        cancel()
      }
      return true
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? 'Microphone permission was denied.'
        : caught instanceof Error ? caught.message : 'Could not start recording.'
      setError(message)
      clearResources()
      return false
    }
  }, [cancel, clearResources, isRecording])

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      isPausedRef.current = true
      setIsPaused(true)
    } else if (recorder.state === 'paused') {
      recorder.resume()
      isPausedRef.current = false
      setIsPaused(false)
    }
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return {
    isRecording,
    isPaused,
    durationMs,
    levels,
    error,
    stream,
    start,
    stop,
    cancel,
    togglePause,
    clearError: () => setError('')
  }
}

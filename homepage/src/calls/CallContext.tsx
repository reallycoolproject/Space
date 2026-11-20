import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { Socket } from 'socket.io-client'
import { API_BASE } from '../config'
import { PeerManager } from './peerManager'
import { ringtone } from './ringtone'
import type {
  CallMedia,
  CallParticipant,
  CallSession,
  DeviceOption,
  IncomingCall,
  MediaDeviceState,
  SelectedDevices,
  VoiceRoom
} from './types'

interface JoinVoiceOptions {
  muted?: boolean
}

interface CallContextValue {
  activeCall: CallSession | null
  incomingCall: IncomingCall | null
  voiceRoom: VoiceRoom | null
  voiceRoomsBySpace: Record<string, VoiceRoom[]>
  localStream: MediaStream | null
  remoteStreams: Record<string, MediaStream>
  peerStates: Record<string, RTCPeerConnectionState>
  selfParticipant: CallParticipant | null
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  isInCall: boolean
  isBusy: boolean
  isVoiceConnecting: boolean
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting'
  callDurationSeconds: number
  devices: MediaDeviceState
  selectedDevices: SelectedDevices
  mediaError: string
  callOverlayOpen: boolean
  voiceStageVisible: boolean
  startCall: (roomId: string, media?: CallMedia, inviteUserIds?: string[]) => void
  joinRoomCall: (roomId: string, media?: CallMedia) => void
  acceptCall: () => Promise<void>
  declineCall: () => void
  cancelCall: () => void
  endCall: () => void
  inviteToCall: (userIds: string[]) => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  switchDevice: (kind: 'microphone' | 'camera' | 'speaker', deviceId: string) => Promise<void>
  refreshDevices: () => Promise<void>
  joinVoice: (spaceId: string, channelId: string, options?: JoinVoiceOptions) => Promise<void>
  leaveVoice: () => void
  loadVoiceRooms: (spaceId: string) => Promise<void>
  syncVoiceRooms: (spaceId: string) => void
  expandCall: () => void
  minimizeCall: () => void
  setVoiceStageVisible: (visible: boolean) => void
  clearMediaError: () => void
  callBack: (roomId: string, media: CallMedia) => void
}

const CallContext = createContext<CallContextValue | null>(null)

const readStored = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

const formatError = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Permission was denied. Allow microphone or camera access in your browser.'
    if (error.name === 'NotFoundError') return 'No matching microphone or camera was found.'
    if (error.name === 'NotReadableError') return 'Your microphone or camera is being used by another app.'
    if (error.name === 'AbortError') return ''
  }
  return error instanceof Error ? error.message : 'Could not access your microphone or camera.'
}

const formatDurationNotice = (totalSeconds: number) => {
  if (totalSeconds <= 0) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface CallProviderProps {
  socket: Socket | null
  user: any
  onNotice?: (message: string, type?: 'success' | 'error' | 'info') => void
  children: ReactNode
}

export function CallProvider({ socket, user, onNotice, children }: CallProviderProps) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [voiceRoom, setVoiceRoom] = useState<VoiceRoom | null>(null)
  const [voiceRoomsBySpace, setVoiceRoomsBySpace] = useState<Record<string, VoiceRoom[]>>({})
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [peerStates, setPeerStates] = useState<Record<string, RTCPeerConnectionState>>({})
  const [isMuted, setIsMuted] = useState(() => readStored('space_call_muted', 'false') === 'true')
  const [isDeafened, setIsDeafened] = useState(() => readStored('space_call_deafened', 'false') === 'true')
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting'>('idle')
  const [callOverlayOpen, setCallOverlayOpen] = useState(false)
  const [voiceStageVisible, setVoiceStageVisible] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const [devices, setDevices] = useState<MediaDeviceState>({ microphones: [], cameras: [], speakers: [] })
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(() => ({
    microphoneId: readStored('space_mic_device', ''),
    cameraId: readStored('space_camera_device', ''),
    speakerId: readStored('space_speaker_device', '')
  }))

  const socketRef = useRef<Socket | null>(socket)
  const userRef = useRef<any>(user)
  const onNoticeRef = useRef(onNotice)
  const activeCallRef = useRef<CallSession | null>(activeCall)
  const incomingCallRef = useRef<IncomingCall | null>(incomingCall)
  const voiceRoomRef = useRef<VoiceRoom | null>(voiceRoom)
  const selectedDevicesRef = useRef(selectedDevices)
  const isMutedRef = useRef(isMuted)
  const isDeafenedRef = useRef(isDeafened)
  const isCameraOnRef = useRef(isCameraOn)
  const isScreenSharingRef = useRef(isScreenSharing)
  const localStreamRef = useRef<MediaStream | null>(null)
  const micTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const peerManagerRef = useRef<PeerManager | null>(null)
  const iceServersRef = useRef<RTCIceServer[]>([
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.services.mozilla.com:3478'
      ]
    },
    {
      urls: [
        `turn:${typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : '192.168.1.3'}:3478`,
        'turn:192.168.1.3:3478',
        'turn:127.0.0.1:3478'
      ],
      username: 'spaceuser',
      credential: 'spacesecureturnpass2026'
    }
  ])
  const sendSignalRef = useRef<(targetUserId: string, signal: unknown) => void>(() => {})
  const speakingIntervalRef = useRef<number | null>(null)

  socketRef.current = socket
  userRef.current = user
  onNoticeRef.current = onNotice
  activeCallRef.current = activeCall
  incomingCallRef.current = incomingCall
  voiceRoomRef.current = voiceRoom
  selectedDevicesRef.current = selectedDevices
  isMutedRef.current = isMuted
  isDeafenedRef.current = isDeafened
  isCameraOnRef.current = isCameraOn
  isScreenSharingRef.current = isScreenSharing

  const pushNotice = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (!message) return
    onNoticeRef.current?.(message, type)
  }, [])

  const rebuildLocalStream = useCallback(() => {
    const tracks: MediaStreamTrack[] = []
    if (micTrackRef.current?.readyState === 'live') tracks.push(micTrackRef.current)
    const videoTrack = screenTrackRef.current?.readyState === 'live'
      ? screenTrackRef.current
      : cameraTrackRef.current?.readyState === 'live'
        ? cameraTrackRef.current
        : null
    if (videoTrack) tracks.push(videoTrack)
    const stream = tracks.length ? new MediaStream(tracks) : null
    localStreamRef.current = stream
    setLocalStream(stream)
    peerManagerRef.current?.syncLocalTracks()
  }, [])

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const toOptions = (kind: MediaDeviceKind): DeviceOption[] =>
        list
          .filter(device => device.kind === kind)
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `${kind === 'audioinput' ? 'Microphone' : kind === 'videoinput' ? 'Camera' : 'Speaker'} ${index + 1}`
          }))
      setDevices({
        microphones: toOptions('audioinput'),
        cameras: toOptions('videoinput'),
        speakers: toOptions('audiooutput')
      })
    } catch (error) {
      console.warn('Could not enumerate media devices', error)
    }
  }, [])

  const acquireMicrophone = useCallback(async (deviceIdOverride?: string) => {
    if (!deviceIdOverride && micTrackRef.current?.readyState === 'live') return micTrackRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser does not support microphone access. HTTPS is required on mobile.')
      return null
    }
    const deviceId = deviceIdOverride ?? selectedDevicesRef.current.microphoneId
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })
      const track = stream.getAudioTracks()[0] || null
      const previous = micTrackRef.current
      if (previous && previous !== track) {
        previous.onended = null
        previous.stop()
      }
      micTrackRef.current = track
      if (track) {
        track.enabled = !isMutedRef.current && !isDeafenedRef.current
        track.onended = () => {
          micTrackRef.current = null
          rebuildLocalStream()
        }
      }
      setMediaError('')
      rebuildLocalStream()
      await refreshDevices()
      return track
    } catch (error) {
      const message = formatError(error)
      if (message) {
        setMediaError(message)
        pushNotice(message, 'error')
      }
      isMutedRef.current = true
      setIsMuted(true)
      writeStored('space_call_muted', 'true')
      return null
    }
  }, [pushNotice, rebuildLocalStream, refreshDevices])

  const acquireCamera = useCallback(async (deviceIdOverride?: string) => {
    if (!deviceIdOverride && cameraTrackRef.current?.readyState === 'live') return cameraTrackRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser does not support camera access. HTTPS is required on mobile.')
      return null
    }
    const deviceId = deviceIdOverride ?? selectedDevicesRef.current.cameraId
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        }
      })
      const track = stream.getVideoTracks()[0] || null
      const previous = cameraTrackRef.current
      if (previous && previous !== track) {
        previous.onended = null
        previous.stop()
      }
      cameraTrackRef.current = track
      if (track) {
        track.onended = () => {
          cameraTrackRef.current = null
          if (isCameraOnRef.current) {
            isCameraOnRef.current = false
            setIsCameraOn(false)
            peerManagerRef.current?.replaceTrack('video', isScreenSharingRef.current ? screenTrackRef.current : null)
            rebuildLocalStream()
          }
        }
      }
      setMediaError('')
      rebuildLocalStream()
      await refreshDevices()
      return track
    } catch (error) {
      const message = formatError(error)
      if (message) {
        setMediaError(message)
        pushNotice(message, 'error')
      }
      return null
    }
  }, [pushNotice, rebuildLocalStream, refreshDevices])

  const stopAllMedia = useCallback(() => {
    for (const track of [micTrackRef.current, cameraTrackRef.current, screenTrackRef.current]) {
      if (!track) continue
      track.onended = null
      try { track.stop() } catch { /* ignore */ }
    }
    micTrackRef.current = null
    cameraTrackRef.current = null
    screenTrackRef.current = null
    localStreamRef.current = null
    setLocalStream(null)
    peerManagerRef.current?.closeAll()
    setRemoteStreams({})
    setPeerStates({})
    isCameraOnRef.current = false
    isScreenSharingRef.current = false
    setIsCameraOn(false)
    setIsScreenSharing(false)
  }, [])

  const emitCallState = useCallback((patch: Partial<{ muted: boolean; deafened: boolean; camera: boolean; screen: boolean }> = {}) => {
    const socketInstance = socketRef.current
    if (!socketInstance) return
    const call = activeCallRef.current
    if (call) {
      socketInstance.emit('call:state', {
        callId: call.id,
        muted: isMutedRef.current,
        deafened: isDeafenedRef.current,
        camera: isCameraOnRef.current,
        screen: isScreenSharingRef.current,
        ...patch
      })
    }
    const room = voiceRoomRef.current
    if (room) {
      socketInstance.emit('voice:state', {
        spaceId: room.spaceId,
        channelId: room.channelId,
        muted: isMutedRef.current,
        deafened: isDeafenedRef.current,
        camera: isCameraOnRef.current,
        screen: isScreenSharingRef.current,
        ...patch
      })
    }
  }, [])

  const updateSelfState = useCallback((patch: Partial<CallParticipant>) => {
    const userId = userRef.current?.userId
    if (!userId) return
    setActiveCall(previous => previous
      ? {
          ...previous,
          participants: previous.participants.map(participant =>
            participant.userId === userId ? { ...participant, ...patch } : participant
          )
        }
      : previous)
    setVoiceRoom(previous => previous
      ? {
          ...previous,
          participants: previous.participants.map(participant =>
            participant.userId === userId ? { ...participant, ...patch } : participant
          )
        }
      : previous)
  }, [])

  const cleanupCall = useCallback(() => {
    ringtone.stop()
    setActiveCall(null)
    setIncomingCall(null)
    setCallOverlayOpen(false)
    setIsVoiceConnecting(false)
    setConnectionState('idle')
    setIsMuted(readStored('space_call_muted', 'false') === 'true')
    setIsDeafened(readStored('space_call_deafened', 'false') === 'true')
    stopAllMedia()
  }, [stopAllMedia])

  const cleanupVoice = useCallback(() => {
    ringtone.stop()
    setVoiceRoom(null)
    setIsVoiceConnecting(false)
    setConnectionState('idle')
    stopAllMedia()
  }, [stopAllMedia])

  const ensureCallMedia = useCallback(async (media: CallMedia) => {
    setConnectionState('connecting')
    const microphone = await acquireMicrophone()
    if (media === 'video') await acquireCamera()
    setConnectionState('connected')
    return Boolean(microphone)
  }, [acquireMicrophone, acquireCamera])

  useEffect(() => {
    if (!user?.userId) return
    if (!peerManagerRef.current) {
      peerManagerRef.current = new PeerManager({
        selfUserId: user.userId,
        getIceServers: () => iceServersRef.current,
        getLocalStream: () => localStreamRef.current,
        onRemoteStream: (userId, stream) => {
          setRemoteStreams(previous => ({ ...previous, [userId]: stream }))
        },
        onPeerState: (userId, state) => {
          setPeerStates(previous => ({ ...previous, [userId]: state }))
        },
        sendSignal: (targetUserId, signal) => sendSignalRef.current(targetUserId, signal),
        sendDebug: (data) => socketRef.current?.emit('call:debug', data)
      })
    } else {
      peerManagerRef.current.updateOptions({ selfUserId: user.userId })
    }
  }, [user?.userId])

  sendSignalRef.current = (targetUserId, signal) => {
    const socketInstance = socketRef.current
    if (!socketInstance) return
    const call = activeCallRef.current || incomingCallRef.current?.call
    if (call) {
      socketInstance.emit('call:signal', { callId: call.id, targetUserId, signal })
      return
    }
    const room = voiceRoomRef.current
    if (room) {
      socketInstance.emit('voice:signal', {
        spaceId: room.spaceId,
        channelId: room.channelId,
        targetUserId,
        signal
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/calls/ice`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(response => response.json())
      .then(data => {
        if (!cancelled && Array.isArray(data?.iceServers) && data.iceServers.length) {
          iceServersRef.current = data.iceServers
        }
      })
      .catch(error => console.warn('Could not load ICE servers', error))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    void refreshDevices()
    if (!navigator.mediaDevices?.addEventListener) return
    const handleDeviceChange = () => { void refreshDevices() }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [refreshDevices])

  useEffect(() => {
    const unlock = () => ringtone.unlock()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!activeCall && !voiceRoom) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeCall, voiceRoom])

  // Voice activity detection. Emits speaking updates for both calls and Space
  // voice channels without sending raw audio anywhere except WebRTC.
  useEffect(() => {
    const callId = activeCall?.id
    const voiceSpaceId = voiceRoom?.spaceId
    const voiceChannelId = voiceRoom?.channelId
    const micTrack = localStream?.getAudioTracks()[0]
    if (!micTrack || (!callId && (!voiceSpaceId || !voiceChannelId))) {
      if (speakingIntervalRef.current !== null) {
        window.clearInterval(speakingIntervalRef.current)
        speakingIntervalRef.current = null
      }
      return
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    let cancelled = false
    let active = false
    let lastEmit = 0
    let context: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let interval: number | null = null

    try {
      context = new AudioContextClass()
      void context.resume().catch(() => {})
      source = context.createMediaStreamSource(new MediaStream([micTrack]))
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)

      const tick = () => {
        if (cancelled) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const value of data) {
          const centered = (value - 128) / 128
          sum += centered * centered
        }
        const rms = Math.sqrt(sum / data.length)
        const next = rms > (active ? 0.012 : 0.025)
        const now = Date.now()
        if (next !== active && now - lastEmit > 120) {
          active = next
          lastEmit = now
          if (callId) socketRef.current?.emit('call:speaking', { callId, speaking: active })
          if (voiceSpaceId && voiceChannelId) {
            socketRef.current?.emit('voice:speaking', {
              spaceId: voiceSpaceId,
              channelId: voiceChannelId,
              speaking: active
            })
          }
          updateSelfState({ speaking: active })
        }
      }
      interval = window.setInterval(tick, 150)
      speakingIntervalRef.current = interval
    } catch (error) {
      console.warn('Could not start voice activity detection', error)
    }

    return () => {
      cancelled = true
      if (interval !== null) window.clearInterval(interval)
      if (speakingIntervalRef.current === interval) speakingIntervalRef.current = null
      if (active) {
        if (callId) socketRef.current?.emit('call:speaking', { callId, speaking: false })
        if (voiceSpaceId && voiceChannelId) {
          socketRef.current?.emit('voice:speaking', {
            spaceId: voiceSpaceId,
            channelId: voiceChannelId,
            speaking: false
          })
        }
      }
      try { source?.disconnect() } catch { /* ignore */ }
      if (context && context.state !== 'closed') void context.close().catch(() => {})
    }
  }, [activeCall?.id, voiceRoom?.spaceId, voiceRoom?.channelId, localStream, updateSelfState])

  useEffect(() => {
    if (!socket) return
    const userId = user?.userId

    const updateCallFromPayload = (call: CallSession) => {
      if (!call || call.status === 'ended') return
      if (activeCallRef.current?.id === call.id) setActiveCall(call)
      if (incomingCallRef.current?.call.id === call.id) {
        setIncomingCall(previous => previous ? { ...previous, call } : previous)
      }
    }

    const handleCreated = (payload: { call: CallSession }) => {
      if (!payload?.call) return
      ringtone.stop()
      setActiveCall(payload.call)
      setIncomingCall(null)
      setCallOverlayOpen(true)
      setConnectionState(payload.call.status === 'active' ? 'connected' : 'connecting')
      if (payload.call.status === 'active') ringtone.playJoin()
      void ensureCallMedia(payload.call.media)
      void refreshDevices()
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => {})
    }

    const handleIncoming = (payload: IncomingCall) => {
      if (!payload?.call) return
      if (activeCallRef.current || voiceRoomRef.current) {
        socket.emit('call:decline', { callId: payload.call.id })
        return
      }
      if (incomingCallRef.current && incomingCallRef.current.call.id !== payload.call.id) {
        socket.emit('call:decline', { callId: payload.call.id })
        return
      }
      setIncomingCall(payload)
      setCallOverlayOpen(true)
      ringtone.start('incoming')
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try {
          const title = payload.call.kind === 'group' ? `Incoming group ${payload.call.media} call` : `Incoming ${payload.call.media} call`
          new Notification(title, {
            body: `${payload.caller.displayName || payload.caller.username} is calling`,
            tag: `space-call-${payload.call.id}`
          })
        } catch { /* ignore */ }
      }
    }

    const handleJoined = (payload: { call: CallSession }) => {
      if (!payload?.call) return
      const call = payload.call
      setActiveCall(call)
      setIncomingCall(null)
      setCallOverlayOpen(true)
      setConnectionState('connected')
      ringtone.stop()
      ringtone.playJoin()
      void (async () => {
        if (!micTrackRef.current) await ensureCallMedia(call.media)
        peerManagerRef.current?.syncLocalTracks()
      })()
    }

    const handleUpdated = (payload: { call: CallSession }) => {
      if (!payload?.call) return
      updateCallFromPayload(payload.call)
      if (!activeCallRef.current && !incomingCallRef.current && userId && payload.call.participants.some(participant => participant.userId === userId)) {
        setActiveCall(payload.call)
        setCallOverlayOpen(true)
        ringtone.stop()
        void ensureCallMedia(payload.call.media)
      }
    }

    const handleParticipantJoined = (payload: { call: CallSession; userId: string }) => {
      if (!payload?.call) return
      updateCallFromPayload(payload.call)
      if (payload.userId && payload.userId !== userId) {
        const joined = payload.call.participants.find(participant => participant.userId === payload.userId)
        if (joined) pushNotice(`${joined.displayName || joined.username} joined the call`, 'info')
        ringtone.playJoin()
        void peerManagerRef.current?.createOffer(payload.userId)
      }
    }

    const handleParticipantLeft = (payload: { call: CallSession; userId: string; reason?: string }) => {
      if (!payload?.call) return
      if (payload.userId === userId) {
        cleanupCall()
        if (payload.reason === 'disconnected') pushNotice('You lost connection to the call.', 'error')
        return
      }
      const left = activeCallRef.current?.participants.find(participant => participant.userId === payload.userId)
      if (left) pushNotice(`${left.displayName || left.username} left the call`, 'info')
      ringtone.playLeave()
      updateCallFromPayload(payload.call)
      peerManagerRef.current?.closePeer(payload.userId)
      setRemoteStreams(previous => {
        const next = { ...previous }
        delete next[payload.userId]
        return next
      })
    }

    const handleParticipantUpdated = (payload: { callId: string; participant: CallParticipant }) => {
      if (!payload?.participant) return
      setActiveCall(previous => previous && previous.id === payload.callId
        ? {
            ...previous,
            participants: previous.participants.map(participant =>
              participant.userId === payload.participant.userId ? payload.participant : participant
            )
          }
        : previous)
    }

    const handleSpeaking = (payload: { callId: string; userId: string; speaking: boolean }) => {
      setActiveCall(previous => previous && previous.id === payload.callId
        ? {
            ...previous,
            participants: previous.participants.map(participant =>
              participant.userId === payload.userId ? { ...participant, speaking: payload.speaking } : participant
            )
          }
        : previous)
    }

    const handleEnded = (payload: { call: CallSession; outcome?: string; reason?: string }) => {
      const call = payload?.call
      const wasActive = activeCallRef.current?.id === call?.id
      const wasIncoming = incomingCallRef.current?.call.id === call?.id
      if (!wasActive && !wasIncoming) return
      if (wasIncoming && !wasActive) {
        setIncomingCall(null)
        setCallOverlayOpen(false)
        ringtone.stop()
        const outcome = call?.outcome
        if (outcome === 'canceled') pushNotice('Call canceled', 'info')
        else if (outcome === 'missed') pushNotice(`Missed ${call?.kind === 'group' ? 'group ' : ''}call`, 'info')
        else if (outcome === 'declined') pushNotice('Call declined', 'info')
        return
      }
      cleanupCall()
      ringtone.playLeave()
      const outcome = call?.outcome
      const duration = call?.startedAt ? Math.max(0, Math.round(((call.endedAt || Date.now()) - call.startedAt) / 1000)) : 0
      if (outcome === 'missed') pushNotice(`Missed ${call?.kind === 'group' ? 'group ' : ''}call`, 'info')
      else if (outcome === 'declined') pushNotice('Call declined', 'info')
      else if (outcome === 'canceled') pushNotice('Call canceled', 'info')
      else if (outcome === 'disconnected') pushNotice('Call disconnected', 'error')
      else pushNotice(`Call ended${duration ? ` · ${formatDurationNotice(duration)}` : ''}`, 'info')
    }

    const handleSignal = (payload: { callId: string; fromUserId: string; signal: any }) => {
      if (!payload?.fromUserId || !payload.signal) return
      void peerManagerRef.current?.handleSignal(payload.fromUserId, payload.signal)
    }

    const handleCallError = (payload: { message?: string; code?: string }) => {
      if (payload?.message) pushNotice(payload.message, 'error')
      setIsVoiceConnecting(false)
      if (!activeCallRef.current && !voiceRoomRef.current) {
        ringtone.stop()
        setIncomingCall(null)
        setCallOverlayOpen(false)
        setConnectionState('idle')
      }
    }

    const handleInvited = (payload: { callId: string; userIds?: string[]; busyUserIds?: string[] }) => {
      if (payload?.userIds?.length) {
        pushNotice(`Invitation sent to ${payload.userIds.length} ${payload.userIds.length === 1 ? 'person' : 'people'}`, 'success')
      }
      if (payload?.busyUserIds?.length) {
        pushNotice(`${payload.busyUserIds.length} ${payload.busyUserIds.length === 1 ? 'person is' : 'people are'} already in another call`, 'info')
      }
    }

    const handleBusyUsers = (payload: { userIds?: string[] }) => {
      if (payload?.userIds?.length) {
        pushNotice(`${payload.userIds.length} ${payload.userIds.length === 1 ? 'person is' : 'people are'} already in another call`, 'info')
      }
    }

    const handleInviteDeclined = () => {
      if (activeCallRef.current?.kind === 'group') pushNotice('Someone declined the call invitation', 'info')
    }

    const handleVoiceJoined = (payload: { room: VoiceRoom }) => {
      if (!payload?.room) return
      setVoiceRoom(payload.room)
      setIsVoiceConnecting(false)
      setConnectionState('connected')
      ringtone.stop()
      ringtone.playJoin()
      void (async () => {
        if (!micTrackRef.current) await ensureCallMedia('audio')
        peerManagerRef.current?.syncLocalTracks()
      })()
    }

    const handleVoiceUpdated = (room: VoiceRoom) => {
      if (!room?.spaceId || !room.channelId) return
      setVoiceRoomsBySpace(previous => {
        const current = previous[room.spaceId] || []
        const filtered = current.filter(item => item.channelId !== room.channelId)
        return {
          ...previous,
          [room.spaceId]: room.participants.length ? [...filtered, room] : filtered
        }
      })
      if (voiceRoomRef.current?.spaceId === room.spaceId && voiceRoomRef.current?.channelId === room.channelId) {
        if (room.participants.length === 0) cleanupVoice()
        else setVoiceRoom(room)
      }
    }

    const handleVoiceParticipantJoined = (payload: { room: VoiceRoom; userId: string }) => {
      if (!payload?.room) return
      handleVoiceUpdated(payload.room)
      if (payload.userId && payload.userId !== userId) {
        const joined = payload.room.participants.find(participant => participant.userId === payload.userId)
        if (joined) pushNotice(`${joined.displayName || joined.username} joined the voice channel`, 'info')
        ringtone.playJoin()
        void peerManagerRef.current?.createOffer(payload.userId)
      }
    }

    const handleVoiceParticipantLeft = (payload: { spaceId: string; channelId: string; userId: string; reason?: string }) => {
      if (!payload) return
      if (payload.userId === userId) {
        cleanupVoice()
        if (payload.reason === 'disconnected') pushNotice('You lost connection to the voice channel.', 'error')
        return
      }
      const left = voiceRoomRef.current?.participants.find(participant => participant.userId === payload.userId)
      if (left) pushNotice(`${left.displayName || left.username} left the voice channel`, 'info')
      ringtone.playLeave()
      peerManagerRef.current?.closePeer(payload.userId)
      setRemoteStreams(previous => {
        const next = { ...previous }
        delete next[payload.userId]
        return next
      })
      const patchRoom = (room: VoiceRoom) => ({
        ...room,
        participants: room.participants.filter(participant => participant.userId !== payload.userId)
      })
      setVoiceRoom(previous => previous && previous.spaceId === payload.spaceId && previous.channelId === payload.channelId
        ? patchRoom(previous)
        : previous)
      setVoiceRoomsBySpace(previous => ({
        ...previous,
        [payload.spaceId]: (previous[payload.spaceId] || []).map(room =>
          room.channelId === payload.channelId ? patchRoom(room) : room
        )
      }))
    }

    const handleVoiceParticipantUpdated = (payload: { spaceId: string; channelId: string; participant: CallParticipant }) => {
      if (!payload?.participant) return
      const patchRoom = (room: VoiceRoom) => ({
        ...room,
        participants: room.participants.map(participant =>
          participant.userId === payload.participant.userId ? payload.participant : participant
        )
      })
      setVoiceRoom(previous => previous && previous.spaceId === payload.spaceId && previous.channelId === payload.channelId ? patchRoom(previous) : previous)
      setVoiceRoomsBySpace(previous => ({
        ...previous,
        [payload.spaceId]: (previous[payload.spaceId] || []).map(room => room.channelId === payload.channelId ? patchRoom(room) : room)
      }))
    }

    const handleVoiceSpeaking = (payload: { spaceId: string; channelId: string; userId: string; speaking: boolean }) => {
      const patchRoom = (room: VoiceRoom) => ({
        ...room,
        participants: room.participants.map(participant =>
          participant.userId === payload.userId ? { ...participant, speaking: payload.speaking } : participant
        )
      })
      setVoiceRoom(previous => previous && previous.spaceId === payload.spaceId && previous.channelId === payload.channelId ? patchRoom(previous) : previous)
      setVoiceRoomsBySpace(previous => ({
        ...previous,
        [payload.spaceId]: (previous[payload.spaceId] || []).map(room => room.channelId === payload.channelId ? patchRoom(room) : room)
      }))
    }

    const handleVoiceSignal = (payload: { fromUserId: string; signal: any }) => {
      if (!payload?.fromUserId || !payload.signal) return
      void peerManagerRef.current?.handleSignal(payload.fromUserId, payload.signal)
    }

    const handleVoiceSync = (payload: { spaceId: string; rooms: VoiceRoom[] }) => {
      if (!payload?.spaceId) return
      setVoiceRoomsBySpace(previous => ({ ...previous, [payload.spaceId]: payload.rooms || [] }))
    }

    const handleVoiceLeft = () => cleanupVoice()

    const handleReconnectFailed = () => {
      if (activeCallRef.current) {
        cleanupCall()
        pushNotice('The call ended while you were disconnected.', 'info')
      }
    }

    const handleVoiceReconnectFailed = () => {
      if (voiceRoomRef.current) {
        cleanupVoice()
        pushNotice('The voice channel disconnected.', 'info')
      }
    }

    const handleConnect = () => {
      setConnectionState(activeCallRef.current || voiceRoomRef.current ? 'connected' : 'idle')
      if (activeCallRef.current || voiceRoomRef.current) {
        peerManagerRef.current?.closeAll()
        setRemoteStreams({})
        setPeerStates({})
      }
      if (activeCallRef.current) socket.emit('call:reconnect', { callId: activeCallRef.current.id })
      if (voiceRoomRef.current) {
        socket.emit('voice:reconnect', {
          spaceId: voiceRoomRef.current.spaceId,
          channelId: voiceRoomRef.current.channelId
        })
      }
      void fetch(`${API_BASE}/api/calls/active`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
        .then(response => response.json())
        .then(data => {
          if (!data?.ok) return
          if (!data.call && activeCallRef.current) {
            cleanupCall()
            pushNotice('The call ended while you were away.', 'info')
          } else if (data.call && !activeCallRef.current && data.call.participants?.some((participant: CallParticipant) => participant.userId === userId)) {
            setActiveCall(data.call)
            setCallOverlayOpen(true)
            void ensureCallMedia(data.call.media)
            socket.emit('call:reconnect', { callId: data.call.id })
          }
          if (!data.voiceRoom && voiceRoomRef.current) cleanupVoice()
          else if (data.voiceRoom && !voiceRoomRef.current) {
            setVoiceRoom(data.voiceRoom)
            void ensureCallMedia('audio')
            socket.emit('voice:reconnect', {
              spaceId: data.voiceRoom.spaceId,
              channelId: data.voiceRoom.channelId
            })
          }
          if (data.incomingCall && !incomingCallRef.current && !activeCallRef.current && !voiceRoomRef.current) {
            setIncomingCall({
              call: data.incomingCall,
              caller: {
                userId: data.incomingCall.callerId,
                username: data.incomingCall.callerName,
                displayName: data.incomingCall.callerName,
                avatar: data.incomingCall.callerAvatar
              }
            })
            setCallOverlayOpen(true)
            ringtone.start('incoming')
          }
        })
        .catch(() => {})
    }

    const handleDisconnect = () => {
      if (activeCallRef.current || voiceRoomRef.current) setConnectionState('reconnecting')
    }

    socket.on('call:created', handleCreated)
    socket.on('call:joined', handleJoined)
    socket.on('call:incoming', handleIncoming)
    socket.on('call:updated', handleUpdated)
    socket.on('call:participant-joined', handleParticipantJoined)
    socket.on('call:participant-left', handleParticipantLeft)
    socket.on('call:participant-updated', handleParticipantUpdated)
    socket.on('call:speaking', handleSpeaking)
    socket.on('call:ended', handleEnded)
    socket.on('call:signal', handleSignal)
    socket.on('call:error', handleCallError)
    socket.on('call:invited', handleInvited)
    socket.on('call:busy-users', handleBusyUsers)
    socket.on('call:invite-declined', handleInviteDeclined)
    socket.on('call:reconnect-failed', handleReconnectFailed)
    socket.on('voice:joined', handleVoiceJoined)
    socket.on('voice:updated', handleVoiceUpdated)
    socket.on('voice:participant-joined', handleVoiceParticipantJoined)
    socket.on('voice:participant-left', handleVoiceParticipantLeft)
    socket.on('voice:participant-updated', handleVoiceParticipantUpdated)
    socket.on('voice:speaking', handleVoiceSpeaking)
    socket.on('voice:signal', handleVoiceSignal)
    socket.on('voice:sync', handleVoiceSync)
    socket.on('voice:left', handleVoiceLeft)
    socket.on('voice:error', handleCallError)
    socket.on('voice:reconnect-failed', handleVoiceReconnectFailed)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('call:created', handleCreated)
      socket.off('call:joined', handleJoined)
      socket.off('call:incoming', handleIncoming)
      socket.off('call:updated', handleUpdated)
      socket.off('call:participant-joined', handleParticipantJoined)
      socket.off('call:participant-left', handleParticipantLeft)
      socket.off('call:participant-updated', handleParticipantUpdated)
      socket.off('call:speaking', handleSpeaking)
      socket.off('call:ended', handleEnded)
      socket.off('call:signal', handleSignal)
      socket.off('call:error', handleCallError)
      socket.off('call:invited', handleInvited)
      socket.off('call:busy-users', handleBusyUsers)
      socket.off('call:invite-declined', handleInviteDeclined)
      socket.off('call:reconnect-failed', handleReconnectFailed)
      socket.off('voice:joined', handleVoiceJoined)
      socket.off('voice:updated', handleVoiceUpdated)
      socket.off('voice:participant-joined', handleVoiceParticipantJoined)
      socket.off('voice:participant-left', handleVoiceParticipantLeft)
      socket.off('voice:participant-updated', handleVoiceParticipantUpdated)
      socket.off('voice:speaking', handleVoiceSpeaking)
      socket.off('voice:signal', handleVoiceSignal)
      socket.off('voice:sync', handleVoiceSync)
      socket.off('voice:left', handleVoiceLeft)
      socket.off('voice:error', handleCallError)
      socket.off('voice:reconnect-failed', handleVoiceReconnectFailed)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket, user?.userId, cleanupCall, cleanupVoice, ensureCallMedia, pushNotice, refreshDevices])

  const startCall = useCallback(async (roomId: string, media: CallMedia = 'audio', inviteUserIds?: string[]) => {
    if (!socket || !user?.userId) return
    if (activeCallRef.current || voiceRoomRef.current) {
      pushNotice('You are already in a call or voice channel.', 'error')
      return
    }
    const incoming = incomingCallRef.current
    if (incoming) {
      if (incoming.call.roomId !== roomId) {
        pushNotice('Answer or decline the incoming call first.', 'error')
        return
      }
      socket.emit('call:decline', { callId: incoming.call.id })
      setIncomingCall(null)
      ringtone.stop()
    }
    ringtone.unlock()
    setMediaError('')
    setCallOverlayOpen(true)
    setConnectionState('connecting')
    ringtone.start('outgoing')
    await ensureCallMedia(media)
    socket.emit('call:start', { roomId, media, inviteUserIds })
  }, [socket, user?.userId, pushNotice, ensureCallMedia])

  const joinRoomCall = useCallback((roomId: string, media: CallMedia = 'audio') => {
    if (!socket || !user?.userId) return
    const call = activeCallRef.current
    if (call && call.roomId === roomId) {
      if (call.participants.some(participant => participant.userId === user.userId)) {
        setCallOverlayOpen(true)
      } else {
        socket.emit('call:start', { roomId, media: call.media })
      }
      return
    }
    startCall(roomId, media)
  }, [socket, user?.userId, startCall])

  const acceptCall = useCallback(async () => {
    const incoming = incomingCallRef.current
    if (!incoming || !socket) return
    if (voiceRoomRef.current) {
      pushNotice('Leave your voice channel before answering a call.', 'error')
      return
    }
    ringtone.stop()
    setConnectionState('connecting')
    await ensureCallMedia(incoming.call.media)
    socket.emit('call:accept', { callId: incoming.call.id })
    setIncomingCall(null)
    setCallOverlayOpen(true)
  }, [socket, ensureCallMedia, pushNotice])

  const declineCall = useCallback(() => {
    const incoming = incomingCallRef.current
    if (!incoming || !socket) return
    socket.emit('call:decline', { callId: incoming.call.id })
    ringtone.stop()
    setIncomingCall(null)
    setCallOverlayOpen(false)
  }, [socket])

  const cancelCall = useCallback(() => {
    const call = activeCallRef.current
    if (!call || !socket) {
      cleanupCall()
      return
    }
    socket.emit('call:cancel', { callId: call.id })
    cleanupCall()
  }, [socket, cleanupCall])

  const endCall = useCallback(() => {
    const call = activeCallRef.current
    if (!call || !socket) {
      cleanupCall()
      return
    }
    socket.emit('call:end', { callId: call.id })
    cleanupCall()
  }, [socket, cleanupCall])

  const inviteToCall = useCallback((userIds: string[]) => {
    const call = activeCallRef.current
    if (!call || !socket || !userIds.length) return
    socket.emit('call:invite', { callId: call.id, userIds })
  }, [socket])

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current
    isMutedRef.current = next
    setIsMuted(next)
    writeStored('space_call_muted', String(next))
    if (micTrackRef.current) {
      micTrackRef.current.enabled = !next && !isDeafenedRef.current
    } else if (!next) {
      void acquireMicrophone()
    }
    emitCallState({ muted: next })
    updateSelfState({ muted: next })
    if (next) ringtone.playMute()
    else ringtone.playUnmute()
  }, [acquireMicrophone, emitCallState, updateSelfState])

  const toggleDeafen = useCallback(() => {
    const next = !isDeafenedRef.current
    isDeafenedRef.current = next
    setIsDeafened(next)
    writeStored('space_call_deafened', String(next))
    if (micTrackRef.current) {
      micTrackRef.current.enabled = !isMutedRef.current && !next
    } else if (!next && !isMutedRef.current) {
      void acquireMicrophone()
    }
    emitCallState({ deafened: next })
    updateSelfState({ deafened: next })
    if (next) ringtone.playMute()
    else if (!isMutedRef.current) ringtone.playUnmute()
  }, [acquireMicrophone, emitCallState, updateSelfState])

  const stopScreenShare = useCallback(() => {
    const track = screenTrackRef.current
    if (track) {
      track.onended = null
      try { track.stop() } catch { /* ignore */ }
    }
    screenTrackRef.current = null
    isScreenSharingRef.current = false
    setIsScreenSharing(false)
    const fallback = isCameraOnRef.current ? cameraTrackRef.current : null
    peerManagerRef.current?.replaceTrack('video', fallback)
    rebuildLocalStream()
    emitCallState({ screen: false })
    updateSelfState({ screen: false })
  }, [emitCallState, rebuildLocalStream, updateSelfState])

  const toggleCamera = useCallback(async () => {
    if (isCameraOnRef.current) {
      isCameraOnRef.current = false
      setIsCameraOn(false)
      const track = cameraTrackRef.current
      if (track) {
        track.onended = null
        try { track.stop() } catch { /* ignore */ }
      }
      cameraTrackRef.current = null
      peerManagerRef.current?.replaceTrack('video', isScreenSharingRef.current ? screenTrackRef.current : null)
      rebuildLocalStream()
      emitCallState({ camera: false })
      updateSelfState({ camera: false })
      return
    }

    const track = await acquireCamera()
    if (!track) return
    isCameraOnRef.current = true
    setIsCameraOn(true)
    rebuildLocalStream()
    peerManagerRef.current?.replaceTrack('video', isScreenSharingRef.current ? screenTrackRef.current : track)
    emitCallState({ camera: true })
    updateSelfState({ camera: true })
  }, [acquireCamera, emitCallState, rebuildLocalStream, updateSelfState])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      stopScreenShare()
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      pushNotice('Screen sharing is not supported in this browser.', 'error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false
      })
      const track = stream.getVideoTracks()[0] || null
      if (!track) return
      screenTrackRef.current = track
      isScreenSharingRef.current = true
      setIsScreenSharing(true)
      track.onended = () => stopScreenShare()
      rebuildLocalStream()
      peerManagerRef.current?.replaceTrack('video', track)
      emitCallState({ screen: true })
      updateSelfState({ screen: true })
    } catch (error) {
      const message = formatError(error)
      if (message) pushNotice(message, 'error')
    }
  }, [emitCallState, pushNotice, rebuildLocalStream, stopScreenShare, updateSelfState])

  const switchDevice = useCallback(async (kind: 'microphone' | 'camera' | 'speaker', deviceId: string) => {
    const next = { ...selectedDevicesRef.current, [`${kind}Id`]: deviceId } as SelectedDevices
    selectedDevicesRef.current = next
    setSelectedDevices(next)
    const storageKey = kind === 'microphone'
      ? 'space_mic_device'
      : kind === 'camera'
        ? 'space_camera_device'
        : 'space_speaker_device'
    writeStored(storageKey, deviceId)

    if (kind === 'microphone') {
      const track = await acquireMicrophone(deviceId)
      if (track) {
        track.enabled = !isMutedRef.current && !isDeafenedRef.current
        peerManagerRef.current?.replaceTrack('audio', track)
        rebuildLocalStream()
      }
    } else if (kind === 'camera' && isCameraOnRef.current) {
      const track = await acquireCamera(deviceId)
      if (track) {
        peerManagerRef.current?.replaceTrack('video', isScreenSharingRef.current ? screenTrackRef.current : track)
        rebuildLocalStream()
      }
    }
  }, [acquireCamera, acquireMicrophone, rebuildLocalStream])

  const joinVoice = useCallback(async (spaceId: string, channelId: string, options?: JoinVoiceOptions) => {
    if (!socket || !user?.userId) return
    if (activeCallRef.current) {
      pushNotice('Leave your call before joining a voice channel.', 'error')
      return
    }
    const current = voiceRoomRef.current
    if (current?.spaceId === spaceId && current.channelId === channelId) return
    const incoming = incomingCallRef.current
    if (incoming) {
      socket.emit('call:decline', { callId: incoming.call.id })
      setIncomingCall(null)
      ringtone.stop()
    }
    const muted = options?.muted ?? isMutedRef.current
    isMutedRef.current = muted
    setIsMuted(muted)
    writeStored('space_call_muted', String(muted))
    setMediaError('')
    ringtone.unlock()
    setIsVoiceConnecting(true)
    setConnectionState('connecting')
    await acquireMicrophone()
    socket.emit('voice:join', {
      spaceId,
      channelId,
      muted,
      deafened: isDeafenedRef.current
    })
  }, [socket, user?.userId, acquireMicrophone, pushNotice])

  const leaveVoice = useCallback(() => {
    const room = voiceRoomRef.current
    if (!room || !socket) {
      cleanupVoice()
      return
    }
    socket.emit('voice:leave', { spaceId: room.spaceId, channelId: room.channelId })
    cleanupVoice()
  }, [socket, cleanupVoice])

  const loadVoiceRooms = useCallback(async (spaceId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/calls/spaces/${spaceId}/voice`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
      const data = await response.json()
      if (data?.ok) {
        setVoiceRoomsBySpace(previous => ({ ...previous, [spaceId]: data.rooms || [] }))
      }
    } catch (error) {
      console.warn('Could not load voice rooms', error)
    }
  }, [])

  const syncVoiceRooms = useCallback((spaceId: string) => {
    socketRef.current?.emit('voice:sync', { spaceId })
  }, [])

  const callBack = useCallback((roomId: string, media: CallMedia) => {
    startCall(roomId, media)
  }, [startCall])

  const selfParticipant = useMemo(() => {
    const userId = user?.userId
    if (!userId) return null
    if (activeCall) return activeCall.participants.find(participant => participant.userId === userId) || null
    if (voiceRoom) return voiceRoom.participants.find(participant => participant.userId === userId) || null
    return null
  }, [activeCall, voiceRoom, user?.userId])

  const callDurationSeconds = useMemo(() => {
    if (activeCall) {
      if (!activeCall.startedAt) return 0
      return Math.max(0, Math.floor((clock - activeCall.startedAt) / 1000))
    }
    if (voiceRoom && selfParticipant) {
      return Math.max(0, Math.floor((clock - selfParticipant.joinedAt) / 1000))
    }
    return 0
  }, [activeCall, clock, selfParticipant, voiceRoom])

  const isInCall = Boolean(activeCall || voiceRoom)
  const isBusy = Boolean(activeCall || incomingCall || voiceRoom)

  const value: CallContextValue = {
    activeCall,
    incomingCall,
    voiceRoom,
    voiceRoomsBySpace,
    localStream,
    remoteStreams,
    peerStates,
    selfParticipant,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    isInCall,
    isBusy,
    isVoiceConnecting,
    connectionState,
    callDurationSeconds,
    devices,
    selectedDevices,
    mediaError,
    callOverlayOpen,
    voiceStageVisible,
    startCall,
    joinRoomCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    inviteToCall,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    switchDevice,
    refreshDevices,
    joinVoice,
    leaveVoice,
    loadVoiceRooms,
    syncVoiceRooms,
    expandCall: () => setCallOverlayOpen(true),
    minimizeCall: () => setCallOverlayOpen(false),
    setVoiceStageVisible,
    clearMediaError: () => setMediaError(''),
    callBack
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) throw new Error('useCall must be used inside a CallProvider')
  return context
}

export function useCallOptional() {
  return useContext(CallContext)
}

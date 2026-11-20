type SignalPayload = {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

interface PeerEntry {
  pc: RTCPeerConnection
  remoteStream: MediaStream
  makingOffer: boolean
  ignoreOffer: boolean
  isSettingRemoteAnswerPending: boolean
  polite: boolean
  pendingCandidates: RTCIceCandidateInit[]
  senders: Map<string, RTCRtpSender>
}

export interface PeerManagerOptions {
  selfUserId: string
  getIceServers: () => RTCIceServer[]
  getLocalStream: () => MediaStream | null
  onRemoteStream: (userId: string, stream: MediaStream) => void
  onPeerState: (userId: string, state: RTCPeerConnectionState) => void
  sendSignal: (targetUserId: string, signal: SignalPayload) => void
  sendDebug?: (data: any) => void
}

/**
 * Robust WebRTC mesh manager implementing canonical W3C Perfect Negotiation.
 */
export class PeerManager {
  private peers = new Map<string, PeerEntry>()
  private options: PeerManagerOptions

  constructor(options: PeerManagerOptions) {
    this.options = options
  }

  updateOptions(options: Partial<PeerManagerOptions>) {
    this.options = { ...this.options, ...options }
  }

  private log(event: string, details?: any) {
    console.log(`[WebRTC] ${event}`, details || '')
    try {
      this.options.sendDebug?.({ event, details, selfUserId: this.options.selfUserId })
    } catch {}
  }

  private getOrCreatePeer(userId: string): PeerEntry {
    const existing = this.peers.get(userId)
    if (existing) return existing

    this.log('getOrCreatePeer', { targetUserId: userId })

    // DO NOT set iceCandidatePoolSize! Setting pool size pre-gathers candidates in Chromium
    // before event handlers are attached, swallowing trickle ICE candidates.
    const pc = new RTCPeerConnection({
      iceServers: this.options.getIceServers()
    })
    const entry: PeerEntry = {
      pc,
      remoteStream: new MediaStream(),
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      polite: this.options.selfUserId.localeCompare(userId) < 0,
      pendingCandidates: [],
      senders: new Map()
    }
    this.peers.set(userId, entry)

    // Event listeners
    pc.onicecandidate = event => {
      if (event.candidate) {
        const candidateInit: RTCIceCandidateInit = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment
        }
        this.log('icecandidate', { candidate: event.candidate.candidate?.slice(0, 50), targetUserId: userId })
        this.options.sendSignal(userId, { candidate: candidateInit })

        // If candidate contains an mDNS .local hash (Chrome privacy feature),
        // also send an unmasked direct LAN IP candidate so phones on Wi-Fi can connect!
        const candStr = event.candidate.candidate || ''
        if (candStr.includes('.local')) {
          const lanIp = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
            ? window.location.hostname
            : '192.168.1.3'
          const unmaskedCandidate = candStr.replace(/[a-f0-9-]+\.local/i, lanIp)
          this.log('sending unmasked LAN candidate', { lanIp, targetUserId: userId })
          this.options.sendSignal(userId, { candidate: { ...candidateInit, candidate: unmaskedCandidate } })
        }
      }
    }

    pc.ontrack = event => {
      this.log('ontrack', { kind: event.track.kind, id: event.track.id, streams: event.streams?.length || 0, fromUserId: userId })
      const track = event.track

      // Prefer native MediaStream provided by browser WebRTC stack to guarantee hardware decoder attachment on iOS Safari & mobile Chrome
      if (event.streams && event.streams[0]) {
        entry.remoteStream = event.streams[0]
      } else {
        if (!entry.remoteStream.getTracks().some(item => item.id === track.id)) {
          try { entry.remoteStream.addTrack(track) } catch {}
        }
      }

      const notify = () => {
        this.options.onRemoteStream(userId, entry.remoteStream)
      }

      track.onended = () => {
        this.log('track ended', { kind: track.kind, userId })
        notify()
      }
      track.onunmute = () => {
        this.log('track unmuted', { kind: track.kind, userId })
        notify()
      }
      track.onmute = () => {
        this.log('track muted', { kind: track.kind, userId })
        notify()
      }
      notify()
    }

    pc.onconnectionstatechange = () => {
      this.log('connectionStateChange', { state: pc.connectionState, userId })
      this.options.onPeerState(userId, pc.connectionState)
      if (pc.connectionState === 'failed') {
        this.log('restarting ICE due to failed connectionState', { userId })
        try { pc.restartIce() } catch { /* ignore */ }
      }
    }

    pc.oniceconnectionstatechange = () => {
      this.log('iceConnectionStateChange', { state: pc.iceConnectionState, userId })
    }

    // Canonical Perfect Negotiation negotiationneeded handler
    pc.onnegotiationneeded = async () => {
      try {
        this.log('onnegotiationneeded', { userId })
        entry.makingOffer = true
        await pc.setLocalDescription()
        this.options.sendSignal(userId, { description: pc.localDescription || undefined })
      } catch (error) {
        console.error(`[WebRTC] Negotiation failed for peer ${userId}:`, error)
      } finally {
        entry.makingOffer = false
      }
    }

    return entry
  }

  private ensureTransceivers(entry: PeerEntry) {
    const { pc } = entry
    const localStream = this.options.getLocalStream()
    const initialAudio = localStream?.getAudioTracks()[0] || null
    const initialVideo = localStream?.getVideoTracks()[0] || null

    const transceivers = pc.getTransceivers()
    const hasAudio = transceivers.some(t => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio')
    const hasVideo = transceivers.some(t => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video')

    if (!hasAudio) {
      try {
        const audioTransceiver = pc.addTransceiver(initialAudio || 'audio', {
          direction: 'sendrecv',
          streams: localStream ? [localStream] : []
        })
        entry.senders.set('audio', audioTransceiver.sender)
      } catch {
        if (initialAudio) {
          try {
            const s = pc.addTrack(initialAudio, localStream!)
            entry.senders.set('audio', s)
          } catch {}
        }
      }
    } else if (initialAudio) {
      const audioSender = entry.senders.get('audio')
      if (audioSender && audioSender.track !== initialAudio) {
        void audioSender.replaceTrack(initialAudio).catch(() => {})
      }
    }

    if (!hasVideo) {
      try {
        const videoTransceiver = pc.addTransceiver(initialVideo || 'video', {
          direction: 'sendrecv',
          streams: localStream ? [localStream] : []
        })
        entry.senders.set('video', videoTransceiver.sender)
      } catch {
        if (initialVideo) {
          try {
            const s = pc.addTrack(initialVideo, localStream!)
            entry.senders.set('video', s)
          } catch {}
        }
      }
    } else if (initialVideo) {
      const videoSender = entry.senders.get('video')
      if (videoSender && videoSender.track !== initialVideo) {
        void videoSender.replaceTrack(initialVideo).catch(() => {})
      }
    }
  }

  async createOffer(userId: string) {
    const entry = this.getOrCreatePeer(userId)
    const isInitial = entry.pc.getTransceivers().length === 0
    this.ensureTransceivers(entry)

    // If transceivers were added for the first time, pc.addTransceiver scheduled
    // onnegotiationneeded which will create and send the offer.
    // If transceivers already existed (e.g. renegotiation), trigger explicitly:
    if (!isInitial && entry.pc.signalingState === 'stable' && !entry.makingOffer) {
      try {
        this.log('manual createOffer renegotiation', { userId })
        entry.makingOffer = true
        await entry.pc.setLocalDescription()
        this.options.sendSignal(userId, { description: entry.pc.localDescription || undefined })
      } catch (error) {
        console.error(`[WebRTC] Could not create offer for peer ${userId}:`, error)
      } finally {
        entry.makingOffer = false
      }
    }
  }

  async handleSignal(userId: string, signal: SignalPayload) {
    if (!signal || (!signal.description && !signal.candidate)) return
    const entry = this.getOrCreatePeer(userId)
    const { pc } = entry

    if (signal.description) {
      const description = signal.description
      this.log('handleSignal: description', { type: description.type, userId })
      const readyForOffer = !entry.makingOffer && (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending)
      const offerCollision = description.type === 'offer' && !readyForOffer
      entry.ignoreOffer = !entry.polite && offerCollision
      if (entry.ignoreOffer) {
        this.log('ignoring offer collision (impolite)', { userId })
        return
      }

      try {
        entry.isSettingRemoteAnswerPending = description.type === 'answer'
        await pc.setRemoteDescription(description)
        entry.isSettingRemoteAnswerPending = false

        // Synchronize senders map with active transceivers
        for (const transceiver of pc.getTransceivers()) {
          const kind = (transceiver.receiver?.track?.kind || transceiver.sender?.track?.kind) as 'audio' | 'video' | undefined
          if (kind && transceiver.sender) {
            entry.senders.set(kind, transceiver.sender)
          }
        }

        if (description.type === 'offer') {
          // Attach local tracks to transceivers before answering
          const localStream = this.options.getLocalStream()
          const audioTrack = localStream?.getAudioTracks()[0] || null
          const videoTrack = localStream?.getVideoTracks()[0] || null

          const audioSender = entry.senders.get('audio')
          if (audioSender && audioTrack) {
            await audioSender.replaceTrack(audioTrack).catch(() => {})
          }
          const videoSender = entry.senders.get('video')
          if (videoSender && videoTrack) {
            await videoSender.replaceTrack(videoTrack).catch(() => {})
          }

          await pc.setLocalDescription()
          this.log('sending answer to offer', { userId })
          this.options.sendSignal(userId, { description: pc.localDescription || undefined })
        }

        // Apply any queued ICE candidates that arrived before the remote description
        for (const candidate of entry.pendingCandidates.splice(0)) {
          const candStr = candidate.candidate || ''
          if (candStr.includes('.local')) {
            const lanIp = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
              ? window.location.hostname
              : '192.168.1.3'
            const unmasked = candStr.replace(/[a-f0-9-]+\.local/i, lanIp)
            pc.addIceCandidate({ ...candidate, candidate: unmasked }).catch(() => {})
          }
          await pc.addIceCandidate(candidate).catch(e => console.warn('[WebRTC] Error adding pending ICE candidate:', e))
        }
      } catch (error) {
        entry.isSettingRemoteAnswerPending = false
        if (!entry.ignoreOffer) console.error(`[WebRTC] Could not apply description for peer ${userId}:`, error)
      }
      return
    }

    if (signal.candidate) {
      this.log('handleSignal: candidate', { candidate: signal.candidate.candidate?.slice(0, 40), userId })
      if (pc.remoteDescription && pc.remoteDescription.type) {
        const candStr = signal.candidate.candidate || ''
        if (candStr.includes('.local')) {
          const lanIp = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
            ? window.location.hostname
            : '192.168.1.3'
          const unmaskedCandidate = candStr.replace(/[a-f0-9-]+\.local/i, lanIp)
          pc.addIceCandidate({ ...signal.candidate, candidate: unmaskedCandidate }).catch(() => {})
        }
        await pc.addIceCandidate(signal.candidate).catch(error => {
          if (!entry.ignoreOffer) console.warn(`[WebRTC] Could not add ICE candidate for peer ${userId}:`, error)
        })
      } else {
        entry.pendingCandidates.push(signal.candidate)
      }
    }
  }

  replaceTrack(kind: 'audio' | 'video', track: MediaStreamTrack | null) {
    for (const [userId, entry] of this.peers.entries()) {
      const sender = entry.senders.get(kind)
      if (sender) {
        this.log(`replaceTrack: replacing ${kind}`, { track: track ? track.id : 'null', userId })
        void sender.replaceTrack(track).catch(error => console.warn(`[WebRTC] Could not replace ${kind} track:`, error))
      } else if (track) {
        this.log(`replaceTrack: no existing sender, adding new ${kind} track`, { userId })
        const stream = this.options.getLocalStream() || new MediaStream([track])
        try {
          const newSender = entry.pc.addTrack(track, stream)
          entry.senders.set(kind, newSender)
        } catch (e) {
          console.warn(`[WebRTC] Error adding ${kind} track:`, e)
        }
      }
    }
  }

  syncLocalTracks() {
    const stream = this.options.getLocalStream()
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0] || null
    const videoTrack = stream.getVideoTracks()[0] || null

    for (const [userId, entry] of this.peers.entries()) {
      if (audioTrack) {
        const audioSender = entry.senders.get('audio')
        if (audioSender && audioSender.track !== audioTrack) {
          void audioSender.replaceTrack(audioTrack).catch(() => {})
        }
      }
      if (videoTrack) {
        const videoSender = entry.senders.get('video')
        if (videoSender && videoSender.track !== videoTrack) {
          void videoSender.replaceTrack(videoTrack).catch(() => {})
        }
      }
    }
  }

  closePeer(userId: string) {
    const entry = this.peers.get(userId)
    if (!entry) return
    entry.pc.onicecandidate = null
    entry.pc.ontrack = null
    entry.pc.onconnectionstatechange = null
    entry.pc.oniceconnectionstatechange = null
    entry.pc.onnegotiationneeded = null
    try { entry.pc.close() } catch { /* ignore */ }
    for (const track of entry.remoteStream.getTracks()) {
      try { entry.remoteStream.removeTrack(track) } catch { /* ignore */ }
    }
    this.peers.delete(userId)
  }

  closeAll() {
    for (const userId of [...this.peers.keys()]) this.closePeer(userId)
  }
}

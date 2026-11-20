type ToneKind = 'incoming' | 'outgoing'

class RingtoneEngine {
  private context: AudioContext | null = null
  private interval: number | null = null
  private nodes = new Set<OscillatorNode>()
  private kind: ToneKind | null = null

  private ensureContext() {
    if (typeof window === 'undefined') return null
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return null
    if (!this.context) this.context = new AudioContextClass()
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    return this.context
  }

  unlock() {
    const context = this.ensureContext()
    if (context?.state === 'suspended') void context.resume().catch(() => {})
  }

  private beep(frequency: number, startDelay: number, duration: number, volume = 0.06, type: OscillatorType = 'sine') {
    const context = this.ensureContext()
    if (!context) return
    const start = context.currentTime + startDelay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025)
    gain.gain.setValueAtTime(volume, start + duration - 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
    this.nodes.add(oscillator)
    oscillator.onended = () => {
      this.nodes.delete(oscillator)
      try { gain.disconnect() } catch { /* ignore */ }
    }
  }

  private playPattern(kind: ToneKind) {
    if (kind === 'incoming') {
      this.beep(660, 0, 0.42, 0.05)
      this.beep(880, 0, 0.42, 0.04)
      this.beep(660, 0.55, 0.42, 0.05)
      this.beep(880, 0.55, 0.42, 0.04)
    } else {
      this.beep(440, 0, 0.7, 0.035)
      this.beep(480, 0.05, 0.7, 0.02)
    }
  }

  start(kind: ToneKind) {
    if (this.kind === kind) return
    this.stop()
    this.kind = kind
    this.ensureContext()
    this.playPattern(kind)
    const intervalMs = kind === 'incoming' ? 2600 : 3200
    this.interval = window.setInterval(() => this.playPattern(kind), intervalMs)
  }

  stop() {
    this.kind = null
    if (this.interval !== null) {
      window.clearInterval(this.interval)
      this.interval = null
    }
    for (const node of this.nodes) {
      try { node.stop() } catch { /* ignore */ }
    }
    this.nodes.clear()
  }

  playJoin() {
    this.beep(523.25, 0, 0.12, 0.04)
    this.beep(659.25, 0.11, 0.14, 0.04)
    this.beep(783.99, 0.22, 0.18, 0.04)
  }

  playLeave() {
    this.beep(783.99, 0, 0.12, 0.04)
    this.beep(659.25, 0.1, 0.14, 0.04)
    this.beep(523.25, 0.2, 0.2, 0.035)
  }

  playMute() {
    this.beep(320, 0, 0.08, 0.03, 'triangle')
  }

  playUnmute() {
    this.beep(620, 0, 0.08, 0.03, 'triangle')
  }

  playError() {
    this.beep(220, 0, 0.2, 0.05, 'sawtooth')
  }
}

export const ringtone = new RingtoneEngine()

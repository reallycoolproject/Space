import { useEffect, useState } from 'react'
import { Mic, RefreshCw, Speaker, Video, X } from 'lucide-react'
import { useCall } from './CallContext'

interface CallSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CallSettingsModal({ isOpen, onClose }: CallSettingsModalProps) {
  const {
    devices,
    selectedDevices,
    switchDevice,
    refreshDevices,
    mediaError,
    clearMediaError
  } = useCall()
  const [switching, setSwitching] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setRefreshing(true)
    void refreshDevices().finally(() => setRefreshing(false))
  }, [isOpen, refreshDevices])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const change = async (kind: 'microphone' | 'camera' | 'speaker', deviceId: string) => {
    setSwitching(kind)
    try {
      await switchDevice(kind, deviceId)
    } finally {
      setSwitching('')
    }
  }

  const selectClass = 'mt-1.5 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--app-accent)] disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-settings-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
          <div>
            <h2 id="call-settings-title" className="text-lg font-bold text-[var(--text-primary)]">Voice & video</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Choose the devices Space should use for calls and voice channels.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close voice settings" className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {mediaError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              <span>{mediaError}</span>
              <button type="button" onClick={clearMediaError} aria-label="Dismiss media error" className="shrink-0 font-semibold hover:underline">Dismiss</button>
            </div>
          )}

          <label className="block">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Mic className="h-4 w-4 text-[var(--app-accent)]" /> Microphone</span>
            <select
              value={selectedDevices.microphoneId}
              onChange={event => void change('microphone', event.target.value)}
              disabled={switching === 'microphone'}
              className={selectClass}
            >
              <option value="">System default</option>
              {devices.microphones.map(device => <option key={device.deviceId || device.label} value={device.deviceId}>{device.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Video className="h-4 w-4 text-[var(--app-accent)]" /> Camera</span>
            <select
              value={selectedDevices.cameraId}
              onChange={event => void change('camera', event.target.value)}
              disabled={switching === 'camera'}
              className={selectClass}
            >
              <option value="">System default</option>
              {devices.cameras.map(device => <option key={device.deviceId || device.label} value={device.deviceId}>{device.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Speaker className="h-4 w-4 text-[var(--app-accent)]" /> Speaker</span>
            <select
              value={selectedDevices.speakerId}
              onChange={event => void change('speaker', event.target.value)}
              disabled={switching === 'speaker'}
              className={selectClass}
            >
              <option value="">System default</option>
              {devices.speakers.map(device => <option key={device.deviceId || device.label} value={device.deviceId}>{device.label}</option>)}
            </select>
            {devices.speakers.length === 0 && (
              <span className="mt-1.5 block text-[11px] text-[var(--text-secondary)]">Speaker selection is not available in this browser. Your system default output will be used.</span>
            )}
          </label>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-[11px] leading-5 text-[var(--text-secondary)]">
            Space uses echo cancellation and noise suppression automatically. If you change a device mid-call, the new track is swapped into the live call without reconnecting.
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true)
              void refreshDevices().finally(() => setRefreshing(false))
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh devices
          </button>
          <button type="button" onClick={onClose} className="frutiger-btn frutiger-btn-primary rounded-lg px-4 py-2 text-sm font-bold text-white">Done</button>
        </div>
      </div>
    </div>
  )
}

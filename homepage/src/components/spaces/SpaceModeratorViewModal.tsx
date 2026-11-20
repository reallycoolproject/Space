import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface SpaceModerationDetails {
  joinedAt?: string | null
  mutedUntil?: string | null
  accountCreatedAt?: string | null
  messageCount: number
  lastMessageAt?: string | null
  messagesByChannel: Array<{ channelId: string; channelName: string; count: number }>
}

interface SpaceModeratorViewModalProps {
  displayName: string
  details: SpaceModerationDetails | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onClose: () => void
}

const formatDate = (value?: string | null, includeTime = false) =>
  value ? new Date(value).toLocaleString(undefined, includeTime ? undefined : { dateStyle: 'medium' }) : 'Unknown'

export function SpaceModeratorViewModal({ displayName, details, loading = false, error, onRefresh, onClose }: SpaceModeratorViewModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="space-moderator-view-title" className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-accent)]">Space moderation</p>
            <h2 id="space-moderator-view-title" className="truncate text-lg font-bold">{displayName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && <button type="button" onClick={onRefresh} disabled={loading} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--app-surface)] disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>}
            <button type="button" onClick={onClose} aria-label="Close moderator view" className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--app-surface)]"><X size={17} /></button>
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          {loading && !details ? <p className="py-10 text-center text-sm text-[var(--text-secondary)]">Loading moderation details…</p> : error && !details ? <p role="alert" className="py-10 text-center text-sm text-red-300">{error}</p> : details ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Space joined" value={formatDate(details.joinedAt)} />
              <Metric label="Account created" value={formatDate(details.accountCreatedAt)} />
              <Metric label="Messages sent" value={details.messageCount.toLocaleString()} />
              <Metric label="Last message" value={formatDate(details.lastMessageAt, true)} />
              <Metric label="Timeout status" value={details.mutedUntil && new Date(details.mutedUntil) > new Date() ? `Until ${formatDate(details.mutedUntil, true)}` : 'Not timed out'} />
            </div>
            <section className="mt-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Messages by channel</h3>
              {details.messagesByChannel.length ? <div className="space-y-2">
                {details.messagesByChannel.map(channel => <div key={channel.channelId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">#{channel.channelName}</span><strong className="shrink-0">{channel.count.toLocaleString()}</strong>
                </div>)}
              </div> : <p className="text-sm text-[var(--text-secondary)]">No messages recorded.</p>}
            </section>
          </> : <p role="alert" className="py-10 text-center text-sm text-[var(--text-secondary)]">Moderation details are unavailable. Try refreshing.</p>}
        </div>
      </section>
    </div>,
    document.body
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold">{value}</p>
  </div>
}

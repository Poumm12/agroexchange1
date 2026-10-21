'use client'
import type { RouteRequest } from '@/types'
import { useActiveRequests, useTransportEvents, TRANSPORT_FLOW, progressForStatus } from '@/hooks/useTransport'
import { Card } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState } from './shared'

export function TransportTracking({ userId }: { userId?: string }) {
  const { requests, loading } = useActiveRequests(userId)

  if (loading) return <TransportSkeleton rows={2} />
  if (!requests.length) {
    return (
      <EmptyState
        icon={<Icons.pin className="w-6 h-6" />}
        title="Καμία ενεργή μεταφορά"
        message="Όταν ένα αίτημά σας γίνει αποδεκτό από μεταφορέα, θα μπορείτε να παρακολουθείτε εδώ την πρόοδό του σε πραγματικό χρόνο."
      />
    )
  }

  return (
    <div className="space-y-3">
      {requests.map(r => <TrackingCard key={r.id} request={r} />)}
    </div>
  )
}

function TrackingCard({ request: r }: { request: RouteRequest }) {
  const { events, loading } = useTransportEvents(r.id)
  const progress = progressForStatus(r.status)
  const currentIdx = TRANSPORT_FLOW.findIndex(s => s.status === r.status)

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <div className="font-bold text-gray-900">{r.product || 'Μεταφορά'}</div>
          <div className="text-xs text-gray-500">{r.from_location} → {r.to_location}</div>
        </div>
        <span className="font-display font-black text-agro-700 text-lg">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-agro-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Timeline */}
      <ol className="space-y-0">
        {TRANSPORT_FLOW.map((step, i) => {
          const done = i <= currentIdx
          const isCurrent = i === currentIdx
          // Real event timestamp, if recorded.
          const evt = events.find(e => e.status === step.status)
          return (
            <li key={step.status} className="flex items-start gap-3 pb-3 last:pb-0 relative">
              {i < TRANSPORT_FLOW.length - 1 && (
                <span className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${done ? 'bg-agro-300' : 'bg-gray-100'}`} aria-hidden="true" />
              )}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                done ? 'bg-agro-500 text-white' : 'bg-gray-100 text-gray-300'
              } ${isCurrent ? 'ring-4 ring-agro-100' : ''}`}>
                {done ? <Icons.check className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className={`text-sm ${done ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{step.label}</div>
                {evt && <div className="text-[11px] text-gray-400">{new Date(evt.created_at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}</div>}
              </div>
            </li>
          )
        })}
      </ol>

      {loading && <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mt-2" aria-hidden="true" />}
    </Card>
  )
}

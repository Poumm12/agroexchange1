'use client'
import { useState, useMemo } from 'react'
import type { RouteRequest } from '@/types'
import { useMyRequests } from '@/hooks/useTransport'
import { Card, Button } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState, Stars } from './shared'
import { TransportReviewModal } from './TransportReviewModal'

export function TransportReviews({ userId }: { userId?: string }) {
  const { requests, loading, reload } = useMyRequests(userId)
  const [target, setTarget] = useState<RouteRequest | null>(null)

  // Delivered transfers that have an assigned transporter → reviewable.
  const reviewable = useMemo(
    () => requests.filter(r => r.status === 'delivered' && r.assigned_transporter_id),
    [requests]
  )

  if (loading) return <TransportSkeleton rows={2} />
  if (!reviewable.length) {
    return (
      <EmptyState
        icon={<Icons.star className="w-6 h-6" />}
        title="Δεν υπάρχουν μεταφορές προς αξιολόγηση"
        message="Μετά την ολοκλήρωση μιας μεταφοράς, θα μπορείτε να αξιολογήσετε τον μεταφορέα σε συνέπεια, ταχύτητα, επικοινωνία και κατάσταση φορτίου."
      />
    )
  }

  return (
    <div className="space-y-3">
      {reviewable.map(r => {
        const t = r.transporter
        const name = t?.company_name || t?.user?.full_name || 'Μεταφορέας'
        return (
          <Card key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-sm">{r.product || 'Μεταφορά'}</div>
              <div className="text-xs text-gray-500">{r.from_location} → {r.to_location} · {name}</div>
              {t && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Stars value={t.rating} size="xs" />
                  <span className="text-[11px] text-gray-400">{t.rating.toFixed(1)} ({t.rating_count} αξιολογήσεις)</span>
                </div>
              )}
            </div>
            <Button size="sm" onClick={() => setTarget(r)} icon={<Icons.star className="w-4 h-4" />}>Αξιολόγηση</Button>
          </Card>
        )
      })}

      {target && target.assigned_transporter_id && userId && (
        <TransportReviewModal
          requestId={target.id}
          transporterId={target.assigned_transporter_id}
          reviewerId={userId}
          onClose={() => setTarget(null)}
          onSubmitted={reload}
        />
      )}
    </div>
  )
}

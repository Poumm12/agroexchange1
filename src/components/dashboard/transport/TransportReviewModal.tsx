'use client'
import { useState, useEffect } from 'react'
import { submitTransportReview } from '@/hooks/useTransport'
import { Card, Button, StarInput } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

const CRITERIA: { key: 'reliability' | 'speed' | 'communication' | 'cargo_condition'; label: string }[] = [
  { key: 'reliability',     label: 'Συνέπεια' },
  { key: 'speed',           label: 'Ταχύτητα' },
  { key: 'communication',   label: 'Επικοινωνία' },
  { key: 'cargo_condition', label: 'Κατάσταση φορτίου' },
]

export function TransportReviewModal({
  requestId, transporterId, reviewerId, onClose, onSubmitted,
}: {
  requestId: string; transporterId: string; reviewerId: string
  onClose: () => void; onSubmitted?: () => void
}) {
  const [scores, setScores] = useState({ reliability: 0, speed: 0, communication: 0, cargo_condition: 0 })
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  async function handleSubmit() {
    if (Object.values(scores).some(v => v === 0)) { toast.error('Βαθμολογήστε και τα 4 κριτήρια'); return }
    setSaving(true)
    const { error } = await submitTransportReview({ request_id: requestId, transporter_id: transporterId, reviewer_id: reviewerId, ...scores, comment: comment.trim() })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ευχαριστούμε για την αξιολόγηση!')
    onSubmitted?.(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Αξιολόγηση μεταφορέα">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-extrabold text-gray-900 text-lg">Αξιολόγηση Μεταφοράς</h3>
          <button onClick={onClose} aria-label="Κλείσιμο" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"><Icons.x className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {CRITERIA.map(c => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{c.label}</span>
              <StarInput value={scores[c.key]} onChange={v => setScores(s => ({ ...s, [c.key]: v }))} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Σχόλιο (προαιρετικό)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={500}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-agro-500 focus:ring-2 focus:ring-agro-100" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} loading={saving}>Υποβολή</Button>
            <Button variant="ghost" onClick={onClose}>Άκυρο</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

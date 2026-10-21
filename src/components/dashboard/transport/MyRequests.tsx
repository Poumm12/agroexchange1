'use client'
import { useState } from 'react'
import type { RouteRequest } from '@/types'
import { useMyRequests, progressForStatus } from '@/hooks/useTransport'
import { Card, Badge, Button, Input } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState } from './shared'
import { sanitizeInput, validateText } from '@/lib/moderation'
import toast from 'react-hot-toast'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Σε αναμονή', accepted: 'Αποδεκτό', scheduled: 'Προγραμματισμένο',
  picked_up: 'Παραλήφθηκε', in_transit: "Καθ' οδόν", delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
}
const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  pending: 'warning', accepted: 'info', scheduled: 'info',
  picked_up: 'info', in_transit: 'info', delivered: 'success', cancelled: 'danger',
}

const BLANK = {
  product: '', quantity_tons: '', unit: 'ton' as 'kg' | 'ton',
  from_location: '', to_location: '', preferred_date: '', preferred_time: '',
  cargo_type: '', transport_mode: '', max_cost: '', special_requirements: '', notes: '',
}

export function MyRequests({ userId }: { userId?: string }) {
  const { requests, loading, createRequest, updateRequest, cancelRequest, deleteRequest } = useMyRequests(userId)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...BLANK })

  function resetForm() { setForm({ ...BLANK }); setEditingId(null); setShowForm(false) }

  function startEdit(r: RouteRequest) {
    setForm({
      product: r.product ?? '', quantity_tons: String(r.quantity_tons ?? ''),
      unit: (r.unit ?? 'ton') as 'kg' | 'ton',
      from_location: r.from_location, to_location: r.to_location,
      preferred_date: r.preferred_date ?? '', preferred_time: r.preferred_time ?? '',
      cargo_type: r.cargo_type ?? '', transport_mode: r.transport_mode ?? '',
      max_cost: String(r.max_cost ?? ''), special_requirements: r.special_requirements ?? '',
      notes: r.notes ?? '',
    })
    setEditingId(r.id); setShowForm(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) { toast.error('Συνδεθείτε πρώτα'); return }
    if (!form.product.trim()) { toast.error('Το προϊόν είναι υποχρεωτικό'); return }
    if (!form.from_location.trim() || !form.to_location.trim()) { toast.error('Συμπληρώστε σημεία φόρτωσης και παράδοσης'); return }
    const notesCheck = validateText(form.notes, { maxLength: 1000 })
    if (!notesCheck.ok) { toast.error(notesCheck.error!); return }

    setSaving(true)
    const payload: Partial<RouteRequest> = {
      product: sanitizeInput(form.product),
      quantity_tons: Number(form.quantity_tons) || 0,
      unit: form.unit,
      from_location: sanitizeInput(form.from_location),
      to_location: sanitizeInput(form.to_location),
      preferred_date: form.preferred_date || undefined,
      preferred_time: form.preferred_time || undefined,
      cargo_type: sanitizeInput(form.cargo_type),
      transport_mode: sanitizeInput(form.transport_mode),
      max_cost: form.max_cost ? Number(form.max_cost) : null,
      special_requirements: sanitizeInput(form.special_requirements),
      notes: sanitizeInput(form.notes),
    }

    if (editingId) {
      const error = await updateRequest(editingId, payload)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Το αίτημα ενημερώθηκε')
    } else {
      const { error } = await createRequest({ ...payload, user_id: userId, status: 'pending' })
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Το αίτημα δημιουργήθηκε')
    }
    resetForm()
  }

  async function handleCancel(r: RouteRequest) {
    if (typeof window !== 'undefined' && !window.confirm('Ακύρωση αυτού του αιτήματος;')) return
    const error = await cancelRequest(r.id)
    if (error) toast.error(error.message); else toast.success('Το αίτημα ακυρώθηκε')
  }

  async function handleDelete(r: RouteRequest) {
    if (typeof window !== 'undefined' && !window.confirm('Οριστική διαγραφή; Η ενέργεια δεν αναιρείται.')) return
    const error = await deleteRequest(r.id)
    if (error) toast.error(error.message); else toast.success('Το αίτημα διαγράφηκε')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-gray-900">Τα Αιτήματά μου</h3>
        <Button
          onClick={() => (showForm ? resetForm() : (setEditingId(null), setForm({ ...BLANK }), setShowForm(true)))}
          icon={<Icons.plus className="w-4 h-4" />}
        >
          Νέο Αίτημα
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 sm:p-5">
          <h4 className="font-bold text-gray-900 mb-4 text-sm">{editingId ? 'Επεξεργασία Αιτήματος' : 'Νέο Αίτημα Μεταφοράς'}</h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Προϊόν *" value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="π.χ. Σιτάρι" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Ποσότητα" type="number" value={form.quantity_tons} onChange={e => setForm(f => ({ ...f, quantity_tons: e.target.value }))} />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Μονάδα</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as 'kg' | 'ton' }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-100">
                  <option value="ton">Τόνοι</option>
                  <option value="kg">Κιλά</option>
                </select>
              </div>
            </div>
            <Input label="Σημείο φόρτωσης *" value={form.from_location} onChange={e => setForm(f => ({ ...f, from_location: e.target.value }))} placeholder="π.χ. Λάρισα" />
            <Input label="Σημείο παράδοσης *" value={form.to_location} onChange={e => setForm(f => ({ ...f, to_location: e.target.value }))} placeholder="π.χ. Θεσσαλονίκη" />
            <Input label="Ημερομηνία" type="date" value={form.preferred_date} onChange={e => setForm(f => ({ ...f, preferred_date: e.target.value }))} />
            <Input label="Επιθυμητή ώρα" type="time" value={form.preferred_time} onChange={e => setForm(f => ({ ...f, preferred_time: e.target.value }))} />
            <Input label="Τύπος φορτίου" value={form.cargo_type} onChange={e => setForm(f => ({ ...f, cargo_type: e.target.value }))} placeholder="π.χ. Χύδην" />
            <Input label="Μέσο μεταφοράς" value={form.transport_mode} onChange={e => setForm(f => ({ ...f, transport_mode: e.target.value }))} placeholder="π.χ. Φορτηγό ψυγείο" />
            <Input label="Μέγιστο κόστος (€)" type="number" value={form.max_cost} onChange={e => setForm(f => ({ ...f, max_cost: e.target.value }))} />
            <Input label="Ειδικές απαιτήσεις" value={form.special_requirements} onChange={e => setForm(f => ({ ...f, special_requirements: e.target.value }))} />
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Σημειώσεις</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-agro-500 focus:ring-2 focus:ring-agro-100" />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" loading={saving}>{editingId ? 'Αποθήκευση' : 'Δημιουργία'}</Button>
              <Button variant="ghost" type="button" onClick={resetForm}>Ακύρωση</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <TransportSkeleton rows={3} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Icons.package className="w-6 h-6" />}
          title="Δεν έχετε αιτήματα μεταφοράς"
          message="Δημιουργήστε το πρώτο σας αίτημα μεταφοράς για να λάβετε προσφορές από μεταφορείς."
          ctaLabel="Νέο Αίτημα"
          onCta={() => { setEditingId(null); setForm({ ...BLANK }); setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{r.product || 'Μεταφορά'}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {r.from_location} → {r.to_location}
                    {r.quantity_tons ? ` · ${r.quantity_tons} ${r.unit === 'kg' ? 'κιλά' : 'τόνοι'}` : ''}
                    {r.preferred_date ? ` · ${new Date(r.preferred_date).toLocaleDateString('el-GR')}` : ''}
                  </div>
                  {r.max_cost ? <div className="text-xs text-gray-400 mt-0.5">Μέγ. κόστος: {r.max_cost.toLocaleString('el-GR')} €</div> : null}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {r.status !== 'delivered' && r.status !== 'cancelled' && (
                    <>
                      <button onClick={() => startEdit(r)} aria-label="Επεξεργασία"
                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"><Icons.edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleCancel(r)} aria-label="Ακύρωση"
                        className="p-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"><Icons.x className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                  <button onClick={() => handleDelete(r)} aria-label="Διαγραφή"
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"><Icons.trash className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {/* Progress (real, from status) */}
              {r.status !== 'cancelled' && (
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden" aria-label={`Πρόοδος ${progressForStatus(r.status)}%`}>
                  <div className="h-full bg-agro-500 rounded-full transition-all" style={{ width: `${progressForStatus(r.status)}%` }} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

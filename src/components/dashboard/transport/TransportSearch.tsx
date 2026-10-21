'use client'
import { useState, useMemo } from 'react'
import type { Transporter } from '@/types'
import { useTransporters } from '@/hooks/useTransport'
import { Card, Button, Input } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState, Stars } from './shared'

interface SearchFilters {
  from: string; to: string; product: string; quantity: string
  date: string; cargoType: string; mode: string; maxCost: string
}
const BLANK: SearchFilters = { from: '', to: '', product: '', quantity: '', date: '', cargoType: '', mode: '', maxCost: '' }

export function TransportSearch({ onRequest }: { onRequest: () => void }) {
  const { transporters, loading } = useTransporters()
  const [filters, setFilters] = useState<SearchFilters>({ ...BLANK })
  const [searched, setSearched] = useState(false)

  const set = (k: keyof SearchFilters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters(f => ({ ...f, [k]: e.target.value }))

  // Match transporters against the filters (real DB data only).
  const results = useMemo(() => {
    let list = transporters.filter(t => t.available)
    const inAreas = (t: Transporter, q: string) =>
      (t.service_areas ?? []).some(a => a.toLowerCase().includes(q)) ||
      t.from_location.toLowerCase().includes(q) || t.to_location.toLowerCase().includes(q)
    if (filters.from.trim()) { const q = filters.from.toLowerCase(); list = list.filter(t => inAreas(t, q)) }
    if (filters.to.trim())   { const q = filters.to.toLowerCase();   list = list.filter(t => inAreas(t, q)) }
    if (filters.cargoType.trim()) { const q = filters.cargoType.toLowerCase(); list = list.filter(t => (t.cargo_types ?? []).some(c => c.toLowerCase().includes(q))) }
    if (filters.mode.trim()) { const q = filters.mode.toLowerCase(); list = list.filter(t => (t.vehicles ?? []).some(v => v.toLowerCase().includes(q)) || t.vehicle_type.toLowerCase().includes(q)) }
    if (filters.quantity.trim()) { const q = Number(filters.quantity); if (q > 0) list = list.filter(t => t.capacity_tons >= q) }
    if (filters.maxCost.trim()) { const c = Number(filters.maxCost); if (c > 0) list = list.filter(t => t.price_per_trip <= c) }
    return list
  }, [transporters, filters])

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="font-bold text-gray-900 mb-4 text-sm">Αναζήτηση Μεταφοράς</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input label="Από" value={filters.from} onChange={set('from')} placeholder="Αφετηρία" />
          <Input label="Προς" value={filters.to} onChange={set('to')} placeholder="Προορισμός" />
          <Input label="Προϊόν" value={filters.product} onChange={set('product')} placeholder="π.χ. Σιτάρι" />
          <Input label="Ποσότητα (τόνοι)" type="number" value={filters.quantity} onChange={set('quantity')} />
          <Input label="Ημερομηνία" type="date" value={filters.date} onChange={set('date')} />
          <Input label="Τύπος φορτίου" value={filters.cargoType} onChange={set('cargoType')} placeholder="π.χ. Χύδην" />
          <Input label="Μέσο μεταφοράς" value={filters.mode} onChange={set('mode')} placeholder="π.χ. Ψυγείο" />
          <Input label="Μέγιστο κόστος (€)" type="number" value={filters.maxCost} onChange={set('maxCost')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setSearched(true)} icon={<Icons.search className="w-4 h-4" />}>Αναζήτηση</Button>
          <Button variant="ghost" onClick={() => { setFilters({ ...BLANK }); setSearched(false) }}>Καθαρισμός</Button>
        </div>
      </Card>

      {loading ? (
        <TransportSkeleton rows={3} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Icons.search className="w-6 h-6" />}
          title={searched ? 'Δεν βρέθηκαν διαθέσιμοι μεταφορείς' : 'Ξεκινήστε την αναζήτηση'}
          message={searched
            ? 'Δοκιμάστε διαφορετικά φίλτρα ή δημιουργήστε αίτημα μεταφοράς για να σας βρουν οι μεταφορείς.'
            : 'Συμπληρώστε τα φίλτρα και πατήστε «Αναζήτηση» για να δείτε διαθέσιμους μεταφορείς.'}
          ctaLabel={searched ? 'Δημιουργία Αιτήματος' : undefined}
          onCta={searched ? onRequest : undefined}
        />
      ) : (
        <div className="space-y-3">
          {results.map(t => {
            const name = t.company_name || t.user?.full_name || 'Μεταφορέας'
            return (
              <Card key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {t.logo_url
                    ? <img src={t.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-11 h-11 rounded-xl bg-agro-50 text-agro-700 font-display font-black flex items-center justify-center flex-shrink-0" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>}
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{name}</div>
                    <div className="flex items-center gap-1.5">
                      <Stars value={t.rating} size="xs" />
                      <span className="text-[11px] text-gray-400">{t.rating.toFixed(1)} · {(t.service_areas ?? []).slice(0, 2).join(', ') || `${t.from_location}→${t.to_location}`}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center sm:text-right text-xs">
                  <div><div className="text-gray-400">Χωρητικότητα</div><div className="font-semibold text-gray-700">{t.capacity_tons} τ.</div></div>
                  <div><div className="text-gray-400">Εκτ. κόστος</div><div className="font-semibold text-gray-700">{t.price_per_trip ? `${t.price_per_trip.toLocaleString('el-GR')} €` : '—'}</div></div>
                  <div className="flex items-center justify-center sm:justify-end">
                    <Button size="sm" onClick={onRequest}>Αίτημα</Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

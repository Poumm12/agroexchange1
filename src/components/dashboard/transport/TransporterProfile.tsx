'use client'
import { useEffect } from 'react'
import type { Transporter } from '@/types'
import { useTransporterReviews } from '@/hooks/useTransport'
import { Badge } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { Stars } from './shared'

const CRITERIA: { key: 'reliability' | 'speed' | 'communication' | 'cargo_condition'; label: string }[] = [
  { key: 'reliability',     label: 'Συνέπεια' },
  { key: 'speed',           label: 'Ταχύτητα' },
  { key: 'communication',   label: 'Επικοινωνία' },
  { key: 'cargo_condition', label: 'Κατάσταση φορτίου' },
]

export function TransporterProfile({ transporter: t, onClose }: { transporter: Transporter; onClose: () => void }) {
  const { reviews, loading } = useTransporterReviews(t.id)
  const name = t.company_name || t.user?.full_name || 'Μεταφορέας'

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  // Per-criterion averages from real reviews.
  const criteriaAvg = CRITERIA.map(c => {
    const vals = reviews.map(r => r[c.key]).filter(v => typeof v === 'number')
    return { ...c, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }
  })

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={`Προφίλ μεταφορέα ${name}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl animate-[slideIn_0.25s_ease-out]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-display font-extrabold text-gray-900 text-lg">Προφίλ Μεταφορέα</h3>
          <button onClick={onClose} aria-label="Κλείσιμο" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <Icons.x className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-3">
            {t.logo_url
              ? <img src={t.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
              : <div className="w-16 h-16 rounded-2xl bg-agro-50 text-agro-700 font-display font-black text-2xl flex items-center justify-center" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900">{name}</span>
                {t.verified && <Icons.check className="w-4 h-4 text-agro-600" aria-label="Πιστοποιημένος" />}
              </div>
              {t.company_name && t.user?.full_name && <div className="text-xs text-gray-400">{t.user.full_name}</div>}
              <div className="flex items-center gap-1.5 mt-1">
                <Stars value={t.rating} />
                <span className="text-xs text-gray-500">{t.rating.toFixed(1)} ({t.rating_count})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {t.available ? <Badge variant="success">Διαθέσιμος</Badge> : <Badge variant="default">Μη διαθέσιμος</Badge>}
                {t.insured && <Badge variant="info">Ασφαλισμένη μεταφορά</Badge>}
                {t.adr_certified && <Badge variant="warning">ADR</Badge>}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="font-display font-black text-gray-900 text-2xl">{t.total_trips}</div>
              <div className="text-[11px] text-gray-400">Συνολικές μεταφορές</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="font-display font-black text-gray-900 text-2xl">{t.rating.toFixed(1)}</div>
              <div className="text-[11px] text-gray-400">Συνολική βαθμολογία</div>
            </div>
          </div>

          {/* Details */}
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Στοιχεία</h4>
            <dl className="space-y-1.5 text-sm">
              {!!t.years_experience && <Row label="Εμπειρία" value={`${t.years_experience} έτη`} />}
              <Row label="Μέγιστη χωρητικότητα" value={`${t.capacity_tons} τόνοι`} />
              {t.description && <Row label="Περιγραφή" value={t.description} />}
            </dl>
          </section>

          {/* Fleet */}
          {!!(t.vehicles?.length) && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Στόλος</h4>
              <div className="flex flex-wrap gap-1.5">
                {t.vehicles!.map((v, i) => <Badge key={i} variant="default">{v}</Badge>)}
              </div>
            </section>
          )}

          {/* Areas */}
          {!!(t.service_areas?.length) && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Περιοχές εξυπηρέτησης</h4>
              <div className="flex flex-wrap gap-1.5">
                {t.service_areas!.map((a, i) => <Badge key={i} variant="info">{a}</Badge>)}
              </div>
            </section>
          )}

          {/* Cargo types */}
          {!!(t.cargo_types?.length) && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Τύποι φορτίων</h4>
              <div className="flex flex-wrap gap-1.5">
                {t.cargo_types!.map((c, i) => <Badge key={i} variant="default">{c}</Badge>)}
              </div>
            </section>
          )}

          {/* Ratings breakdown */}
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Αξιολογήσεις</h4>
            {loading ? (
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" aria-hidden="true" />
            ) : reviews.length === 0 ? (
              <p className="text-xs text-gray-400">Δεν υπάρχουν αξιολογήσεις ακόμη.</p>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {criteriaAvg.map(c => (
                    <div key={c.key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-32 flex-shrink-0">{c.label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-agro-500 rounded-full" style={{ width: `${(c.avg / 5) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{c.avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {reviews.slice(0, 10).map(r => {
                    const overall = (r.reliability + r.speed + r.communication + r.cargo_condition) / 4
                    return (
                      <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <Stars value={overall} size="xs" />
                          <span className="text-[11px] text-gray-400">{new Date(r.created_at).toLocaleDateString('el-GR')}</span>
                        </div>
                        {r.comment && <p className="text-xs text-gray-600 mt-1">{r.comment}</p>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-gray-800 text-right">{value}</dd>
    </div>
  )
}

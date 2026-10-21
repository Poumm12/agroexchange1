'use client'
import { useState, useMemo, useCallback } from 'react'
import type { RouteRequest } from '@/types'
import { useMyRequests } from '@/hooks/useTransport'
import { Card } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState } from './shared'

type SortKey = 'newest' | 'oldest' | 'cost_low' | 'cost_high' | 'duration'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',    label: 'Νεότερες' },
  { value: 'oldest',    label: 'Παλαιότερες' },
  { value: 'cost_low',  label: 'Χαμηλότερο κόστος' },
  { value: 'cost_high', label: 'Υψηλότερο κόστος' },
  { value: 'duration',  label: 'Συντομότερη διάρκεια' },
]

function durationDays(r: RouteRequest): number | null {
  if (!r.completed_at || !r.created_at) return null
  const d = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 86400000
  return d >= 0 ? +d.toFixed(1) : null
}

export function TransportHistory({ userId }: { userId?: string }) {
  const { requests, loading } = useMyRequests(userId)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  const completed = useMemo(() => requests.filter(r => r.status === 'delivered'), [requests])

  const visible = useMemo(() => {
    let list = completed.slice()
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r =>
      (r.product ?? '').toLowerCase().includes(q) ||
      r.from_location.toLowerCase().includes(q) ||
      r.to_location.toLowerCase().includes(q) ||
      (r.transporter?.company_name ?? r.transporter?.user?.full_name ?? '').toLowerCase().includes(q)
    )
    list.sort((a, b) => {
      switch (sortKey) {
        case 'oldest':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'cost_low':  return (a.agreed_cost ?? Infinity) - (b.agreed_cost ?? Infinity)
        case 'cost_high': return (b.agreed_cost ?? -Infinity) - (a.agreed_cost ?? -Infinity)
        case 'duration':  return (durationDays(a) ?? Infinity) - (durationDays(b) ?? Infinity)
        default:          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return list
  }, [completed, search, sortKey])

  const exportRows = useCallback(() => visible.map(r => ({
    'Ημερομηνία': new Date(r.completed_at ?? r.created_at).toLocaleDateString('el-GR'),
    'Προϊόν': r.product ?? '',
    'Ποσότητα': r.quantity_tons ? `${r.quantity_tons} ${r.unit === 'kg' ? 'κιλά' : 'τόνοι'}` : '',
    'Διαδρομή': `${r.from_location} → ${r.to_location}`,
    'Μεταφορέας': r.transporter?.company_name ?? r.transporter?.user?.full_name ?? '',
    'Κόστος (€)': r.agreed_cost != null ? r.agreed_cost.toFixed(2).replace('.', ',') : '',
    'Διάρκεια (ημέρες)': durationDays(r) != null ? String(durationDays(r)) : '',
    'Κατάσταση': 'Παραδόθηκε',
  })), [visible])

  const download = useCallback((filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportCSV = useCallback(() => {
    const rows = exportRows(); if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(';'), ...rows.map(r => headers.map(h => `"${String((r as Record<string, string>)[h]).replace(/"/g, '""')}"`).join(';'))].join('\n')
    download('istoriko-metaforon.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
  }, [exportRows, download])

  const exportExcel = useCallback(() => {
    const rows = exportRows(); if (!rows.length) return
    const headers = Object.keys(rows[0])
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as Record<string, string>)[h])}</td>`).join('')}</tr>`).join('')}</table></body></html>`
    download('istoriko-metaforon.xls', html, 'application/vnd.ms-excel')
  }, [exportRows, download])

  const exportPDF = useCallback(() => {
    const rows = exportRows(); if (!rows.length) return
    const headers = Object.keys(rows[0])
    const win = window.open('', '_blank'); if (!win) return
    win.document.write(`<html><head><meta charset="utf-8"><title>Ιστορικό Μεταφορών — AgroExchange</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{color:#2E7D32;font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#2E7D32;color:#fff}tr:nth-child(even){background:#f6f7f8}</style></head><body><h1>AgroExchange — Ιστορικό Μεταφορών</h1><table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as Record<string, string>)[h])}</td>`).join('')}</tr>`).join('')}</table></body></html>`)
    win.document.close(); win.focus(); setTimeout(() => win.print(), 300)
  }, [exportRows])

  if (loading) return <TransportSkeleton rows={3} />
  if (!completed.length) {
    return (
      <EmptyState
        icon={<Icons.list className="w-6 h-6" />}
        title="Δεν υπάρχουν ολοκληρωμένες μεταφορές"
        message="Μόλις ολοκληρωθεί μια μεταφορά, θα εμφανίζεται εδώ με πλήρη στοιχεία και δυνατότητα εξαγωγής."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Icons.search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Αναζήτηση προϊόντος, διαδρομής ή μεταφορέα…" aria-label="Αναζήτηση ιστορικού"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none transition-all focus:border-agro-500 focus:ring-2 focus:ring-agro-100" />
          </div>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} aria-label="Ταξινόμηση"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-100">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 mr-1">Εξαγωγή:</span>
          {([{ l: 'CSV', f: exportCSV }, { l: 'Excel', f: exportExcel }, { l: 'PDF', f: exportPDF }] as const).map(b => (
            <button key={b.l} onClick={b.f} aria-label={`Εξαγωγή σε ${b.l}`}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">{b.l}</button>
          ))}
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 text-sm">Δεν βρέθηκαν μεταφορές για την αναζήτηση.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-auto table-scroll max-h-[480px]">
            <table className="w-full text-sm" aria-label="Ιστορικό ολοκληρωμένων μεταφορών">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Ημ/νία', 'Προϊόν', 'Ποσότητα', 'Διαδρομή', 'Μεταφορέας', 'Κόστος', 'Διάρκεια'].map((h, i) => (
                    <th key={h} scope="col" className={`bg-gray-50 px-3 sm:px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map(r => {
                  const d = durationDays(r)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(r.completed_at ?? r.created_at).toLocaleDateString('el-GR')}</td>
                      <td className="px-3 sm:px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.product || '—'}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-600 whitespace-nowrap">{r.quantity_tons ? `${r.quantity_tons} ${r.unit === 'kg' ? 'κιλά' : 'τ.'}` : '—'}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-600 whitespace-nowrap">{r.from_location} → {r.to_location}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-600 whitespace-nowrap">{r.transporter?.company_name ?? r.transporter?.user?.full_name ?? '—'}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{r.agreed_cost != null ? `${r.agreed_cost.toLocaleString('el-GR', { minimumFractionDigits: 2 })} €` : '—'}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap">{d != null ? `${d} ημ.` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

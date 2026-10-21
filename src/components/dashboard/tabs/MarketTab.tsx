'use client'
import { useState, useMemo, useCallback } from 'react'
import type { MarketPrice, MarketPriceHistoryPoint } from '@/types'
import { Card, Sparkline } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'

// ── Formatting helpers ────────────────────────────────────────
// Price format: "255,00 €" (amount first, Greek locale, symbol after).
function formatPrice(value: number): string {
  return `${Number(value).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

// Country names come from the service already localized to Greek; the app's
// <Localizer> translates them to English when the locale is 'en'. No flags.
function countryName(p: MarketPrice): string {
  return p.member_state_name ?? p.member_state_code ?? 'ΕΕ'
}

const GREEK_MONTHS = [
  'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
  'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου',
]
function formatDateGreek(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${GREEK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function formatPeriod(begin?: string | null, end?: string | null): string {
  if (!begin || !end) return '—'
  const b = new Date(begin), e = new Date(end)
  if (isNaN(b.getTime()) || isNaN(e.getTime())) return '—'
  const sameMonth = b.getMonth() === e.getMonth() && b.getFullYear() === e.getFullYear()
  if (sameMonth) return `${b.getDate()}–${e.getDate()} ${GREEK_MONTHS[e.getMonth()]} ${e.getFullYear()}`
  return `${b.getDate()} ${GREEK_MONTHS[b.getMonth()]} – ${e.getDate()} ${GREEK_MONTHS[e.getMonth()]} ${e.getFullYear()}`
}

// Filter categories — only those present in the data are shown.
const CATEGORY_LABELS: Record<string, string> = {
  cereals: 'Σιτηρά',
  feed:    'Ζωοτροφές',
  pulses:  'Όσπρια',
  oilseeds:'Ελαιούχα',
}

// Split a commodity label like "Κριθάρι (Βυνοποιίας)" → { base, quality }.
function splitQuality(label: string): { base: string; quality: string | null } {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  return m ? { base: m[1].trim(), quality: m[2].trim() } : { base: label, quality: null }
}

const SOURCE_LABEL = 'EU Agri-Food Data Portal'
const CHANGE_TOOLTIP = 'Μεταβολή σε σχέση με την προηγούμενη διαθέσιμη περίοδο.'

type SortKey = 'price' | 'change' | 'alpha' | 'country'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'alpha',   label: 'Αλφαβητικά' },
  { value: 'price',   label: 'Τιμή' },
  { value: 'change',  label: 'Μεταβολή' },
  { value: 'country', label: 'Χώρα' },
]

interface Props {
  prices: MarketPrice[]
  history?: Record<string, MarketPriceHistoryPoint[]>
  loading?: boolean
}

// ── Change badge (shared by cards + table for consistency) ────
function ChangeBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'xs' }) {
  const up = value >= 0
  const Icon = up ? Icons.trendUp : Icons.trendDown
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'
  return (
    <span
      tabIndex={0}
      title={CHANGE_TOOLTIP}
      aria-label={`${CHANGE_TOOLTIP} ${up ? 'Άνοδος' : 'Πτώση'} ${Math.abs(value).toFixed(2)}%`}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-agro-300 ${
        up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      <Icon className={iconCls} />
      {Math.abs(value).toFixed(2)}%
    </span>
  )
}

// ── Loading skeleton ──────────────────────────────────────────
function MarketSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3 w-56 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-44 bg-gray-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-20 bg-gray-100 rounded-2xl" />
        <div className="h-20 bg-gray-100 rounded-2xl" />
      </div>
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export function MarketTab({ prices, history = {}, loading = false }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('alpha')

  // Categories actually present in the data (so empty ones don't show).
  const availableCategories = useMemo(() => {
    const set = new Set(prices.map(p => p.category).filter(Boolean) as string[])
    return ['all', ...[...set].filter(c => CATEGORY_LABELS[c])]
  }, [prices])

  // Filter + search + sort (memoized to avoid recomputing on unrelated renders).
  const visible = useMemo(() => {
    let list = prices.slice()
    if (category !== 'all') list = list.filter(p => p.category === category)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(p =>
        p.commodity.toLowerCase().includes(q) ||
        p.symbol.toLowerCase().includes(q) ||
        (p.member_state_name ?? '').toLowerCase().includes(q) ||
        (p.market_name ?? '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case 'price':   return b.price - a.price
        case 'change':  return b.change_pct - a.change_pct
        case 'country': return (a.member_state_name ?? '').localeCompare(b.member_state_name ?? '', 'el')
        default:        return a.commodity.localeCompare(b.commodity, 'el')
      }
    })
    return list
  }, [prices, category, search, sortKey])

  // Last update (from the real updated_at timestamp).
  const updatedIso = prices[0]?.updated_at
  const updatedDate = updatedIso ? formatDateGreek(updatedIso) : null
  const updatedTime = updatedIso
    ? new Date(updatedIso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    : null

  // Biggest gainer / loser (from real change_pct).
  const gainer = useMemo(
    () => (prices.length ? prices.reduce((m, p) => (p.change_pct > m.change_pct ? p : m)) : null),
    [prices]
  )
  const loser = useMemo(
    () => (prices.length ? prices.reduce((m, p) => (p.change_pct < m.change_pct ? p : m)) : null),
    [prices]
  )

  // ── Exports (real data only) ──
  const buildExportRows = useCallback(() => visible.map(p => ({
    'Προϊόν': p.commodity,
    'Τιμή (€/τόνο)': p.price.toFixed(2).replace('.', ','),
    'Μεταβολή %': p.change_pct.toFixed(2).replace('.', ','),
    'Χώρα': p.member_state_name ?? p.member_state_code ?? '',
    'Αγορά': p.market_name ?? '',
    'Περίοδος': formatPeriod(p.begin_date, p.end_date),
    'Πηγή': SOURCE_LABEL,
  })), [visible])

  const downloadFile = useCallback((filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportCSV = useCallback(() => {
    const rows = buildExportRows()
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${String((r as Record<string, string>)[h]).replace(/"/g, '""')}"`).join(';')),
    ].join('\n')
    downloadFile('times-agoras.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8')
  }, [buildExportRows, downloadFile])

  const exportExcel = useCallback(() => {
    const rows = buildExportRows()
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    // HTML table that Excel opens natively as a spreadsheet (.xls), no library needed.
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>` +
      headers.map(h => `<th>${h}</th>`).join('') + '</tr>' +
      rows.map(r => '<tr>' + headers.map(h => `<td>${String((r as Record<string, string>)[h])}</td>`).join('') + '</tr>').join('') +
      '</table></body></html>'
    downloadFile('times-agoras.xls', html, 'application/vnd.ms-excel')
  }, [buildExportRows, downloadFile])

  const exportPDF = useCallback(() => {
    const rows = buildExportRows()
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><meta charset="utf-8"><title>Τιμές Αγοράς — AgroExchange</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{color:#2E7D32;font-size:20px}
        .sub{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#2E7D32;color:#fff}
        tr:nth-child(even){background:#f6f7f8}
      </style></head><body>
      <h1>AgroExchange — Τιμές Αγοράς</h1>
      <div class="sub">Πηγή: ${SOURCE_LABEL} · Τελευταία ενημέρωση: ${updatedDate ?? ''} ${updatedTime ?? ''}</div>
      <table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as Record<string, string>)[h])}</td>`).join('')}</tr>`).join('')}
      </table></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }, [buildExportRows, updatedDate, updatedTime])

  // First load (before any data arrives) → skeleton.
  if (loading && prices.length === 0) return <MarketSkeleton />

  // Loaded but genuinely no data available.
  if (!loading && prices.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h2 className="font-display font-extrabold text-gray-900 text-xl tracking-tight">Τιμές Αγοράς</h2>
        </header>
        <Card className="p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Icons.trendUp className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Δεν υπάρχουν διαθέσιμες τιμές αυτή τη στιγμή</p>
          <p className="text-xs text-gray-400 mt-1">Οι τιμές ενημερώνονται αυτόματα από το {SOURCE_LABEL}.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header + LIVE badge */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-extrabold text-gray-900 text-xl tracking-tight">Τιμές Αγοράς</h2>
          {updatedDate && (
            <p className="text-xs text-gray-500 mt-1" aria-live="polite">
              Τελευταία ενημέρωση: <span className="font-semibold text-gray-700">{updatedDate}</span> · {updatedTime}
            </p>
          )}
        </div>
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5" aria-label="Ζωντανά δεδομένα από το EU Agri-Food Data Portal">
          <span className="w-2 h-2 bg-green-500 rounded-full live-dot flex-shrink-0" aria-hidden="true" />
          <div className="leading-tight">
            <div className="text-[11px] font-bold text-green-700">LIVE</div>
            <div className="text-[10px] text-green-600/80">{SOURCE_LABEL}</div>
          </div>
        </div>
      </header>

      {/* Biggest gainer / loser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gainer && (
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Icons.trendUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Μεγαλύτερη άνοδος</div>
              <div className="font-bold text-gray-900 text-sm truncate">{splitQuality(gainer.commodity).base}</div>
              <div className="text-xs text-green-600 font-bold">+{gainer.change_pct.toFixed(2)}% · {formatPrice(gainer.price)}</div>
            </div>
          </Card>
        )}
        {loser && (
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Icons.trendDown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Μεγαλύτερη πτώση</div>
              <div className="font-bold text-gray-900 text-sm truncate">{splitQuality(loser.commodity).base}</div>
              <div className="text-xs text-red-500 font-bold">{loser.change_pct.toFixed(2)}% · {formatPrice(loser.price)}</div>
            </div>
          </Card>
        )}
      </div>

      {/* Controls: search, sort, filters, export */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Icons.search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Αναζήτηση προϊόντος, χώρας ή αγοράς…"
              aria-label="Αναζήτηση προϊόντος, χώρας ή αγοράς"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-agro-500 focus:ring-2 focus:ring-agro-100"
            />
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-all duration-200 focus:border-agro-500 focus:ring-2 focus:ring-agro-100"
            aria-label="Ταξινόμηση"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {availableCategories.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Φίλτρα κατηγορίας">
            {availableCategories.map(c => {
              const active = category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-agro-300 ${
                    active ? 'bg-agro-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c === 'all' ? 'Όλα' : CATEGORY_LABELS[c]}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 mr-1">Εξαγωγή:</span>
          {([
            { label: 'CSV', fn: exportCSV },
            { label: 'Excel', fn: exportExcel },
            { label: 'PDF', fn: exportPDF },
          ] as const).map(btn => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.fn}
              aria-label={`Εξαγωγή σε ${btn.label}`}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-agro-300"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Price cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(p => {
          const { base, quality } = splitQuality(p.commodity)
          const points = (history[p.symbol] ?? []).map(h => h.price)
          const hasHistory = points.length >= 2
          return (
            <Card
              key={p.symbol}
              className="p-3.5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* 1. Product name */}
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{p.unit}</div>
              <div className="font-bold text-gray-900 text-sm sm:text-base truncate leading-tight">{base}</div>

              {/* 2. Quality badge (subtle) */}
              {quality && (
                <span className="inline-block mt-1 text-[9px] font-medium text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-1.5 py-0.5">
                  {quality}
                </span>
              )}

              {/* 3. Price — the most prominent element */}
              <div className="font-display font-black text-gray-900 text-2xl tracking-tight mt-2">
                {formatPrice(p.price)}
              </div>

              {/* 4-6. Country · Market · Period (lighter, smaller metadata) */}
              <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-400 leading-snug">
                <div className="truncate">{countryName(p)}{p.market_name ? ` · ${p.market_name}` : ''}</div>
                <div>{formatPeriod(p.begin_date, p.end_date)}</div>
              </div>

              {/* 7. Change % + sparkline */}
              <div className="mt-2.5 flex items-end justify-between gap-2">
                <ChangeBadge value={p.change_pct} size="xs" />
                <div className="overflow-hidden">
                  {hasHistory ? (
                    <Sparkline data={points} color={p.change_pct >= 0 ? '#4CAF50' : '#EF4444'} width={110} height={30} />
                  ) : (
                    <span className="text-[10px] text-gray-300 italic">Χωρίς αρκετά ιστορικά δεδομένα</span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {visible.length === 0 && (
        <Card className="p-8 text-center text-gray-500 text-sm">
          Δεν βρέθηκαν προϊόντα για τα τρέχοντα φίλτρα.
        </Card>
      )}

      {/* Table */}
      {visible.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Πίνακας Τιμών</h3>
          </div>
          <div className="overflow-auto table-scroll max-h-[480px]">
            <table className="w-full text-sm" aria-label="Πίνακας τιμών αγροτικών προϊόντων">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Προϊόν', 'Τιμή', 'Μεταβολή', 'Χώρα', 'Αγορά', 'Περίοδος', 'Πηγή'].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`bg-gray-50 px-3 sm:px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${i === 1 || i === 2 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map(p => (
                  <tr key={p.symbol} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{p.commodity}</td>
                    <td className="px-3 sm:px-4 py-3 text-right font-display font-bold text-gray-900 whitespace-nowrap">{formatPrice(p.price)}</td>
                    <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex justify-end">
                        <ChangeBadge value={p.change_pct} />
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-gray-700 whitespace-nowrap">{countryName(p)}</td>
                    <td className="px-3 sm:px-4 py-3 text-gray-600 whitespace-nowrap">{p.market_name ?? '—'}</td>
                    <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap">{formatPeriod(p.begin_date, p.end_date)}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-lg px-2 py-0.5 whitespace-nowrap">{SOURCE_LABEL}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

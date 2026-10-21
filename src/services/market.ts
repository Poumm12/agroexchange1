/**
 * market.ts — Commodity prices service (real data, Supabase-backed)
 *
 * Source priority:
 *   1. EU Agri-Food Data Portal (public, no key) — real EU cereal/commodity prices
 *   2. Supabase cached prices (last known good value)
 *
 * There is NO demo/hardcoded fallback. If both the live source and the Supabase
 * cache are unavailable, an empty array is returned and the error is logged —
 * the app never shows fake data.
 *
 * Caching: the /api/market route revalidates on a 30–60 min window and upserts
 * fresh values into Supabase, so the client always reads cached real data
 * instead of hitting the upstream source on every page refresh.
 */
import { getSupabaseClient } from '@/lib/supabase-client'
import type { MarketPrice, MarketPriceHistoryPoint } from '@/types'

// EU Agri-Food Data Portal — official PUBLIC cereal prices API (no key required).
// Confirmed from the official API Guide: "All APIs can be found under /api",
// base URL https://api.tech.ec.europa.eu/agrifood. The gateway only rate-limits
// (429); it does NOT require authentication. The earlier 404 was a missing /api/.
// Docs: https://agridata.ec.europa.eu/extensions/API_Documentation/cereals.html
const EU_CEREAL_URL = 'https://api.tech.ec.europa.eu/agrifood/api/cereal/prices'

// Prefer Greek member-state prices; fall back to other relevant EU producers
// so Greek/EU farmers always see the most relevant figure available.
// EU member-state codes (the API uses 2-letter codes; Greece = 'EL').
const PREFERRED_MS = ['EL', 'GR', 'IT', 'ES', 'FR', 'BG', 'RO', 'HU', 'DE']

// EU member-state code → Greek country name. The Greek name is the display
// default; the app's <Localizer> translates it to English when locale = 'en'.
const MS_NAME_EL: Record<string, string> = {
  EL: 'Ελλάδα', GR: 'Ελλάδα', DE: 'Γερμανία', FR: 'Γαλλία', IT: 'Ιταλία',
  ES: 'Ισπανία', BG: 'Βουλγαρία', RO: 'Ρουμανία', HU: 'Ουγγαρία', PL: 'Πολωνία',
  PT: 'Πορτογαλία', NL: 'Ολλανδία', BE: 'Βέλγιο', AT: 'Αυστρία', CZ: 'Τσεχία',
  DK: 'Δανία', SE: 'Σουηδία', FI: 'Φινλανδία', IE: 'Ιρλανδία', SK: 'Σλοβακία',
  LT: 'Λιθουανία', LV: 'Λετονία', EE: 'Εσθονία', HR: 'Κροατία', SI: 'Σλοβενία',
  LU: 'Λουξεμβούργο', CY: 'Κύπρος', MT: 'Μάλτα',
}
function countryNameEl(code?: string | null, fallback?: string | null): string | null {
  if (code && MS_NAME_EL[code.toUpperCase()]) return MS_NAME_EL[code.toUpperCase()]
  return fallback ?? null
}

// Market preference within a member state: National Average first, then
// Regional Average, then any other named market. Lower rank = higher priority.
function marketRank(name?: string | null): number {
  const m = (name ?? '').toLowerCase()
  if (m.includes('national')) return 0
  if (m.includes('regional')) return 1
  return 2
}

// The cereal PRICES endpoint returns `productName` (descriptive), NOT productCode.
// We map EACH distinct product variant to its own commodity — base grain + quality
// qualifier — so "Feed barley" and "Malting barley" are SEPARATE products, not
// collapsed into one "Κριθάρι".
interface Classified {
  symbol: string     // stable unique id per variant, e.g. BARLEY_MALT
  base: string       // Greek base name, e.g. Κριθάρι
  quality: string | null  // Greek quality qualifier, e.g. Βυνοποιίας
  label: string      // full display label, e.g. "Κριθάρι (Βυνοποιίας)"
  category: string   // cereals | feed | pulses | oilseeds
}

// Base grain detection (order matters: specific before generic).
const BASES: { test: (n: string) => boolean; key: string; el: string; category: string }[] = [
  { test: n => n.includes('durum'),                   key: 'DURUM',     el: 'Σκληρό Σιτάρι', category: 'cereals' },
  { test: n => n.includes('wheat'),                   key: 'WHEAT',     el: 'Μαλακό Σιτάρι', category: 'cereals' },
  { test: n => n.includes('maize') || n.includes('corn'), key: 'CORN',  el: 'Καλαμπόκι',     category: 'cereals' },
  { test: n => n.includes('barley'),                  key: 'BARLEY',    el: 'Κριθάρι',       category: 'cereals' },
  { test: n => n.includes('rye'),                     key: 'RYE',       el: 'Σίκαλη',        category: 'cereals' },
  { test: n => n.includes('oat'),                     key: 'OATS',      el: 'Βρώμη',         category: 'cereals' },
  { test: n => n.includes('triticale'),               key: 'TRITICALE', el: 'Τριτικάλε',     category: 'cereals' },
  { test: n => n.includes('sorghum'),                 key: 'SORGHUM',   el: 'Σόργο',         category: 'cereals' },
]

// Quality qualifier detection.
const QUALITIES: { test: (n: string) => boolean; key: string; el: string; category?: string }[] = [
  { test: n => n.includes('malting'),                          key: 'MALT',  el: 'Βυνοποιίας' },
  { test: n => n.includes('bread') || n.includes('milling'),   key: 'BREAD', el: 'Αρτοποιίας' },
  { test: n => n.includes('feed'),                             key: 'FEED',  el: 'Ζωοτροφής', category: 'feed' },
]

function classifyProduct(productName: string): Classified | null {
  const n = (productName ?? '').toLowerCase().trim()
  if (!n) return null
  const base = BASES.find(b => b.test(n))
  if (!base) return null
  const qual = QUALITIES.find(q => q.test(n)) ?? null
  const symbol = qual ? `${base.key}_${qual.key}` : base.key
  const label = qual ? `${base.el} (${qual.el})` : base.el
  // Feed products belong to the "feed" category; otherwise keep the base category.
  const category = qual?.category ?? base.category
  return { symbol, base: base.el, quality: qual?.el ?? null, label, category }
}

interface FetchResult {
  prices: MarketPrice[]
  source: string
  history?: MarketPriceHistoryPoint[]
}

interface EUResult {
  prices: MarketPrice[]
  history: MarketPriceHistoryPoint[]
}

// ── 1. Live source: EU Agri-Food Data Portal ──────────────────
async function fetchFromEU(): Promise<EUResult | null> {
  // Request a recent window (last ~120 days) so we get the latest + a prior week
  // to compute the change %. Dates are dd/MM/yyyy per the EU API spec.
  // NOTE: the prices endpoint has no productCode filter — we fetch the window
  // and classify each row by its `productName`.
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${d.getFullYear()}`
  }
  const end = new Date()
  const begin = new Date(Date.now() - 120 * 86400000)
  const url = `${EU_CEREAL_URL}?beginDate=${fmt(begin)}&endDate=${fmt(end)}`

  let res: Response
  try {
    res = await fetch(url, {
      next: { revalidate: 1800 },
      headers: { Accept: 'application/json', 'User-Agent': 'AgroExchange/1.0' },
    })
  } catch (netErr: any) {
    console.error('[market] EU API fetch failed (network/TLS/egress):', netErr?.message ?? netErr)
    return null
  }

  if (!res.ok) {
    console.error(`[market] EU API returned HTTP ${res.status} ${res.statusText} — falling back to cache.`)
    return null
  }

  let rows: any
  try {
    rows = JSON.parse(await res.text())
  } catch (parseErr: any) {
    console.error('[market] EU API response was not valid JSON — falling back to cache:', parseErr?.message ?? parseErr)
    return null
  }

  if (!Array.isArray(rows)) {
    console.error('[market] EU API returned a non-array payload — falling back to cache.')
    return null
  }
  if (!rows.length) {
    console.error('[market] EU API returned an empty array — falling back to cache.')
    return null
  }

  // ── Deduplication (item 4) ──
  // Drop exact duplicates: same product + market + member state + period.
  const seen = new Set<string>()
  const deduped: any[] = []
  for (const r of rows) {
    const key = [r.productName, r.marketName, r.memberStateCode, r.beginDate, r.endDate].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }

  // Group rows by our internal commodity symbol (one symbol PER product variant,
  // e.g. BARLEY_FEED vs BARLEY_MALT), classifying via productName.
  const bySymbol = new Map<string, any[]>()
  const defBySymbol = new Map<string, Classified>()
  let unmatched = 0
  for (const r of deduped) {
    const cls = classifyProduct(r.productName)
    if (!cls) { unmatched++; continue }
    if (!bySymbol.has(cls.symbol)) { bySymbol.set(cls.symbol, []); defBySymbol.set(cls.symbol, cls) }
    bySymbol.get(cls.symbol)!.push(r)
  }
  if (!bySymbol.size) console.error('[market] No EU productNames mapped to a tracked commodity — falling back to cache.')

  const parsePrice = (r: any): number => {
    // EU API prices are strings in European format: "172,00" or "1.234,56".
    let raw = String(r.price ?? r.value ?? '').replace(/[^\d.,]/g, '')
    if (raw.includes(',')) {
      // comma = decimal separator → drop thousands dots, swap comma to dot
      raw = raw.replace(/\./g, '').replace(',', '.')
    }
    return parseFloat(raw)
  }
  const parseDate = (r: any): number => {
    // EU API returns dd/MM/yyyy — parse explicitly (new Date() misreads this format).
    const s = String(r.endDate ?? r.beginDate ?? r.referencePeriod ?? '')
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime()
    const t = new Date(s).getTime()
    return isFinite(t) ? t : 0
  }
  // Convert EU dd/MM/yyyy → ISO yyyy-MM-dd
  const toISO = (s?: string): string | null => {
    const m = String(s ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null
  }

  // Rank member states by relevance (Greece first).
  const msRank = (r: any): number => {
    const code = (r.memberStateCode ?? r.memberState ?? '').toUpperCase()
    const i = PREFERRED_MS.indexOf(code)
    return i === -1 ? PREFERRED_MS.length : i
  }

  const prices: MarketPrice[] = []
  const history: MarketPriceHistoryPoint[] = []
  for (const [symbol, entries] of bySymbol) {
    const def = defBySymbol.get(symbol)!
    // 1) Best member state available for this commodity (Greece > IT/ES/… > rest).
    const bestRank = Math.min(...entries.map(msRank))
    const msEntries = entries.filter(r => msRank(r) === bestRank)
    const chosenMs = (msEntries[0]?.memberStateCode ?? msEntries[0]?.memberState ?? 'EU').toUpperCase()

    // 2) Within that member state, choose the best MARKET by strict priority
    //    (National Average > Regional Average > others) — NOT the first row found.
    const bestMarketRank = Math.min(...msEntries.map(r => marketRank(r.marketName)))
    const marketEntries = msEntries.filter(r => marketRank(r.marketName) === bestMarketRank)
    const chosenMarket = marketEntries[0]?.marketName ?? null

    // 3) Within that market, sort weeks newest-first for current price + change.
    marketEntries.sort((a, b) => parseDate(b) - parseDate(a))
    const latest = marketEntries[0]
    const prev   = marketEntries.find(r => parsePrice(r) !== parsePrice(latest)) ?? marketEntries[1]
    const price  = parsePrice(latest)
    if (!isFinite(price) || price <= 0) {
      console.warn(`[market] ⚠ Could not parse a valid price for ${symbol} from:`, JSON.stringify(latest))
      continue
    }
    const prevPrice = prev ? parsePrice(prev) : NaN
    const changePct = isFinite(prevPrice) && prevPrice > 0
      ? +(((price - prevPrice) / prevPrice) * 100).toFixed(2)
      : 0

    // 4) Build FULL history for this symbol from ALL weeks in the chosen market
    //    (item 3) — ascending by date, for immediate sparklines.
    //    The EU API may return several rows for the SAME week (different
    //    stageName / unit / currency). Collapse to ONE point per end_date so the
    //    history array never contains duplicate (symbol, end_date) keys.
    const weeksAsc = marketEntries.slice().sort((a, b) => parseDate(a) - parseDate(b))
    const byEndDate = new Map<string, number>()  // end_date(ISO) → price
    for (const w of weeksAsc) {
      const wp = parsePrice(w)
      const iso = toISO(w.endDate)
      if (!iso || !isFinite(wp) || wp <= 0) continue
      // Last write wins (weeksAsc is ascending, so the most recent record for
      // that exact week is kept) — guarantees a single point per week.
      byEndDate.set(iso, +wp.toFixed(2))
    }
    for (const [iso, wp] of byEndDate) {
      history.push({ symbol, price: wp, end_date: iso, recorded_at: new Date().toISOString() })
    }

    prices.push({
      id:         def.symbol,
      commodity:  def.label,
      symbol:     def.symbol,
      price:      +price.toFixed(2),
      change_pct: changePct,
      unit:       '€/τόνο',
      source:     'live',
      updated_at: new Date().toISOString(),
      member_state_code: chosenMs,
      member_state_name: countryNameEl(chosenMs, latest.memberStateName),
      market_name:       chosenMarket,
      begin_date:        toISO(latest.beginDate),
      end_date:          toISO(latest.endDate),
      category:          def.category,
    })
  }

  console.log(`[market] Live fetch OK — ${prices.length} products, ${history.length} history points.`)

  if (!prices.length) {
    console.error('[market] ❌ No usable prices extracted (field names may have changed). Falling back to CACHE.')
    return null
  }
  return { prices, history }
}

// ── 2. Supabase cache (last known good) ───────────────────────
async function fetchFromSupabase(): Promise<MarketPrice[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('market_prices')
      .select('*')
      .order('commodity')
    if (error) throw error
    const rows = (data as MarketPrice[]) ?? []
    console.log('[market] Supabase returned', rows.length, 'cached rows; sources:',
      [...new Set(rows.map(r => r.source))].join(', ') || '(none)')
    if (rows.some(r => r.source === 'demo')) {
      console.warn('[market] ⚠ Cache still contains "demo" rows — these are stale seed data from migration 002.')
      console.warn('[market]   They will be overwritten on the first successful LIVE fetch (upsert on symbol).')
    }
    return rows
  } catch (e: any) {
    console.error('[market] ❌ Supabase cache read failed:', e?.message ?? e)
    return []
  }
}

/**
 * Returns real market prices. Live source first; on failure, the last values
 * cached in Supabase. Never returns demo/fake data.
 */
export async function fetchMarketPrices(): Promise<FetchResult> {
  const live = await fetchFromEU()
  if (live?.prices.length) {
    return { prices: live.prices, source: 'live', history: live.history }
  }

  console.warn('[market] ⚠ LIVE source failed — falling back to Supabase cache (see reason above).')
  const cached = await fetchFromSupabase()
  const source = cached.length ? 'cache' : 'unavailable'
  return { prices: cached, source }
}

/**
 * Reads REAL price history (last `days`) per symbol from Supabase for sparklines.
 * Returns a map: symbol → [{ price, end_date, recorded_at }] ascending by date.
 * Never fabricates data — if there's not enough history, the UI shows a message.
 */
export async function fetchPriceHistory(days = 30): Promise<Record<string, MarketPriceHistoryPoint[]>> {
  try {
    const supabase = getSupabaseClient()
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('market_price_history')
      .select('symbol, price, end_date, recorded_at')
      .gte('recorded_at', new Date(Date.now() - days * 86400000).toISOString())
      .order('end_date', { ascending: true })
    if (error) throw error
    const out: Record<string, MarketPriceHistoryPoint[]> = {}
    for (const r of (data ?? []) as any[]) {
      const pt: MarketPriceHistoryPoint = {
        symbol: r.symbol, price: Number(r.price),
        end_date: r.end_date, recorded_at: r.recorded_at,
      }
      ;(out[r.symbol] ??= []).push(pt)
    }
    return out
  } catch (e: any) {
    console.error('[market] ❌ Price history read failed:', e?.message ?? e)
    return {}
  }
}

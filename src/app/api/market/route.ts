import { NextResponse } from 'next/server'
import { fetchMarketPrices, fetchPriceHistory } from '@/services/market'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Server-side cache: prices refresh every 45 min (within the 30–60 min window).
// The client reads this route, so pages don't hit the upstream source on refresh.
export const revalidate = 2700 // 45 minutes

export async function GET() {
  try {
    const { prices, source, history } = await fetchMarketPrices()

    // Persist fresh LIVE values to Supabase so there's always a real fallback.
    // (Don't re-write when the data already came from the cache.)
    if (prices.length && source === 'live') {
      try {
        const admin = getSupabaseAdmin()
        let ok = 0
        for (const p of prices) {
          const { error } = await admin.from('market_prices').upsert(
            {
              symbol: p.symbol, commodity: p.commodity, price: p.price,
              change_pct: p.change_pct, unit: p.unit, source: p.source,
              updated_at: new Date().toISOString(),
              member_state_code: p.member_state_code ?? null,
              member_state_name: p.member_state_name ?? null,
              market_name: p.market_name ?? null,
              begin_date: p.begin_date ?? null,
              end_date: p.end_date ?? null,
              category: p.category ?? null,
            },
            { onConflict: 'symbol' }
          )
          if (error) console.error(`[api/market] ⚠ Upsert failed for ${p.symbol}:`, error.message)
          else ok++
        }

        // Append to REAL price history. On the first fetch this inserts ALL weeks
        // returned by the EU API (last 30 days), so sparklines appear immediately.
        // One row per (symbol, end_date) — the service already collapses weeks,
        // but we dedup again here as a final guard before the ON CONFLICT upsert.
        try {
          const raw = (history ?? []).filter(h => h.end_date)

          // Deduplicate by composite key "symbol|end_date" (last write wins).
          const map = new Map<string, typeof raw[number]>()
          const duplicateKeys: string[] = []
          for (const h of raw) {
            const key = `${h.symbol}|${h.end_date}`
            if (map.has(key)) duplicateKeys.push(key)
            map.set(key, h)
          }
          const points = Array.from(map.values())

          // Temporary diagnostics to confirm zero duplicates reach the upsert.
          console.log('[api/market] history rows before dedup:', raw.length)
          console.log('[api/market] history rows after dedup:', points.length)
          console.log('[api/market] duplicate keys:', duplicateKeys.length ? [...new Set(duplicateKeys)].join(', ') : '(none)')

          let hist = 0
          if (points.length) {
            const { error, count } = await admin
              .from('market_price_history')
              .upsert(
                points.map(h => ({
                  symbol: h.symbol,
                  price: h.price,
                  end_date: h.end_date,
                  recorded_at: new Date().toISOString(),
                })),
                { onConflict: 'symbol,end_date', count: 'exact', ignoreDuplicates: false }
              )
            if (error) console.error('[api/market] ⚠ History upsert error:', error.message)
            else hist = count ?? points.length
          }
        } catch (histErr: any) {
          console.error('[api/market] ⚠ History write error (non-fatal):', histErr?.message ?? histErr)
        }

        // Remove any leftover demo/seed rows so only real data remains.
        try {
          const admin2 = getSupabaseAdmin()
          const liveSymbols = prices.map(p => p.symbol)
          const { error: delErr, count } = await admin2
            .from('market_prices')
            .delete({ count: 'exact' })
            .eq('source', 'demo')
            .not('symbol', 'in', `(${liveSymbols.join(',')})`)
          if (delErr) console.error('[api/market] ⚠ Failed to purge demo rows:', delErr.message)
          else if (count) console.log(`[api/market] 🧹 Purged ${count} stale demo row(s) from cache`)
        } catch (purgeErr: any) {
          console.error('[api/market] ⚠ Demo purge error (non-fatal):', purgeErr?.message ?? purgeErr)
        }
      } catch (cacheErr: any) {
        // Non-fatal: a caching failure must not break the response.
        console.error('[api/market] ❌ Supabase upsert error (non-fatal):', cacheErr?.message ?? cacheErr)
      }
    } else if (source !== 'live') {
      console.warn('[api/market] ⚠ NOT upserting — data did not come from the LIVE source (source =', source + ').')
    }

    // Attach real 30-day history for the sparklines (read back from Supabase,
    // which now includes everything we just inserted).
    const historyForClient = await fetchPriceHistory(30)

    console.log(`[api/market] ${prices.length} products served · source=${source}`)
    return NextResponse.json({ data: prices, source, history: historyForClient })
  } catch (e: any) {
    console.error('[api/market] ❌ Route error:', e?.message ?? e)
    return NextResponse.json({ error: e?.message ?? 'Market data unavailable' }, { status: 500 })
  }
}

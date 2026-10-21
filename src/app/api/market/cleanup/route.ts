import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * One-time maintenance endpoint to permanently purge legacy demo rows from the
 * `market_prices` table, leaving only real data.
 *
 * Usage (run ONCE):
 *   GET  /api/market/cleanup            → deletes every row with source = 'demo'
 *   GET  /api/market/cleanup?all=true   → deletes ALL rows (full reset; the next
 *                                          /api/market call repopulates with live data)
 *
 * Safe to call multiple times. After the first successful live fetch the table
 * holds only source='live' rows, so this becomes a no-op.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const wipeAll = searchParams.get('all') === 'true'

  console.log(`[api/market/cleanup] ▶ ${wipeAll ? 'FULL WIPE' : 'purge demo rows'} @`, new Date().toISOString())

  try {
    const admin = getSupabaseAdmin()
    let query = admin.from('market_prices').delete({ count: 'exact' })

    if (wipeAll) {
      // Delete everything (match-all guard so Supabase allows the delete).
      query = query.neq('symbol', '__never__')
    } else {
      // Delete only the legacy demo seed rows.
      query = query.eq('source', 'demo')
    }

    const { error, count } = await query
    if (error) {
      console.error('[api/market/cleanup] ❌ Delete failed:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    console.log(`[api/market/cleanup] ✓ Deleted ${count ?? 0} row(s)`)
    return NextResponse.json({
      ok: true,
      deleted: count ?? 0,
      mode: wipeAll ? 'all' : 'demo-only',
      note: 'Call /api/market next to repopulate with live EU prices.',
    })
  } catch (e: any) {
    console.error('[api/market/cleanup] ❌ Error:', e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'cleanup failed' }, { status: 500 })
  }
}

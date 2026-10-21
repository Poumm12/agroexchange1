import { NextResponse } from 'next/server'
import { fetchWeather } from '@/services/weather'

export const revalidate = 1800 // 30 minutes (server-side cache; no fetch per page refresh)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? 'Larissa,GR'
  try {
    const data = await fetchWeather(city)
    return NextResponse.json({ data })
  } catch (e: any) {
    // Log the real error server-side; respond with a clear error (no demo data).
    console.error(`[weather] Failed to fetch weather for "${city}":`, e?.message ?? e)
    return NextResponse.json(
      { error: 'Δεν ήταν δυνατή η λήψη δεδομένων καιρού.' },
      { status: 502 }
    )
  }
}

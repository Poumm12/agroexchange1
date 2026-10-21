/**
 * weather.ts — Weather service (real data, no API key)
 *
 * Source: Open-Meteo (https://open-meteo.com) — free, no API key required.
 *   - Geocoding API resolves a Greek city name → lat/lng
 *   - Forecast API returns real current conditions + 5-day forecast
 *
 * The public contract is unchanged: fetchWeather(city) → WeatherData, where
 * `city` is the same "City,GR" string the UI already sends. No UI/route changes.
 *
 * On failure we log the error server-side and throw, so the API route can fall
 * back to the last value — never demo data.
 */
import type { WeatherData, WeatherForecast } from '@/types'

const GEO_URL  = 'https://geocoding-api.open-meteo.com/v1/search'
const FORE_URL = 'https://api.open-meteo.com/v1/forecast'

const DAYS_EL = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ']

// WMO weather interpretation codes → Greek condition + UI icon key.
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
function mapWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0)                       return { condition: 'Ηλιόλουστα',      icon: 'sun'   }
  if (code === 1)                       return { condition: 'Κυρίως αίθριος',  icon: 'sun'   }
  if (code === 2)                       return { condition: 'Λίγα σύννεφα',    icon: 'cloud' }
  if (code === 3)                       return { condition: 'Συννεφιά',        icon: 'cloud' }
  if (code === 45 || code === 48)       return { condition: 'Ομίχλη',          icon: 'cloud' }
  if (code >= 51 && code <= 57)         return { condition: 'Ψιχάλα',          icon: 'rain'  }
  if (code >= 61 && code <= 65)         return { condition: 'Βροχή',           icon: 'rain'  }
  if (code === 66 || code === 67)       return { condition: 'Παγωμένη βροχή',  icon: 'rain'  }
  if (code >= 71 && code <= 77)         return { condition: 'Χιόνι',           icon: 'snow'  }
  if (code >= 80 && code <= 82)         return { condition: 'Όμβροι',          icon: 'rain'  }
  if (code === 85 || code === 86)       return { condition: 'Χιονοπτώσεις',    icon: 'snow'  }
  if (code >= 95)                       return { condition: 'Καταιγίδα',       icon: 'storm' }
  return { condition: 'Συννεφιά', icon: 'cloud' }
}

// Resolve "City,GR" (or plain city) → coordinates via Open-Meteo geocoding.
async function geocode(city: string): Promise<{ lat: number; lng: number; name: string }> {
  const name = city.split(',')[0].trim()
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=el&format=json&country=GR`
  const res = await fetch(url, { next: { revalidate: 86400 } }) // cache geocoding 24h
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}) for "${name}"`)
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) throw new Error(`No geocoding result for "${name}"`)
  return { lat: hit.latitude, lng: hit.longitude, name: hit.name }
}

export async function fetchWeather(city = 'Larissa,GR'): Promise<WeatherData> {
  const { lat, lng, name } = await geocode(city)

  const params = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lng),
    current:   'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    daily:     'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    hourly:    'visibility',
    timezone:  'auto',
    wind_speed_unit: 'kmh',
    forecast_days: '5',
  })

  const res = await fetch(`${FORE_URL}?${params.toString()}`, { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`Open-Meteo forecast failed (${res.status}) for "${name}"`)
  const data = await res.json()

  const cur = data.current ?? {}
  const curMap = mapWeatherCode(cur.weather_code ?? 3)

  // Visibility: take the first hourly value (meters → km)
  const firstVisibility = Array.isArray(data.hourly?.visibility) ? data.hourly.visibility[0] : undefined

  const daily = data.daily ?? {}
  const forecast: WeatherForecast[] = (daily.time ?? []).slice(0, 5).map((date: string, i: number) => {
    const m = mapWeatherCode(daily.weather_code?.[i] ?? 3)
    return {
      date,
      day:       i === 0 ? 'Σήμερα' : DAYS_EL[new Date(date).getDay()],
      temp_max:  Math.round(daily.temperature_2m_max?.[i] ?? 0),
      temp_min:  Math.round(daily.temperature_2m_min?.[i] ?? 0),
      condition: m.condition,
      icon:      m.icon,
    }
  })

  return {
    location:   name,
    temp:       Math.round(cur.temperature_2m ?? 0),
    feels_like: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
    humidity:   Math.round(cur.relative_humidity_2m ?? 0),
    wind_speed: Math.round(cur.wind_speed_10m ?? 0),
    visibility: firstVisibility != null ? Math.round(firstVisibility / 1000) : 10,
    condition:  curMap.condition,
    icon:       curMap.icon,
    forecast,
  }
}

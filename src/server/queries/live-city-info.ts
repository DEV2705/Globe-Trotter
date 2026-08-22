/**
 * Live conditions for a destination card: weather, local timezone, an FX rate against the
 * traveller's home currency, and the verdicts derived from them.
 *
 * Every provider here is keyless (Open-Meteo, open.er-api.com, Frankfurter). The whole module
 * is fail-safe by construction: a dead or slow endpoint degrades one section of the card to
 * null and never throws, because a destination rail must still render without the network.
 */

const REVALIDATE_SECONDS = 1800 // 30 minutes — live enough for a browse surface, cheap on the providers
const TIMEOUT_MS = 6000

export interface CityLiveInput {
  id?: string
  name: string
  country: string
  lat: number | null
  lng: number | null
  costIndex: number
  popularity: number
}

export type WeatherIconKey =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'cloud-fog'
  | 'cloud-drizzle'
  | 'cloud-rain'
  | 'snowflake'
  | 'cloud-lightning'

export interface CityWeather {
  tempC: number
  humidity: number | null
  code: number
  label: string
  emoji: string
  icon: WeatherIconKey
}

export interface CityCurrency {
  /** The destination's own currency, e.g. "JPY". */
  code: string
  symbol: string
  /** Home currency the rate converts into, e.g. "INR". */
  base: string
  baseSymbol: string
  /** 1 `code` = `rate` `base`. */
  rate: number
}

export type VerdictTone = 'good' | 'warn' | 'info'

export interface Verdict {
  label: string
  emoji: string
  tone: VerdictTone
}

export interface CityLiveInfo {
  weather: CityWeather | null
  /** IANA zone from the weather provider, or a longitude-derived "UTC±H" fallback. */
  timezone: string | null
  currency: CityCurrency | null
  verdicts: {
    weather: Verdict | null
    cost: Verdict
    popularity: Verdict
  }
  tips: string[]
}

// ---------------------------------------------------------------------------
// Weather codes (WMO 4677, as returned by Open-Meteo)
// ---------------------------------------------------------------------------

interface WeatherDescriptor {
  label: string
  emoji: string
  icon: WeatherIconKey
}

const WEATHER_CODES: Record<number, WeatherDescriptor> = {
  0: { label: 'Clear sky', emoji: '☀️', icon: 'sun' },
  1: { label: 'Mainly clear', emoji: '🌤️', icon: 'cloud-sun' },
  2: { label: 'Partly cloudy', emoji: '⛅', icon: 'cloud-sun' },
  3: { label: 'Overcast', emoji: '☁️', icon: 'cloud' },
  45: { label: 'Fog', emoji: '🌫️', icon: 'cloud-fog' },
  48: { label: 'Freezing fog', emoji: '🌫️', icon: 'cloud-fog' },
  51: { label: 'Light drizzle', emoji: '🌦️', icon: 'cloud-drizzle' },
  53: { label: 'Drizzle', emoji: '🌦️', icon: 'cloud-drizzle' },
  55: { label: 'Heavy drizzle', emoji: '🌦️', icon: 'cloud-drizzle' },
  56: { label: 'Freezing drizzle', emoji: '🌧️', icon: 'cloud-drizzle' },
  57: { label: 'Freezing drizzle', emoji: '🌧️', icon: 'cloud-drizzle' },
  61: { label: 'Light rain', emoji: '🌦️', icon: 'cloud-rain' },
  63: { label: 'Rain', emoji: '🌧️', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', emoji: '🌧️', icon: 'cloud-rain' },
  66: { label: 'Freezing rain', emoji: '🌧️', icon: 'cloud-rain' },
  67: { label: 'Freezing rain', emoji: '🌧️', icon: 'cloud-rain' },
  71: { label: 'Light snow', emoji: '🌨️', icon: 'snowflake' },
  73: { label: 'Snow', emoji: '❄️', icon: 'snowflake' },
  75: { label: 'Heavy snow', emoji: '❄️', icon: 'snowflake' },
  77: { label: 'Snow grains', emoji: '🌨️', icon: 'snowflake' },
  80: { label: 'Rain showers', emoji: '🌦️', icon: 'cloud-rain' },
  81: { label: 'Rain showers', emoji: '🌧️', icon: 'cloud-rain' },
  82: { label: 'Heavy showers', emoji: '🌧️', icon: 'cloud-rain' },
  85: { label: 'Snow showers', emoji: '🌨️', icon: 'snowflake' },
  86: { label: 'Snow showers', emoji: '❄️', icon: 'snowflake' },
  95: { label: 'Thunderstorm', emoji: '⛈️', icon: 'cloud-lightning' },
  96: { label: 'Storm with hail', emoji: '⛈️', icon: 'cloud-lightning' },
  99: { label: 'Storm with hail', emoji: '⛈️', icon: 'cloud-lightning' },
}

const UNKNOWN_WEATHER: WeatherDescriptor = { label: 'Unsettled', emoji: '🌥️', icon: 'cloud' }

function describeWeather(code: number): WeatherDescriptor {
  return WEATHER_CODES[code] ?? UNKNOWN_WEATHER
}

function isWet(code: number): boolean {
  return code >= 51 && code <= 99
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/** Destination currency by country — covers every country in the seeded catalogue. */
const COUNTRY_CURRENCY: Record<string, string> = {
  Australia: 'AUD',
  Austria: 'EUR',
  Bhutan: 'BTN',
  Cambodia: 'KHR',
  China: 'CNY',
  Czechia: 'CZK',
  Fiji: 'FJD',
  France: 'EUR',
  'French Polynesia': 'XPF',
  Greece: 'EUR',
  Iceland: 'ISK',
  India: 'INR',
  Indonesia: 'IDR',
  Israel: 'ILS',
  Italy: 'EUR',
  Japan: 'JPY',
  Jordan: 'JOD',
  Laos: 'LAK',
  Lebanon: 'LBP',
  Malaysia: 'MYR',
  Nepal: 'NPR',
  Netherlands: 'EUR',
  'New Zealand': 'NZD',
  Oman: 'OMR',
  Philippines: 'PHP',
  Portugal: 'EUR',
  Qatar: 'QAR',
  'Saudi Arabia': 'SAR',
  Singapore: 'SGD',
  'South Korea': 'KRW',
  Spain: 'EUR',
  'Sri Lanka': 'LKR',
  Switzerland: 'CHF',
  Taiwan: 'TWD',
  Thailand: 'THB',
  Turkey: 'TRY',
  'United Arab Emirates': 'AED',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  Vietnam: 'VND',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'د.إ',
  AUD: 'A$',
  CHF: 'CHF',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  KRW: '₩',
  NZD: 'NZ$',
  SGD: 'S$',
  THB: '฿',
  TRY: '₺',
  USD: '$',
  VND: '₫',
}

function symbolFor(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}

export function currencyForCountry(country: string): string | null {
  return COUNTRY_CURRENCY[country] ?? null
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    // A destination rail is not worth an error page — degrade to null and carry on.
    return null
  }
}

interface OpenMeteoCurrent {
  temperature_2m?: number
  weather_code?: number
  relative_humidity_2m?: number
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent
  timezone?: string
}

/**
 * Open-Meteo accepts comma-separated coordinates and answers with an array in the same order,
 * so a twelve-card rail costs one request rather than twelve.
 */
async function fetchWeather(coords: { lat: number; lng: number }[]): Promise<(OpenMeteoResponse | null)[]> {
  if (coords.length === 0) return []
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${coords.map((c) => c.lat).join(',')}` +
    `&longitude=${coords.map((c) => c.lng).join(',')}` +
    '&current=temperature_2m,weather_code,relative_humidity_2m&timezone=auto'

  const data = await getJson<OpenMeteoResponse | OpenMeteoResponse[]>(url)
  if (!data) return coords.map(() => null)
  const list = Array.isArray(data) ? data : [data]
  return coords.map((_, i) => list[i] ?? null)
}

interface ErApiResponse {
  result?: string
  rates?: Record<string, number>
}

interface FrankfurterResponse {
  rates?: Record<string, number>
}

/** USD-based rate table. open.er-api.com covers ~160 currencies; Frankfurter is the backstop. */
async function fetchUsdRates(): Promise<Record<string, number> | null> {
  const primary = await getJson<ErApiResponse>('https://open.er-api.com/v6/latest/USD')
  if (primary?.rates && primary.result !== 'error') return { USD: 1, ...primary.rates }

  const fallback = await getJson<FrankfurterResponse>('https://api.frankfurter.app/latest?from=USD')
  if (fallback?.rates) return { USD: 1, ...fallback.rates }

  return null
}

function convert(
  rates: Record<string, number> | null,
  from: string,
  to: string
): number | null {
  if (!rates) return null
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return null
  return toRate / fromRate
}

/** Last resort when the weather provider (our source of IANA zones) is unreachable. */
function offsetZoneFromLongitude(lng: number | null): string | null {
  if (lng === null) return null
  const hours = Math.round(lng / 15)
  if (hours === 0) return 'UTC'
  return `UTC${hours > 0 ? '+' : '-'}${Math.abs(hours)}`
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function weatherVerdict(weather: CityWeather | null): Verdict | null {
  if (!weather) return null
  const { tempC, code } = weather

  if (isWet(code)) {
    return code >= 95
      ? { label: 'Storms right now', emoji: '⛈️', tone: 'warn' }
      : { label: 'Monsoons / off-peak', emoji: '🌧️', tone: 'warn' }
  }
  if (tempC >= 35) return { label: 'Heat advisory', emoji: '🥵', tone: 'warn' }
  if (tempC >= 28) return { label: 'Warm season', emoji: '🔥', tone: 'info' }
  if (tempC >= 18) return { label: 'Pleasant weather — great time to visit', emoji: '☀️', tone: 'good' }
  if (tempC >= 8) return { label: 'Crisp and cool', emoji: '🍂', tone: 'info' }
  return { label: 'Cold — pack layers', emoji: '🧣', tone: 'warn' }
}

function costVerdict(costIndex: number): Verdict {
  if (costIndex < 45) return { label: 'Budget friendly', emoji: '💡', tone: 'good' }
  if (costIndex > 75) return { label: 'Premium destination', emoji: '✨', tone: 'warn' }
  return { label: 'Mid-range', emoji: '⚖️', tone: 'info' }
}

function popularityVerdict(popularity: number): Verdict {
  if (popularity >= 80) return { label: 'Top trending', emoji: '🌟', tone: 'good' }
  if (popularity >= 55) return { label: 'Traveller favourite', emoji: '⚡', tone: 'info' }
  return { label: 'Hidden gem', emoji: '🧭', tone: 'info' }
}

function buildTips(city: CityLiveInput, weather: CityWeather | null): string[] {
  const tips: string[] = []

  if (weather) {
    if (isWet(weather.code)) tips.push('Rain is falling now — plan indoor stops and pack a light shell.')
    else if (weather.tempC >= 32) tips.push('Beat the heat: front-load sightseeing before 11am.')
    else if (weather.tempC <= 8) tips.push('Cold snap — thermals and an early sunset to plan around.')
    else tips.push('Comfortable conditions for walking tours right now.')

    if (weather.humidity !== null && weather.humidity >= 80) {
      tips.push('Humidity is high — carry water and take shade breaks.')
    }
  }

  tips.push(
    city.costIndex < 45
      ? 'Costs run low here, so a longer stay stretches the budget further.'
      : city.costIndex > 75
        ? 'A pricey base — book stays early and look just outside the centre.'
        : 'Mid-range pricing: comfortable without stretching the budget.'
  )

  if (city.popularity >= 80) tips.push('Very popular — reserve headline attractions ahead of time.')

  return tips
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function assemble(
  city: CityLiveInput,
  raw: OpenMeteoResponse | null,
  rates: Record<string, number> | null,
  homeCurrency: string
): CityLiveInfo {
  const current = raw?.current
  const weather: CityWeather | null =
    current?.temperature_2m !== undefined && current.weather_code !== undefined
      ? {
          tempC: Math.round(current.temperature_2m),
          humidity: current.relative_humidity_2m ?? null,
          code: current.weather_code,
          ...describeWeather(current.weather_code),
        }
      : null

  const localCode = currencyForCountry(city.country)
  const rate = localCode ? convert(rates, localCode, homeCurrency) : null
  const currency: CityCurrency | null =
    localCode && rate !== null && localCode !== homeCurrency
      ? {
          code: localCode,
          symbol: symbolFor(localCode),
          base: homeCurrency,
          baseSymbol: symbolFor(homeCurrency),
          rate,
        }
      : null

  return {
    weather,
    timezone: raw?.timezone ?? offsetZoneFromLongitude(city.lng),
    currency,
    verdicts: {
      weather: weatherVerdict(weather),
      cost: costVerdict(city.costIndex),
      popularity: popularityVerdict(city.popularity),
    },
    tips: buildTips(city, weather),
  }
}

/** Live conditions for one destination. */
export async function getCityLiveInfo(city: CityLiveInput, homeCurrency = 'INR'): Promise<CityLiveInfo> {
  const [info] = await getCitiesLiveInfo([city], homeCurrency)
  return info
}

/**
 * Live conditions for a whole rail: one batched weather call and one FX call, settled
 * independently so a failure on either side only blanks its own section.
 */
export async function getCitiesLiveInfo(
  cities: CityLiveInput[],
  homeCurrency = 'INR'
): Promise<CityLiveInfo[]> {
  const located = cities.map((c) =>
    c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng } : null
  )
  const coords = located.filter((c): c is { lat: number; lng: number } => c !== null)

  const [weatherResult, ratesResult] = await Promise.allSettled([fetchWeather(coords), fetchUsdRates()])

  const weatherByCoord = weatherResult.status === 'fulfilled' ? weatherResult.value : []
  const rates = ratesResult.status === 'fulfilled' ? ratesResult.value : null

  let cursor = 0
  return cities.map((city, i) => {
    const raw = located[i] !== null ? (weatherByCoord[cursor++] ?? null) : null
    return assemble(city, raw, rates, homeCurrency)
  })
}

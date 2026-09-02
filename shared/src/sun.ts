import type { ISODate } from './types.js'

const DEG = Math.PI / 180
const UNIX_EPOCH_JD = 2440587.5
const DAY_MS = 86_400_000

/** Standard refraction plus the sun's radius: its centre is this far below level at sunset. */
const SUNSET_ZENITH_DEG = 90.833

const sin = (deg: number) => Math.sin(deg * DEG)
const cos = (deg: number) => Math.cos(deg * DEG)
const tan = (deg: number) => Math.tan(deg * DEG)

/**
 * Sunset as a UTC instant, by the NOAA solar equations.
 *
 * Accurate to about a minute at temperate latitudes, which is enough to print beside a
 * habit tracker and nowhere near enough to be treated as a halachic ruling. Null when
 * the sun does not set at all that day, which happens above the polar circles.
 *
 * `lon` is east-positive, so Israel is about +35 and New York about -74. Everything is
 * computed from the date string in UTC, so the machine's own timezone cannot change
 * the answer.
 */
export function sunsetUtc(date: ISODate, lat: number, lon: number): Date | null {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(midnightUtc)) return null

  // Julian centuries since J2000, taken at noon so the day's own terms are centred.
  const julianDay = midnightUtc / DAY_MS + UNIX_EPOCH_JD + 0.5
  const t = (julianDay - 2451545) / 36525

  const meanLongitude = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)

  const centre =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289

  const apparentLongitude =
    meanLongitude + centre - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * t)

  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + 0.00256 * cos(125.04 - 1934.136 * t)

  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) / DEG

  // Equation of time, in minutes: the gap between clock noon and actual solar noon.
  const y = tan(obliquity / 2) ** 2
  const equationOfTime =
    (4 *
      (y * sin(2 * meanLongitude) -
        2 * eccentricity * sin(meanAnomaly) +
        4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude) -
        0.5 * y * y * sin(4 * meanLongitude) -
        1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly))) /
    DEG

  const cosHourAngle =
    cos(SUNSET_ZENITH_DEG) / (cos(lat) * cos(declination)) - tan(lat) * tan(declination)

  // Polar day or polar night: there is no sunset to report, so say so rather than
  // returning a number that would be quietly wrong.
  if (cosHourAngle < -1 || cosHourAngle > 1) return null

  const hourAngle = Math.acos(cosHourAngle) / DEG
  const minutesFromMidnightUtc = 720 - 4 * lon - equationOfTime + 4 * hourAngle
  return new Date(midnightUtc + minutesFromMidnightUtc * 60_000)
}

export interface ZoneLocation {
  /** Shown to the user so an approximate time is never mistaken for their own city's. */
  label: string
  lat: number
  /** East-positive. */
  lon: number
  /** Minutes before sunset for candle lighting. The custom varies by city. */
  candleOffsetMin: number
  /** Minutes after sunset for nightfall. */
  havdalahOffsetMin: number
}

/**
 * Deliberately short, and null for anything not listed.
 *
 * A timezone is not a city: `Asia/Jerusalem` covers the whole country, and the candle
 * lighting custom is forty minutes in Jerusalem where it is eighteen almost everywhere
 * else. So this uses a central point and the common eighteen, every rendered time is
 * marked approximate, and an unknown zone shows nothing at all. A wrong candle lighting
 * time is worse than no candle lighting time.
 */
const ZONES: Record<string, ZoneLocation> = {
  'Asia/Jerusalem': { label: 'Israel', lat: 31.9, lon: 34.9, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'Asia/Tel_Aviv': { label: 'Israel', lat: 31.9, lon: 34.9, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'America/New_York': { label: 'New York', lat: 40.71, lon: -74.01, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'America/Los_Angeles': { label: 'Los Angeles', lat: 34.05, lon: -118.24, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'Europe/London': { label: 'London', lat: 51.51, lon: -0.13, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'Europe/Paris': { label: 'Paris', lat: 48.86, lon: 2.35, candleOffsetMin: 18, havdalahOffsetMin: 42 },
  'Australia/Sydney': { label: 'Sydney', lat: -33.87, lon: 151.21, candleOffsetMin: 18, havdalahOffsetMin: 42 },
}

/** Null for any zone not in the table. Never guesses. */
export function locationFor(timeZone: string): ZoneLocation | null {
  return ZONES[timeZone] ?? null
}

function shift(instant: Date | null, minutes: number): Date | null {
  return instant ? new Date(instant.getTime() + minutes * 60_000) : null
}

export function candleLighting(date: ISODate, loc: ZoneLocation): Date | null {
  return shift(sunsetUtc(date, loc.lat, loc.lon), -loc.candleOffsetMin)
}

export function havdalah(date: ISODate, loc: ZoneLocation): Date | null {
  return shift(sunsetUtc(date, loc.lat, loc.lon), loc.havdalahOffsetMin)
}

/** 'HH:MM' as read on a clock in `timeZone`. */
export function clockTimeIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
}

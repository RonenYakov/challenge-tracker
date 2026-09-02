import { describe, it, expect } from 'vitest'
import { candleLighting, clockTimeIn, havdalah, locationFor, sunsetUtc } from './sun.js'

/** Minutes between a computed instant and an expected wall clock time in a zone. */
function driftMinutes(instant: Date | null, timeZone: string, expected: string): number {
  if (!instant) throw new Error('expected a sunset')
  const [h, m] = clockTimeIn(instant, timeZone).split(':').map(Number)
  const [eh, em] = expected.split(':').map(Number)
  return Math.abs(h! * 60 + m! - (eh! * 60 + em!))
}

describe('sunsetUtc', () => {
  // Expected times were cross-checked against a second, independently derived sunset
  // formulation; the two agree to within a minute at every site below.
  it('tracks the seasons in Israel', () => {
    const tz = 'Asia/Jerusalem'
    // Summer, clocks forward. Winter, clocks back. The function returns UTC either way,
    // so only the formatter knows about the change.
    expect(driftMinutes(sunsetUtc('2026-06-19', 32.08, 34.78), tz, '19:49')).toBeLessThanOrEqual(2)
    expect(driftMinutes(sunsetUtc('2026-12-18', 32.08, 34.78), tz, '16:38')).toBeLessThanOrEqual(2)
  })

  it('handles a western longitude, which is where a sign error would show', () => {
    expect(
      driftMinutes(sunsetUtc('2026-06-19', 40.71, -74.01), 'America/New_York', '20:30'),
    ).toBeLessThanOrEqual(2)
  })

  it('inverts the seasons below the equator', () => {
    // June is midwinter in Sydney, so the sun sets early.
    expect(
      driftMinutes(sunsetUtc('2026-06-19', -33.87, 151.21), 'Australia/Sydney', '16:53'),
    ).toBeLessThanOrEqual(2)
  })

  it('gives a near twelve hour day at the equator', () => {
    const set = sunsetUtc('2026-03-20', -0.18, -78.47)
    expect(driftMinutes(set, 'America/Guayaquil', '18:24')).toBeLessThanOrEqual(2)
  })

  it('returns null when the sun never sets and when it never rises', () => {
    expect(sunsetUtc('2026-06-21', 69.65, 18.96)).toBe(null)
    expect(sunsetUtc('2026-12-21', 69.65, 18.96)).toBe(null)
  })

  it('is pure, so the machine timezone cannot change the answer', () => {
    const original = process.env.TZ
    const first = sunsetUtc('2026-06-19', 32.08, 34.78)
    process.env.TZ = 'Pacific/Kiritimati'
    const second = sunsetUtc('2026-06-19', 32.08, 34.78)
    process.env.TZ = original
    expect(second?.toISOString()).toBe(first?.toISOString())
  })
})

describe('locationFor', () => {
  it('knows Israel and admits when it does not know', () => {
    expect(locationFor('Asia/Jerusalem')?.label).toBe('Israel')
    expect(locationFor('Antarctica/Troll')).toBe(null)
    expect(locationFor('Not/AZone')).toBe(null)
  })
})

describe('candle lighting and havdalah', () => {
  const israel = locationFor('Asia/Jerusalem')!

  it('sits before sunset and nightfall after it', () => {
    const date = '2026-08-07'
    const set = sunsetUtc(date, israel.lat, israel.lon)!
    expect(candleLighting(date, israel)!.getTime()).toBe(set.getTime() - 18 * 60_000)
    expect(havdalah(date, israel)!.getTime()).toBe(set.getTime() + 42 * 60_000)
  })

  it('gives back null wherever there is no sunset to offset from', () => {
    const polar = { label: 'Tromso', lat: 69.65, lon: 18.96, candleOffsetMin: 18, havdalahOffsetMin: 42 }
    expect(candleLighting('2026-06-21', polar)).toBe(null)
    expect(havdalah('2026-06-21', polar)).toBe(null)
  })
})

import { describe, it, expect } from 'vitest'
import { suggestAnchors } from './anchor-logic.js'
import type { RoutineProfile, Task } from './types.js'

function profile(over: Partial<RoutineProfile> = {}): RoutineProfile {
  return {
    wakeTime: '06:30',
    workStart: '09:00',
    workEnd: '18:00',
    sleepTime: '23:00',
    hasKids: false,
    updatedAt: '',
    ...over,
  }
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't', challengeId: 'c', label: 'Read 10 pages', kind: 'check',
    targetValue: null, unit: null, sortOrder: 0, isActive: true, cue: null, ...over,
  }
}

describe('suggestAnchors', () => {
  it('builds anchors from the times the user actually gave', () => {
    const found = suggestAnchors(profile(), task())
    const text = found.map((a) => a.cue).join(' | ')
    expect(text).toContain('06:30')
    expect(text).toContain('23:00')
  })

  it('returns nothing when nothing is known', () => {
    const empty = profile({
      wakeTime: null, workStart: null, workEnd: null, sleepTime: null, hasKids: false,
    })
    expect(suggestAnchors(empty, task())).toEqual([])
  })

  it('works from a single known time', () => {
    const only = profile({ workStart: null, workEnd: null, sleepTime: null })
    const found = suggestAnchors(only, task())
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((a) => a.cue.length > 0)).toBe(true)
  })

  it('offers a kids anchor only when there are kids', () => {
    // "Once the kids are in bed" is a block, so it is offered to a task that needs one.
    const workout = task({ kind: 'timer', targetValue: 45, label: 'Workout' })
    const without = suggestAnchors(profile({ hasKids: false }), workout)
    const with_ = suggestAnchors(profile({ hasKids: true }), workout)
    expect(without.some((a) => /kids/i.test(a.cue))).toBe(false)
    expect(with_.some((a) => /kids/i.test(a.cue))).toBe(true)
  })

  it('orders anchors through the day', () => {
    const found = suggestAnchors(profile(), task())
    const times = found.map((a) => a.at).filter((t): t is string => t !== null)
    expect([...times].sort()).toEqual(times)
  })

  it('does not offer the before-work slot when the morning is too tight for the task', () => {
    // Up at 08:00, at work by 09:00. A 45 minute workout does not fit in that hour.
    const rushed = profile({ wakeTime: '08:00', workStart: '09:00' })
    const long = task({ kind: 'timer', targetValue: 45, unit: 'min', label: 'Workout' })
    expect(suggestAnchors(rushed, long).some((a) => /before work/i.test(a.cue))).toBe(false)
  })

  it('does offer it when the morning is long enough', () => {
    // Up at 06:30 with work at 09:00 is two and a half hours; the workout fits.
    const long = task({ kind: 'timer', targetValue: 45, unit: 'min', label: 'Workout' })
    expect(suggestAnchors(profile(), long).some((a) => /before work/i.test(a.cue))).toBe(true)
  })

  it('still offers the before-work slot to a quick task on a rushed morning', () => {
    const rushed = profile({ wakeTime: '08:00', workStart: '09:00' })
    const quick = task({ kind: 'check', label: 'Take vitamins' })
    expect(suggestAnchors(rushed, quick).some((a) => /before work/i.test(a.cue))).toBe(true)
  })

  it('never returns duplicates', () => {
    const found = suggestAnchors(profile({ workEnd: '18:00', sleepTime: '18:00' }), task())
    expect(new Set(found.map((a) => a.cue)).size).toBe(found.length)
  })

  it('caps the list so the user is choosing, not reading', () => {
    expect(suggestAnchors(profile({ hasKids: true }), task()).length).toBeLessThanOrEqual(3)
  })

  it('gives a long task and a two-second task different anchors', () => {
    // The whole point of asking about the routine. If a 45 minute workout and taking a
    // vitamin get the same list, the suggestions are generic advice in a costume.
    const p = profile({ hasKids: true })
    const workout = suggestAnchors(p, task({ kind: 'timer', targetValue: 45, label: 'Workout' }))
    const vitamins = suggestAnchors(p, task({ kind: 'check', label: 'Take vitamins' }))
    expect(workout.map((a) => a.cue)).not.toEqual(vitamins.map((a) => a.cue))
  })

  it('offers instant transitions to a task that takes seconds', () => {
    const found = suggestAnchors(profile(), task({ kind: 'check', label: 'Take vitamins' }))
    expect(found.some((a) => /wake up|before bed/i.test(a.cue))).toBe(true)
  })

  it('offers real blocks to a long task, not the moment of waking', () => {
    const found = suggestAnchors(
      profile({ hasKids: true }),
      task({ kind: 'timer', targetValue: 45, label: 'Workout' }),
    )
    expect(found.some((a) => /^Right after I wake up/.test(a.cue))).toBe(false)
    expect(found.some((a) => /finish work|kids are in bed|Before work/i.test(a.cue))).toBe(true)
  })

  it('says nothing rather than proposing a slot that cannot hold the task', () => {
    // Up at 08:00, work at 09:00, no kids, and a two hour task. Nothing fits.
    const tight = profile({ wakeTime: '08:00', workStart: '09:00', workEnd: null, sleepTime: null })
    const huge = task({ kind: 'timer', targetValue: 120, label: 'Long run' })
    expect(suggestAnchors(tight, huge)).toEqual([])
  })
})

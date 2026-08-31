import type { AnchorSuggestion, RoutineProfile, Task } from './types.js'

/** Minutes a task plausibly needs, used to decide which slots can hold it. */
function minutesNeeded(task: Task): number {
  if (task.kind === 'timer') return task.targetValue ?? 30
  return 2
}

/**
 * Two shapes of anchor, because they suit different habits.
 *
 * A `moment` is an instant you pass through: waking, closing the laptop, getting into
 * bed. Perfect for something that takes seconds, useless for an hour of exercise.
 * A `block` is a stretch of time that can actually hold a long task.
 *
 * Without this split every task got the same five suggestions, which is precisely the
 * generic advice this feature is supposed to avoid.
 */
type Shape = 'moment' | 'block'

interface Candidate extends AnchorSuggestion {
  shape: Shape
  /** Minutes plausibly available. Infinity where the ceiling is unknown but generous. */
  capacity: number
}

/**
 * Candidate anchors for habit stacking, built from the user's own routine.
 *
 * This proposes rather than prescribes. The effect behind implementation intentions
 * comes from the person committing to a specific moment, not from software picking one,
 * and people engage more with suggestions they can override than with a plan handed to
 * them. These are seeds for the cue field: pick one, edit it, or write your own.
 *
 * Everything is derived from times the user actually gave, so an empty profile produces
 * an empty list rather than advice that could have been written for anyone.
 */
export function suggestAnchors(profile: RoutineProfile, task: Task): AnchorSuggestion[] {
  // A rule spread across the whole day has no single moment to attach to, and one
  // pinned to a clock time already has its answer. Offering anchors for either is
  // how "drink 1.5L of water" ended up suggested for bedtime.
  if (task.scheduleMode === 'anytime' || task.scheduleMode === 'fixed') return []

  const needed = minutesNeeded(task)
  const candidates: Candidate[] = []

  const add = (cue: string, at: string | null, shape: Shape, capacity: number) => {
    if (!candidates.some((c) => c.cue === cue)) candidates.push({ cue, at, shape, capacity })
  }

  if (profile.wakeTime) {
    add(`Right after I wake up (${profile.wakeTime})`, profile.wakeTime, 'moment', 10)
  }

  // The morning block, bounded by when work starts. This is the one slot where the
  // available time is genuinely known, so it is worth measuring rather than guessing.
  if (profile.wakeTime && profile.workStart) {
    const gap = minutesBetween(profile.wakeTime, profile.workStart)
    add(
      `Before work, after I wake up (${profile.wakeTime})`,
      profile.wakeTime,
      'block',
      Math.max(0, gap - 30), // leave half an hour for getting out of the door
    )
  }

  if (profile.workEnd) {
    add(`As soon as I finish work (${profile.workEnd})`, profile.workEnd, 'block', Infinity)
  }

  if (profile.hasKids) {
    // No clock time: bedtime moves, and inventing one would be worse than being vague.
    add('Once the kids are in bed', null, 'block', Infinity)
  }

  if (profile.sleepTime) {
    add(`Before bed (${profile.sleepTime})`, profile.sleepTime, 'moment', 15)
  }

  const fits = candidates.filter((c) => c.capacity >= needed)

  // A long task gets blocks; a two-second one gets the transitions it can ride on.
  // Where a task is long and nothing has room, fits is already empty and we say nothing
  // rather than suggest a slot that cannot work.
  const preferred: Shape = needed > 15 ? 'block' : 'moment'
  const ranked = [
    ...fits.filter((c) => c.shape === preferred),
    ...fits.filter((c) => c.shape !== preferred),
  ]

  return ranked
    .slice(0, 3)
    .sort((a, b) => (a.at ?? '21:00').localeCompare(b.at ?? '21:00'))
    .map(({ cue, at }) => ({ cue, at }))
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

/** Forward distance in minutes, wrapping past midnight. */
function minutesBetween(from: string, to: string): number {
  const diff = toMinutes(to) - toMinutes(from)
  return diff < 0 ? diff + 24 * 60 : diff
}

# Challenge Tracker — Phase 2 Plan

## Goal

Make the tracker hold a full 75 Hard-style commitment: the daily rules you already have,
plus the outcome you want by the end, plus the scheduled events that support it.

Success criteria:

- Opening the app makes it obvious that one challenge holds many daily rules. No one
  should ever think a task is its own challenge.
- An end-of-period goal ("lose 3kg") shows whether you are on pace, at a glance.
- Weekly scheduled events ("gym Mon/Wed/Fri") appear in Google Calendar.

## Constraints

- Single developer, incremental sessions. Every phase must ship on its own.
- Stack is fixed: Vite + React client, Fastify API, Supabase Postgres, one Vercel project.
- Supabase free tier. No paid services.
- **Google Calendar is a sensitive scope.** Publishing an app that requests it requires
  Google verification: a working homepage and a hosted privacy policy on the same domain,
  then a review that takes days to weeks. Ronen has chosen to go through it.
- Until verification passes, the consent screen stays in Testing and Google signs him
  out roughly every 7 days. This is accepted, not solved.
- Hebrew content throughout; English UI.

## Out of Scope

Deliberately not building, to keep each phase shippable:

- Two-way Calendar sync. We write events to Calendar; we do not read a user's calendar
  back into the app, and we do not reconcile edits made in Google.
- Reminders, push notifications, or email nudges.
- Weight from Apple Health, Google Fit, or any device integration. Progress is typed in.
- Sharing, friends, or any social surface.
- Native mobile app. Browser only.
- Goal types beyond a numeric target with logged readings.
- Retroactive editing of goal progress older than the most recent reading.

## Architecture

Three additions, each isolated from the others.

**1. Navigation and framing (client only, no schema change).**
The current top nav sits Today / Stats / Challenges side by side, which reads as three
peers and makes "Challenges" look like a task list. Recast it so the active challenge is
the frame and its rules live visibly inside it. `Challenges` becomes a manage-and-switch
screen reached from the challenge name, not a primary tab.

**2. Goals (`goals` + `goal_entries`).**
An outcome tied to a challenge, tracked by a number moving from a start value toward a
target by the final day.

- `goals`: `id`, `challenge_id` → challenges, `label`, `unit`, `start_value`,
  `target_value`, `direction` (`down` | `up`, derived on write from start vs target),
  `created_at`, `archived`.
- `goal_entries`: `id`, `goal_id` → goals, `logged_on` (date), `value`, `created_at`,
  unique on `(goal_id, logged_on)` so one reading per day.

Pace is derived, never stored: given start, target, start date, length and the latest
reading, the expected value today is linear interpolation, and "on pace" is a comparison
against it. Same rule as streaks — derived cannot drift.

**3. Scheduled events (`scheduled_events`) + Google Calendar write.**

- `scheduled_events`: `id`, `challenge_id`, `title`, `weekdays` (int array, 0-6),
  `time_of_day`, `duration_minutes`, `google_event_id` (nullable), `synced_at`.
- The Google **provider token** from Supabase's OAuth response is what authorises the
  Calendar API. Supabase returns it once at sign-in and does not persist it, so the
  server stores the refresh token in a new `google_credentials` table, encrypted at rest,
  and refreshes access tokens itself.
- Calendar writes happen server-side only. The client never holds a Google token.

Data flow is unchanged elsewhere: client → Fastify → Postgres, with the JWT verified
per request and ownership checked in `server/src/ownership.ts`.

## Phases

**Phase 1 — Reframe the challenge screen.** Ships: a Today screen where the challenge
name, day counter and its rules read as one object, and a clear route to manage or switch
challenges. No schema change, no API change. Retires the risk that the whole confusion is
cosmetic and everything after it is built on a misunderstanding. Smallest change, and it
is the actual complaint.

**Phase 2 — Goals.** Ships: create a goal on a challenge, log a reading, see current
value against target and whether you are on pace with N days left. Depends on nothing
from phase 1. Retires the risk that "on pace" is harder to express usefully than it
sounds; a linear target is easy to compute and easy to argue with, so it needs to be seen
before more is built on it.

**Phase 3 — Scheduled events, in-app only.** Ships: define weekly recurring events on a
challenge and see the week ahead in the app. No Google involved. Retires the scheduling
model itself, and leaves something useful standing even if verification never passes.

**Phase 4 — Google Calendar write.** Ships: a connect button, and events pushed to
Calendar. Depends on phase 3 and on Google verification being submitted. Deliberately
last because it is the only part gated on an external review we do not control.

**Phase 4a, in parallel with 2 and 3 — verification assets.** A public homepage and a
hosted privacy policy at the app's domain, which Google requires before it will review.
These are cheap to build and are the long pole, so they start early.

## Key Decisions

**Store a Google refresh token server-side, rather than re-prompting for consent.**
Supabase hands back a provider token at sign-in and forgets it. Without persisting the
refresh token, Calendar writes only work in the minutes after a login, which is useless
for a background sync. The alternative, prompting for Google consent every time an event
changes, is worse for a daily-use app. This means the server holds a Google credential,
so it is encrypted at rest and never leaves the server.

**Derive pace instead of storing it.** Same reasoning that kept streaks and grace tokens
derived: a stored "on pace" flag goes stale the moment a reading is edited or the
challenge is reset. Alternative was a nightly job, which adds a cron for no benefit.

**Ship in-app scheduling before Calendar.** Calendar is gated on a Google review with an
unknown timeline. Building the scheduling model first means phase 3 is useful on its own
and phase 4 becomes an export, not a dependency. Alternative was Calendar-first, which
risks weeks of nothing shipping.

## Risks

**Google verification is refused or stalls.** Likelihood: moderate. Sensitive scopes get
real scrutiny and the app is personal, which reviewers sometimes reject. Mitigation:
phase 3 delivers scheduling without Google, so a refusal costs the sync, not the feature.

**The 7-day sign-out during the whole verification period.** Accepted. It is one tap on
the Google button, roughly weekly, and it does not touch data.

**Storing a Google refresh token raises the value of a database breach.** Mitigation:
encrypted at rest with a key held only in the server environment, never in the repo,
and scoped to `calendar.events` alone rather than full calendar access.

**"On pace" could be discouraging in a way that backfires.** Weight in particular does
not move linearly. Mitigation: show the trend and the target without a red failure state,
and never let a goal affect the daily streak or trigger a reset.

**Phase 1 might not be the real fix.** The complaint was that the UI made tasks look like
separate challenges, which is a guess at the cause. Mitigation: it is a small,
client-only change, shown and confirmed before phases 2 to 4 build on it.

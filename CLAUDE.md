# Challenge Tracker

A self-directed challenge tracker in the spirit of 75 Hard, where the user sets the rules,
the length, and the strictness. The folder is named `60 day challenge`, but **length is a
per-challenge setting**. Nothing in the code knows the number 60.

## Structure

```
client/   Vite + React + TypeScript SPA
server/   Fastify + TypeScript REST API (owns all database access)
shared/   Types and the pure challenge logic, imported by both
```

Complete client/server separation. **The client never touches Postgres.** It calls the API
with a Supabase-issued JWT; the server verifies it and reaches the database itself.

## Stack

- Client: Vite, React 18, Tailwind v4 (CSS-first `@theme`), TanStack Query, react-router
- Server: Fastify 5, `postgres.js` with hand-written SQL, Zod at every request boundary
- Auth: Supabase Auth issues an ES256 JWT; the server verifies it against the project
  JWKS with `jose`. Three ways in, all minting the same token: email + password (the
  primary path), a magic link, and Google OAuth. The server never sees a password or a
  JWT secret, and needs no change to support a new provider.
- DB: Supabase Postgres, project `challenge-tracker` (`vddqedbchwilyhkamkhr`, eu-central-1)
- Tests: Vitest on `shared/` logic

## Non-obvious decisions

- **`shared/challenge-logic.ts` is the single source of truth for dates and streaks.**
  The server is authoritative; the client runs the same functions only for optimistic UI.
  Never fork this logic into one side.
- **Every date boundary resolves in `challenge.timezone`**, not the server's zone. A UTC
  server and a user in Israel otherwise disagree about what day it is. Dates are handled
  as `'YYYY-MM-DD'` strings, and day arithmetic runs in UTC so DST can never shift a result.
- **`day_cutoff_hour`** (default 4) means 01:30 still belongs to the previous day.
- **RLS is enabled with no policies** on every table, deliberately. The server uses a
  direct connection; the deny-all posture means a leaked anon key opens nothing. The
  Supabase linter reports this as INFO — that is expected, not a finding.
- **Grace tokens and streaks are derived**, never stored counters. Tokens come from
  `challenge_events`, so they cannot drift out of sync.
- **`length_days` counts ACTIVE days, not calendar days.** `challenges.rest_weekdays`
  lists weekdays with nothing due (`[6]` is Shabbat). A rest day is never required,
  never breaks a streak, and cannot be logged, so 60 days with Saturdays off spans about
  70 calendar days. `shared/rest-logic.ts` owns every conversion; anything asking "what
  day of the challenge is this" calls `activeDayNumber` or `activeDaysElapsed`, never
  `calendarDaysBetween`. Rest weekdays are frozen while `status = 'active'`, which is
  what makes streaks and stored `day_number` values safe to trust within an attempt.
- **Shabbat is the whole civil Saturday**, not sunset to sunset. A half day cannot be
  the unit a streak is counted in, so Friday stays required and `shared/sun.ts` just
  prints the candle-lighting deadline. Times are approximate and shown with a `~`; an
  unknown timezone shows nothing rather than guessing.
- **A reset increments `attempt_no` and moves `start_date`.** Old `day_logs` keep their
  original `attempt_no` so failed attempts stay visible in the grid.
- **Ownership is checked in `server/src/ownership.ts` only.** A row the user does not own
  returns 404, not 403, so the API does not confirm that an id exists.

## Design

`my-design-style` with `emil-design-eng` as the supporting taste skill.
Warm editorial palette, light only, dense dashboard layout. Tokens live in
`client/src/index.css` under `@theme`.

- 60-30-10: cream surfaces, paper cards, orange accent. **One primary action per screen.**
- Fonts: DM Sans (UI), IBM Plex Mono (numbers), **Assistant for Hebrew** — DM Sans has no
  Hebrew coverage, so it must stay in the stack.
- `dir="auto"` on every element carrying user content, so Hebrew task names lay out RTL
  without flipping the English chrome around them.
- Motion confirms state, never decorates. Respect `prefers-reduced-motion`.

## Copy rules

No em-dashes or double-hyphens in user-facing copy. Plain, specific, varied sentence
length. See the global CLAUDE.md for the full list of AI-slop tells to avoid.

## Commands

```
npm run dev:server     # API on :8787
npm run dev:client     # UI on :5173
npm test               # Vitest
npm run build          # both workspaces
```

Migrations are hand-written SQL in `server/migrations/`, applied via the Supabase MCP
`apply_migration`. Run `get_advisors` after any schema change.

# Challenge Tracker

Your rules, your length, your run. A daily tracker in the spirit of 75 Hard, except you
set every rule and decide how much grace you get.

## Setup

Install once from the repo root:

```bash
npm install
```

### 1. Server environment

Copy the example and fill in one value:

```bash
cp server/.env.example server/.env
```

`DATABASE_URL` is the only thing you need to supply. Get it from Supabase:

1. Open the `challenge-tracker` project
2. Project Settings → Database → Connection string → **Transaction pooler**
3. Copy the URI and replace `[YOUR-PASSWORD]` with your database password
   (reset it on that same page if you do not know it)

Everything else in the file is already filled in.

### 2. Client environment

```bash
cp client/.env.example client/.env
```

Already complete — the publishable key is safe to keep in the repo.

### 3. Turn on email sign-in

In Supabase: Authentication → Providers → Email, and make sure email is enabled.
Under URL Configuration, add `http://localhost:5173` as a redirect URL.

## Running it

Two terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Then open http://localhost:5173, sign in with your email, and create your first challenge.

## Tests

```bash
npm test
```

Covers the date, streak, and reset logic in `shared/` — the cutoff-hour boundaries, the
grace path, and the reset path. That is where the bugs in an app like this actually live.

## How it works

- **Day cutoff.** Days roll over at an hour you choose (default 4am), so finishing at 1am
  still counts for the day before.
- **Backfill.** You can fill in yesterday if you forgot to tap, and it is marked as logged
  late. Anything older is closed.
- **Grace tokens.** Set how many you get when you create the challenge. Miss a day and you
  choose: spend one, or take the reset.
- **Resets keep history.** Going back to day 1 does not erase the attempt that failed. It
  stays in the grid, faded.

## Deployment

One Vercel project serves both halves: the static client, and the Fastify API as a
serverless function at `/api`. Same origin, so production needs no CORS and neither
side has to be told the other's URL.

- Project: `challenge-tracker` (team `ronens-projects-b6987686`)
- URL: https://challenge-tracker-ronens-projects-b6987686.vercel.app

`api/index.ts` lives at the repo root, not in `server/`, because the install has to run
from the workspace root for `@ct/shared` to resolve. `server/src/index.ts` is still the
local entry point and still calls `listen()`.

`shared` compiles to `dist/` via a root `postinstall`. It cannot export raw TypeScript:
that works locally only because tsx transpiles on the fly, and Node cannot load `.ts`
at runtime in a deployed function.

Deploy manually with:

```bash
npx vercel deploy --prod --scope ronens-projects-b6987686
```

Automatic deploys on push need Vercel's GitHub App granted access to the repository,
which it does not have yet because the repo is private.

### Production environment variables

Set on the Vercel project: `DATABASE_URL`, `SUPABASE_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`. `CORS_ORIGINS` is only needed for local development.

To update the database password after rotating it:

```bash
npx vercel env rm DATABASE_URL production --yes --scope ronens-projects-b6987686
```

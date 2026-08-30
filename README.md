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

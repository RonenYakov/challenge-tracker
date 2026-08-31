-- Weekly recurring events that support the challenge but are not scored by it:
-- "gym Mon/Wed/Fri 18:00", "call mum Sunday". Distinct from tasks, which are the
-- daily rules. Missing an event never affects the streak.
create table public.scheduled_events (
  id               uuid primary key default gen_random_uuid(),
  challenge_id     uuid not null references public.challenges (id) on delete cascade,
  title            text not null check (length(btrim(title)) between 1 and 200),
  -- 0 = Sunday through 6 = Saturday, matching JavaScript's getUTCDay.
  weekdays         smallint[] not null check (
                     array_length(weekdays, 1) between 1 and 7
                     and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
                   ),
  time_of_day      time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  -- Set once the event has been pushed to Google Calendar, so a later edit updates
  -- the same entry instead of creating a duplicate.
  google_event_id  text,
  synced_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index scheduled_events_challenge_idx on public.scheduled_events (challenge_id);

alter table public.scheduled_events enable row level security;

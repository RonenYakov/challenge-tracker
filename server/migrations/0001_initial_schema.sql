-- Challenge Tracker: initial schema.
-- Ownership chain: auth.users -> profiles -> challenges -> tasks/day_logs -> task_entries.
-- Every table has RLS enabled with no policies: the API reaches Postgres with the
-- service-role key, so a leaked anon key opens nothing.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  display_name text,
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness. A plain unique constraint would happily accept
-- Ronen@x.com alongside ronen@x.com as two separate accounts.
create unique index profiles_email_lower_key on public.profiles (lower(email));

-- -------------------------------------------------------------- challenges

create table public.challenges (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 120),
  start_date         date not null,
  length_days        integer not null check (length_days between 1 and 1000),
  day_cutoff_hour    integer not null default 4 check (day_cutoff_hour between 0 and 23),
  -- IANA zone. Every date boundary is resolved here, so a UTC server and a user
  -- in Israel always agree on what "today" is.
  timezone           text not null default 'Asia/Jerusalem',
  grace_tokens_total integer not null default 0 check (grace_tokens_total between 0 and 365),
  attempt_no         integer not null default 1 check (attempt_no >= 1),
  status             text not null default 'draft'
                     check (status in ('draft', 'active', 'completed', 'abandoned')),
  created_at         timestamptz not null default now()
);

create index challenges_user_id_idx on public.challenges (user_id);

-- Exactly one active challenge per user, enforced by the database rather than by
-- application code, which loses to a double-click.
create unique index challenges_one_active_per_user
  on public.challenges (user_id)
  where status = 'active';

-- ------------------------------------------------------------------- tasks

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  label        text not null check (length(btrim(label)) between 1 and 200),
  kind         text not null default 'check' check (kind in ('check', 'count', 'timer')),
  target_value numeric(10, 2) check (target_value is null or target_value > 0),
  unit         text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  -- A checkbox has no target; a counter or timer must have one.
  constraint tasks_target_matches_kind check (
    (kind = 'check' and target_value is null)
    or (kind in ('count', 'timer') and target_value is not null)
  )
);

create index tasks_challenge_id_idx on public.tasks (challenge_id, sort_order);

-- ---------------------------------------------------------------- day_logs

create table public.day_logs (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  log_date     date not null,
  day_number   integer not null check (day_number >= 1),
  attempt_no   integer not null default 1 check (attempt_no >= 1),
  status       text not null default 'pending'
               check (status in ('pending', 'complete', 'incomplete', 'graced')),
  logged_late  boolean not null default false,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (challenge_id, log_date)
);

create index day_logs_challenge_attempt_idx on public.day_logs (challenge_id, attempt_no, log_date);

-- ------------------------------------------------------------ task_entries

create table public.task_entries (
  id               uuid primary key default gen_random_uuid(),
  day_log_id       uuid not null references public.day_logs (id) on delete cascade,
  task_id          uuid not null references public.tasks (id) on delete cascade,
  value            numeric(10, 2) not null default 0 check (value >= 0),
  -- Set while a timer task is running. Stored server-side so a running timer
  -- survives a closed tab and follows the user between devices.
  timer_started_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (day_log_id, task_id)
);

create index task_entries_day_log_idx on public.task_entries (day_log_id);

-- -------------------------------------------------------- challenge_events

create table public.challenge_events (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  type         text not null check (type in ('grace_spent', 'reset')),
  day_number   integer not null,
  attempt_no   integer not null,
  occurred_at  timestamptz not null default now()
);

create index challenge_events_challenge_idx on public.challenge_events (challenge_id, attempt_no);

-- ----------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger task_entries_touch_updated_at
  before update on public.task_entries
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- RLS

alter table public.profiles         enable row level security;
alter table public.challenges       enable row level security;
alter table public.tasks            enable row level security;
alter table public.day_logs         enable row level security;
alter table public.task_entries     enable row level security;
alter table public.challenge_events enable row level security;

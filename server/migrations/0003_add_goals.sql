-- An outcome for the whole challenge period, tracked by a number moving from a
-- starting reading toward a target. Deliberately separate from tasks: a goal never
-- affects the daily streak and can never trigger a reset.
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  label        text not null check (length(btrim(label)) between 1 and 200),
  unit         text,
  start_value  numeric(12, 3) not null,
  target_value numeric(12, 3) not null,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index goals_challenge_id_idx on public.goals (challenge_id, created_at);

create table public.goal_entries (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.goals (id) on delete cascade,
  logged_on  date not null,
  value      numeric(12, 3) not null,
  created_at timestamptz not null default now(),
  -- One reading per day. A second weigh-in replaces the first rather than stacking.
  unique (goal_id, logged_on)
);

create index goal_entries_goal_idx on public.goal_entries (goal_id, logged_on);

alter table public.goals        enable row level security;
alter table public.goal_entries enable row level security;

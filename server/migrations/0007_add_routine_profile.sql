-- The rough shape of the user's day, used only to propose candidate anchors for
-- habit stacking. Every field is optional and nothing here is required to use the
-- app; with nothing filled in, no suggestions are offered rather than generic ones.
create table public.routine_profiles (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  wake_time  time,
  work_start time,
  work_end   time,
  sleep_time time,
  has_kids   boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.routine_profiles enable row level security;

create trigger routine_profiles_touch_updated_at
  before update on public.routine_profiles
  for each row execute function public.touch_updated_at();

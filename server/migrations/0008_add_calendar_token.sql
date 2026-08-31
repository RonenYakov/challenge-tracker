-- An unguessable token that lets a calendar app subscribe to this user's schedule
-- without signing in. Calendar clients cannot present a bearer token, so the secret
-- has to live in the URL; it is therefore random, per-user, and revocable by rotating it.
alter table public.profiles
  add column calendar_token uuid not null default gen_random_uuid();

create unique index profiles_calendar_token_key on public.profiles (calendar_token);

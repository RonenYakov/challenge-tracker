-- touch_updated_at is a trigger function and must never be callable directly.
-- SECURITY DEFINER gave it the owner's rights and left it exposed on /rest/v1/rpc,
-- which the Supabase security linter flagged. It runs only from a trigger, so
-- SECURITY INVOKER is sufficient.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

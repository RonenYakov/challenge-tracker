-- A free-text note for the day. Lives on day_logs rather than its own table because
-- there is exactly one per day, and (challenge_id, log_date) already enforces that.
alter table public.day_logs
  add column note text check (note is null or length(note) <= 5000);

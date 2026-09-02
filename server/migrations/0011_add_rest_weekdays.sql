-- Weekdays with nothing due, per challenge. Saturday for an observant user, or simply
-- a planned rest day. A rest day is never required, never breaks a streak, and cannot
-- be logged, so `length_days` counts ACTIVE days from here on: a 60-day challenge with
-- Saturdays off spans about 70 calendar days and is still 60 real days of work.
--
-- Existing rows read '{}', under which every rest-aware function reduces exactly to the
-- calendar arithmetic it replaced, so no stored day_number needs rewriting.
alter table public.challenges
  add column rest_weekdays smallint[] not null default '{}'::smallint[];

alter table public.challenges
  add constraint challenges_rest_weekdays_valid check (
    -- array_length of an empty array is NULL, and a NULL check constraint passes, so
    -- the empty case has to be handled on purpose rather than by accident.
    coalesce(array_length(rest_weekdays, 1), 0) <= 6
    and rest_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  );

-- How a rule sits in the day. Rules differ in kind, not just in length: drinking
-- water is spread across the whole day, project work needs an uninterrupted block,
-- taking vitamins is one instant. Nothing in kind/target distinguishes those, which
-- is why every rule was being offered the same three anchors.
alter table public.tasks
  add column schedule_mode text not null default 'unset'
    check (schedule_mode in ('unset', 'anytime', 'fixed', 'anchored')),
  add column scheduled_time time;

-- A fixed rule must say when; the others must not pretend to.
alter table public.tasks
  add constraint tasks_scheduled_time_matches_mode check (
    (schedule_mode = 'fixed' and scheduled_time is not null)
    or (schedule_mode <> 'fixed' and scheduled_time is null)
  );

-- Not every outcome is a number. "Finish the project" or "ship to production" is
-- done or not done, and forcing it into a start/target pair would be dishonest
-- arithmetic. Numeric goals keep their readings; milestones just get ticked.
alter table public.goals
  add column kind text not null default 'number' check (kind in ('number', 'milestone')),
  add column completed_on date;

-- A numeric goal needs both ends; a milestone must not pretend to have them.
alter table public.goals
  alter column start_value drop not null,
  alter column target_value drop not null;

alter table public.goals
  add constraint goals_values_match_kind check (
    (kind = 'number' and start_value is not null and target_value is not null)
    or (kind = 'milestone' and start_value is null and target_value is null)
  );

-- Only a milestone can be marked done outright; a numeric goal is finished by its
-- readings reaching the target, so a stored flag there could contradict the data.
alter table public.goals
  add constraint goals_completed_only_for_milestones check (
    completed_on is null or kind = 'milestone'
  );

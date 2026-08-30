-- An implementation intention: the "when and where" half of "when X, then I do Y".
-- Specifying the cue is one of the few habit techniques with replicated effect sizes
-- (d = .14 to .31), and it costs one optional field.
alter table public.tasks
  add column cue text check (cue is null or length(cue) <= 120);

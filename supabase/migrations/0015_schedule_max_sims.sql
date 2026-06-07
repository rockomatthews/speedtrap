alter table public.venue_schedule_rules
add column if not exists max_sims integer;

update public.venue_schedule_rules
set max_sims = 4
where max_sims is null;

alter table public.venue_schedule_rules
alter column max_sims set default 4;

alter table public.venue_schedule_rules
alter column max_sims set not null;

alter table public.venue_schedule_rules
drop constraint if exists venue_schedule_rules_max_sims_check;

alter table public.venue_schedule_rules
add constraint venue_schedule_rules_max_sims_check
check (max_sims between 1 and 4);

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.venue_schedule_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%opens_at%<%closes_at%'
  loop
    execute format('alter table public.venue_schedule_rules drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.venue_schedule_rules
add constraint venue_schedule_rules_open_close_not_equal_check
check (opens_at <> closes_at);

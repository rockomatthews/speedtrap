do $$
begin
  if not exists (select from racing_discount_settings where id=1 and enabled=false and percent=0) then raise exception 'Must default off'; end if;
  if not exists (select from race_bookings where amount_cents=3024 and racing_discount_percent=0 and racing_discount_cents=0) then raise exception 'Existing prices changed'; end if;
  if not exists (select from race_booking_holds where amount_cents=3024 and racing_discount_percent=0 and racing_discount_cents=0) then raise exception 'Existing holds changed'; end if;
  if not (select relrowsecurity from pg_class where oid='public.racing_discount_settings'::regclass) then raise exception 'RLS missing'; end if;
  if has_table_privilege('anon','racing_discount_settings','SELECT') or has_table_privilege('anon','racing_discount_settings','UPDATE') or has_table_privilege('authenticated','racing_discount_settings','UPDATE') or has_table_privilege('authenticated','racing_discount_settings','SELECT') then raise exception 'Client role access unexpectedly granted'; end if;
  begin update racing_discount_settings set enabled=true,percent=0; raise exception 'Enabled zero accepted'; exception when check_violation then null; end;
  begin update racing_discount_settings set percent=96; raise exception 'Excess percentage accepted'; exception when check_violation then null; end;
  begin insert into racing_discount_settings(id) values(2); raise exception 'Second settings row accepted'; exception when check_violation then null; end;
  begin update race_bookings set racing_discount_cents=-1; raise exception 'Negative discount accepted'; exception when check_violation then null; end;
end $$;
set role service_role;
update racing_discount_settings set enabled=true,percent=25 where id=1;
select enabled,percent from racing_discount_settings;
update racing_discount_settings set enabled=false where id=1;
reset role;
select 'PASS: defaults, legacy records, bounds, singleton, RLS and service access' as verification;

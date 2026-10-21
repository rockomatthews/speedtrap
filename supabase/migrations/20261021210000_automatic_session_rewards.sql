-- Award snapshotted rewards after paid sessions end, without staff attendance checks.
-- Serialize workers so referral ordering and caps remain deterministic.
create function public.rewards_complete_due() returns integer
language plpgsql security invoker set search_path=public as $$
declare b record; completed integer:=0;
begin
 if not pg_try_advisory_xact_lock(821021,1) then return 0; end if;
 for b in
  select rb.id from race_bookings rb
  where rb.rewards_completed_at is null
   and rb.profile_id is not null
   and rb.rewards_rate>0 and rb.rewards_subtotal_cents>0
   and rb.ends_at<=now()
   and rb.status in ('confirmed','payment_succeeded_vms_failed')
   and not exists(select 1 from racing_wallet_reservations r where r.hold_id=rb.wallet_hold_id and r.state='refunded')
  order by rb.ends_at,rb.id limit 100
  for update of rb
 loop
  perform rewards_complete(b.id,null);
  completed:=completed+1;
 end loop;
 return completed;
end $$;
revoke all on function public.rewards_complete_due() from public,anon,authenticated;
grant execute on function public.rewards_complete_due() to service_role;

-- Amounts are integer cents; points_units are hundredths of a point.
-- All mutations go through authenticated server endpoints using service_role.
create table public.reward_settings (
 id integer primary key check(id=1), enabled boolean not null default false,
 wallet_sales_enabled boolean not null default false, referrals_enabled boolean not null default false,
 points_per_dollar integer not null default 1 check(points_per_dollar between 1 and 5),
 redemption_points integer not null default 100 check(redemption_points between 100 and 10000),
 reward_cents integer not null default 500 check(reward_cents between 100 and 5000),
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
insert into public.reward_settings(id) values(1);
create table public.reward_promotions (
 id uuid primary key default gen_random_uuid(), name text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, enabled boolean not null default true,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table public.racing_wallets (
 profile_id uuid primary key references public.profiles(id),
 purchased_cents bigint not null default 0, promo_cents bigint not null default 0, points_units bigint not null default 0,
 referral_code text not null unique default replace(gen_random_uuid()::text,'-',''),
 referred_by uuid references public.profiles(id), created_at timestamptz not null default now(), check(referred_by is distinct from profile_id)
);
create table public.racing_wallet_ledger (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.racing_wallets(profile_id),
 bucket text not null check(bucket in ('purchased','promo','points')), amount bigint not null,
 event_key text not null unique, reason text not null, actor_id uuid references public.profiles(id),
 booking_id uuid references public.race_bookings(id), created_at timestamptz not null default now()
);
create index racing_wallet_ledger_profile_idx on public.racing_wallet_ledger(profile_id,created_at desc);
create table public.racing_wallet_topups (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
 amount_cents integer not null check(amount_cents in (2500,5000,10000,20000)),
 stripe_payment_intent_id text unique, stripe_checkout_session_id text unique,
 status text not null default 'pending' check(status in ('pending','paid','refunded')),
 refunded_cents integer not null default 0 check(refunded_cents>=0), created_at timestamptz not null default now()
);
create table public.racing_wallet_reservations (
 hold_id uuid primary key references public.race_booking_holds(id), profile_id uuid not null references public.profiles(id),
 purchased_cents integer not null default 0, promo_cents integer not null default 0,
 state text not null default 'reserved' check(state in ('reserved','payment','consumed','released','refunded')),
 booking_id uuid unique references public.race_bookings(id), created_at timestamptz not null default now()
);
alter table public.race_booking_holds
 add column wallet_purchased_cents integer not null default 0,
 add column wallet_promo_cents integer not null default 0,
 add column rewards_subtotal_cents integer,
 add column rewards_rate integer not null default 0,
 add column rewards_base_rate integer not null default 0;
alter table public.race_bookings
 add column wallet_hold_id uuid unique references public.race_booking_holds(id),
 add column wallet_purchased_cents integer not null default 0,
 add column wallet_promo_cents integer not null default 0,
 add column rewards_subtotal_cents integer,
 add column rewards_rate integer not null default 0,
 add column rewards_base_rate integer not null default 0,
 add column rewards_refunded_cents integer not null default 0,
 add column rewards_completed_at timestamptz,
 add column rewards_completed_by uuid references public.profiles(id);
alter table public.race_bookings drop constraint if exists race_bookings_payment_method_check;
alter table public.race_bookings add constraint race_bookings_payment_method_check check(payment_method in ('card','crypto','membership_credit','wallet','manual','unknown'));
create table public.reward_referrals (
 referee_id uuid primary key references public.profiles(id), referrer_id uuid not null references public.profiles(id),
 booking_id uuid not null unique references public.race_bookings(id), points_units integer not null default 10000,
 reversed boolean not null default false, created_at timestamptz not null default now()
);

create function public.rewards_post(p_profile uuid,p_bucket text,p_amount bigint,p_key text,p_reason text,p_actor uuid default null,p_booking uuid default null,p_allow_debt boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare bal bigint; prior racing_wallet_ledger;
begin
 insert into racing_wallets(profile_id) values(p_profile) on conflict do nothing;
 perform 1 from racing_wallets where profile_id=p_profile for update;
 select * into prior from racing_wallet_ledger where event_key=p_key;
 if found then
  if prior.profile_id<>p_profile or prior.bucket<>p_bucket or prior.amount<>p_amount then raise exception 'Idempotency key conflict'; end if;
  return;
 end if;
 select case p_bucket when 'purchased' then purchased_cents when 'promo' then promo_cents when 'points' then points_units end into bal from racing_wallets where profile_id=p_profile;
 if bal is null then raise exception 'Invalid balance'; end if;
 if p_amount<0 and bal+p_amount<0 and not p_allow_debt then raise exception 'Insufficient balance'; end if;
 insert into racing_wallet_ledger(profile_id,bucket,amount,event_key,reason,actor_id,booking_id) values(p_profile,p_bucket,p_amount,p_key,p_reason,p_actor,p_booking);
 update racing_wallets set purchased_cents=purchased_cents+case when p_bucket='purchased' then p_amount else 0 end,
 promo_cents=promo_cents+case when p_bucket='promo' then p_amount else 0 end,
 points_units=points_units+case when p_bucket='points' then p_amount else 0 end where profile_id=p_profile;
end $$;

create function public.rewards_convert(p_profile uuid,p_key uuid) returns void language plpgsql security invoker set search_path=public as $$
declare s reward_settings;
begin
 select * into s from reward_settings where id=1;
 -- Existing balances remain redeemable even when earning is switched off.
 if exists(select 1 from racing_wallet_ledger where event_key='convert:'||p_key||':points') then return; end if;
 perform rewards_post(p_profile,'points',-s.redemption_points::bigint*100,'convert:'||p_key||':points','Exchange points for racing reward');
 perform rewards_post(p_profile,'promo',s.reward_cents,'convert:'||p_key||':promo','Racing reward from points');
end $$;

create function public.rewards_prepare_hold(p_hold uuid,p_profile uuid,p_use_purchased boolean,p_use_rewards boolean,p_subtotal integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare h race_booking_holds; w racing_wallets; s reward_settings; promo integer:=0; purchased integer:=0; taxable integer; tax integer; total integer; rate integer:=0;
begin
 select * into h from race_booking_holds where id=p_hold for update;
 if not found or h.profile_id is distinct from p_profile or h.status<>'active' or h.expires_at<=now() then raise exception 'Hold unavailable'; end if;
 if exists(select 1 from racing_wallet_reservations where hold_id=p_hold) then raise exception 'Hold already prepared'; end if;
 if p_subtotal<0 or h.amount_cents<>p_subtotal+round(p_subtotal*.08)::integer then raise exception 'Invalid quote'; end if;
 select * into s from reward_settings where id=1;
 insert into racing_wallets(profile_id) values(p_profile) on conflict do nothing;
 select * into w from racing_wallets where profile_id=p_profile for update;
 if p_use_rewards and coalesce(h.racing_discount_percent,0)>0 then raise exception 'Rewards cannot be combined with discount mode'; end if;
 if p_use_rewards and (w.points_units<0 or w.purchased_cents<0) then raise exception 'Contact staff to resolve your rewards balance before redeeming'; end if;
 if p_use_rewards then promo:=least(greatest(w.promo_cents,0),floor(p_subtotal*.25)::integer); end if;
 taxable:=p_subtotal-promo; tax:=round(taxable*.08)::integer; total:=taxable+tax;
 if p_use_purchased then purchased:=least(greatest(w.purchased_cents,0),total); end if;
 -- Stripe card charges cannot be less than 50 cents.
 if total-purchased between 1 and 49 then purchased:=greatest(0,total-50); end if;
 if s.enabled then
  rate:=s.points_per_dollar;
  if exists(select 1 from reward_promotions where enabled and h.starts_at>=starts_at and h.starts_at<ends_at) then rate:=rate*2; end if;
 end if;
 insert into racing_wallet_reservations(hold_id,profile_id,purchased_cents,promo_cents) values(p_hold,p_profile,purchased,promo);
 if purchased>0 then perform rewards_post(p_profile,'purchased',-purchased,'hold:'||p_hold||':purchased','Reserved for racing checkout'); end if;
 if promo>0 then perform rewards_post(p_profile,'promo',-promo,'hold:'||p_hold||':promo','Reserved racing reward'); end if;
 update race_booking_holds set wallet_purchased_cents=purchased,wallet_promo_cents=promo,rewards_subtotal_cents=taxable,rewards_rate=rate,rewards_base_rate=case when s.enabled then s.points_per_dollar else 0 end,amount_cents=total-purchased where id=p_hold;
 return jsonb_build_object('wallet_purchased_cents',purchased,'wallet_promo_cents',promo,'subtotal_cents',taxable,'sales_tax_cents',tax,'amount_cents',total-purchased);
end $$;

create function public.rewards_lock_payment(p_hold uuid,p_profile uuid,p_method text) returns void language plpgsql security invoker set search_path=public as $$
declare h race_booking_holds;
begin
 select * into h from race_booking_holds where id=p_hold for update;
 if h.profile_id is distinct from p_profile or h.status<>'active' or h.expires_at<=now() then raise exception 'Hold unavailable'; end if;
 if p_method not in ('card','crypto') then raise exception 'Invalid payment method'; end if;
 if exists(select 1 from racing_wallet_reservations where hold_id=p_hold and state='payment') and h.payment_method_requested<>p_method then raise exception 'Start a new booking to change payment method'; end if;
 update race_booking_holds set payment_method_requested=p_method where id=p_hold;
 update racing_wallet_reservations set state='payment' where hold_id=p_hold and state in ('reserved','payment');
 if not found then raise exception 'Wallet reservation unavailable'; end if;
end $$;

-- Called only after any associated payment intent is definitively cancelled or absent.
create function public.rewards_release_hold(p_hold uuid) returns void language plpgsql security invoker set search_path=public as $$
declare r racing_wallet_reservations;
begin
 perform 1 from race_booking_holds where id=p_hold for update;
 select * into r from racing_wallet_reservations where hold_id=p_hold for update;
 if not found or r.state not in ('reserved','payment') then return; end if;
 if exists(select 1 from race_bookings where wallet_hold_id=p_hold) then raise exception 'Booking already confirmed'; end if;
 if r.purchased_cents>0 then perform rewards_post(r.profile_id,'purchased',r.purchased_cents,'release:'||p_hold||':purchased','Unused checkout credit returned'); end if;
 if r.promo_cents>0 then perform rewards_post(r.profile_id,'promo',r.promo_cents,'release:'||p_hold||':promo','Unused checkout reward returned'); end if;
 update racing_wallet_reservations set state='released' where hold_id=p_hold;
 update race_booking_holds set status='cancelled' where id=p_hold and status<>'converted';
end $$;

create function public.rewards_booking_insert() returns trigger language plpgsql security invoker set search_path=public as $$
declare r racing_wallet_reservations; h race_booking_holds;
begin
 if new.wallet_hold_id is null then return new; end if;
 select * into h from race_booking_holds where id=new.wallet_hold_id for update;
 select * into r from racing_wallet_reservations where hold_id=new.wallet_hold_id for update;
 if not found or r.state not in ('reserved','payment') then raise exception 'Wallet reservation no longer available'; end if;
 if new.profile_id is distinct from r.profile_id or new.amount_cents<>h.amount_cents then raise exception 'Wallet booking mismatch'; end if;
 new.wallet_purchased_cents:=r.purchased_cents; new.wallet_promo_cents:=r.promo_cents;
 new.rewards_subtotal_cents:=h.rewards_subtotal_cents; new.rewards_rate:=h.rewards_rate; new.rewards_base_rate:=h.rewards_base_rate;
 return new;
end $$;
create trigger rewards_booking_insert before insert on public.race_bookings for each row execute function public.rewards_booking_insert();
create function public.rewards_booking_consumed() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.wallet_hold_id is not null then update racing_wallet_reservations set state='consumed',booking_id=new.id where hold_id=new.wallet_hold_id; end if;
 return new;
end $$;
create trigger rewards_booking_consumed after insert on public.race_bookings for each row execute function public.rewards_booking_consumed();

create function public.rewards_complete(p_booking uuid,p_actor uuid) returns void language plpgsql security invoker set search_path=public as $$
declare b race_bookings; w racing_wallets; ref uuid; eligible integer; rcount integer;
begin
 select * into b from race_bookings where id=p_booking for update;
 if not found or b.status not in ('confirmed','payment_succeeded_vms_failed') or b.ends_at>now() then raise exception 'Only finished, confirmed sessions can earn rewards'; end if;
 if exists(select 1 from racing_wallet_reservations where hold_id=b.wallet_hold_id and state='refunded') then raise exception 'Refunded sessions cannot earn rewards'; end if;
 if b.rewards_completed_at is not null then return; end if;
 if b.profile_id is null or b.rewards_subtotal_cents is null then raise exception 'Booking is not enrolled in rewards'; end if;
 eligible:=greatest(0,b.rewards_subtotal_cents-round(b.rewards_refunded_cents/1.08)::integer);
 perform rewards_post(b.profile_id,'points',eligible::bigint*b.rewards_rate,'earn:'||b.id,'Completed racing session',p_actor,b.id);
 update race_bookings set rewards_completed_at=now(),rewards_completed_by=p_actor where id=b.id;
 select referred_by into ref from racing_wallets where profile_id=b.profile_id;
 if ref is not null and eligible>=3000 and b.rewards_rate>0 and (select referrals_enabled from reward_settings where id=1)
 and not exists(select 1 from reward_referrals where referee_id=b.profile_id)
 and not exists(select 1 from race_bookings where id<>b.id and lower(customer_email)=lower(b.customer_email) and ends_at<b.ends_at and status in ('confirmed','payment_succeeded_vms_failed') and amount_cents+wallet_purchased_cents>0) then
  perform 1 from racing_wallets where profile_id=ref for update;
  select count(*) into rcount from reward_referrals where referrer_id=ref and date_trunc('month',created_at at time zone 'America/New_York')=date_trunc('month',now() at time zone 'America/New_York');
  if rcount<5 then
   insert into reward_referrals(referee_id,referrer_id,booking_id) values(b.profile_id,ref,b.id);
   perform rewards_post(ref,'points',10000,'referral:'||b.id,'Friend completed first qualifying race',p_actor,b.id);
  end if;
 end if;
end $$;

create function public.rewards_refund(p_booking uuid,p_refunded integer,p_full boolean default false) returns void language plpgsql security invoker set search_path=public as $$
declare b race_bookings; already bigint; target bigint; r reward_referrals;
begin
 select * into b from race_bookings where id=p_booking for update;
 if not found or b.wallet_hold_id is null then return; end if;
 if p_refunded<0 then raise exception 'Invalid refund'; end if;
 p_refunded:=greatest(b.rewards_refunded_cents,least(p_refunded,b.amount_cents));
 update race_bookings set rewards_refunded_cents=p_refunded where id=b.id;
 if p_full then
  if b.wallet_purchased_cents>0 then perform rewards_post(b.profile_id,'purchased',b.wallet_purchased_cents,'refund:'||b.id||':purchased','Cancelled race credit returned',null,b.id); end if;
  if b.wallet_promo_cents>0 then perform rewards_post(b.profile_id,'promo',b.wallet_promo_cents,'refund:'||b.id||':promo','Cancelled race reward returned',null,b.id); end if;
  update racing_wallet_reservations set state='refunded' where hold_id=b.wallet_hold_id;
 end if;
 if b.rewards_completed_at is not null then
  select coalesce(sum(amount),0) into already from racing_wallet_ledger where booking_id=b.id and profile_id=b.profile_id and bucket='points' and (event_key='earn:'||b.id or event_key like 'earn-refund:'||b.id||':%');
  target:=case when p_full then 0 else greatest(0,b.rewards_subtotal_cents-round(p_refunded/1.08)::integer)::bigint*b.rewards_rate end;
  if target<already then perform rewards_post(b.profile_id,'points',target-already,'earn-refund:'||b.id||':'||p_refunded||':'||p_full,'Points reversed for refunded racing',null,b.id,true); end if;
 end if;
 if p_full or greatest(0,b.rewards_subtotal_cents-round(p_refunded/1.08)::integer)<3000 then
  select * into r from reward_referrals where booking_id=b.id for update;
  if found and not r.reversed then
   perform rewards_post(r.referrer_id,'points',-r.points_units,'referral-refund:'||b.id,'Referral points reversed after refund',null,b.id,true);
   update reward_referrals set reversed=true where booking_id=b.id;
  end if;
 end if;
end $$;
create function public.rewards_booking_cancelled() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.status in ('cancelled','refunded') and old.status not in ('cancelled','refunded') then
  perform rewards_refund(new.id,new.amount_cents,true);
 end if;
 return new;
end $$;
create trigger rewards_booking_cancelled after update of status on public.race_bookings for each row execute function public.rewards_booking_cancelled();

create function public.rewards_topup_paid(p_topup uuid,p_intent text,p_amount integer,p_refunded integer default 0) returns void language plpgsql security invoker set search_path=public as $$
declare t racing_wallet_topups; delta integer;
begin
 select * into t from racing_wallet_topups where id=p_topup for update;
 if not found or p_amount<>t.amount_cents or p_refunded<0 or p_refunded>p_amount then raise exception 'Top-up payment mismatch'; end if;
 if t.stripe_payment_intent_id is not null and t.stripe_payment_intent_id<>p_intent then raise exception 'Top-up already paid with another intent'; end if;
 perform rewards_post(t.profile_id,'purchased',t.amount_cents,'topup:'||p_topup,'Purchased racing credits');
 delta:=greatest(p_refunded,t.refunded_cents)-t.refunded_cents;
 if delta>0 then perform rewards_post(t.profile_id,'purchased',-delta,'topup-refund:'||p_topup||':'||p_refunded,'Purchased credits refunded',null,null,true); end if;
 update racing_wallet_topups set status=case when greatest(p_refunded,refunded_cents)=amount_cents then 'refunded' else 'paid' end,
 stripe_payment_intent_id=p_intent,refunded_cents=greatest(p_refunded,refunded_cents) where id=p_topup;
end $$;

create function public.rewards_refer(p_profile uuid,p_code text,p_email text) returns void language plpgsql security invoker set search_path=public as $$
declare ref uuid; w racing_wallets;
begin
 if not (select referrals_enabled from reward_settings where id=1) then raise exception 'Referrals are not open yet'; end if;
 insert into racing_wallets(profile_id) values(p_profile) on conflict do nothing;
 select * into w from racing_wallets where profile_id=p_profile for update;
 select profile_id into ref from racing_wallets where referral_code=p_code;
 if ref is null or ref=p_profile then raise exception 'Invalid referral code'; end if;
 if w.referred_by is not null then raise exception 'Referral already recorded'; end if;
 if exists(select 1 from race_bookings b where (b.profile_id=p_profile or lower(b.customer_email)=lower(p_email)) and b.status in ('confirmed','payment_succeeded_vms_failed')) then raise exception 'Referrals are for new racers before their first booking'; end if;
 update racing_wallets set referred_by=ref where profile_id=p_profile;
end $$;

-- No direct browser access. Authenticated endpoints validate the caller then use service_role.
do $$ declare t text; f record; begin
 foreach t in array array['reward_settings','reward_promotions','racing_wallets','racing_wallet_ledger','racing_wallet_topups','racing_wallet_reservations','reward_referrals'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'rewards_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
create function public.rewards_report() returns jsonb language sql security invoker set search_path=public as $$
 select jsonb_build_object(
 'purchased_balance_cents',(select coalesce(sum(purchased_cents),0) from racing_wallets),
 'promo_balance_cents',(select coalesce(sum(promo_cents),0) from racing_wallets),
 'points_units',(select coalesce(sum(points_units),0) from racing_wallets),
 'issued_points_units',(select coalesce(sum(amount),0) from racing_wallet_ledger where bucket='points' and amount>0),
 'redeemed_reward_cents',(select coalesce(sum(promo_cents),0) from racing_wallet_reservations where state='consumed'),
 'completed_sessions',(select count(*) from race_bookings where rewards_completed_at is not null and status not in ('cancelled','refunded')),
 'repeat_racers',(select count(*) from (select profile_id from race_bookings where rewards_completed_at is not null and status not in ('cancelled','refunded') group by profile_id having count(*)>1) r),
 'referrals',(select count(*) from reward_referrals where not reversed)
 );
$$;
revoke all on function public.rewards_report() from public,anon,authenticated;
grant execute on function public.rewards_report() to service_role;

create function public.rewards_reschedule() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.starts_at is distinct from old.starts_at and new.rewards_completed_at is null and new.wallet_hold_id is not null then
  new.rewards_rate:=new.rewards_base_rate*case when exists(select 1 from reward_promotions where enabled and new.starts_at>=starts_at and new.starts_at<ends_at) then 2 else 1 end;
 end if;
 return new;
end $$;
create trigger rewards_reschedule before update of starts_at on public.race_bookings for each row execute function public.rewards_reschedule();
revoke all on function public.rewards_reschedule() from public,anon,authenticated;
grant execute on function public.rewards_reschedule() to service_role;

alter table public.profiles add column gift_membership_until timestamptz, add column gift_membership_lifetime boolean not null default false;
create function public.protect_gift_membership() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if current_user in ('anon','authenticated') then
  if tg_op='INSERT' then
   if new.gift_membership_until is not null or new.gift_membership_lifetime then raise exception 'Gift membership is server managed'; end if;
  elsif new.gift_membership_until is distinct from old.gift_membership_until or new.gift_membership_lifetime is distinct from old.gift_membership_lifetime then raise exception 'Gift membership is server managed';
  end if;
 end if; return new;
end $$;
create trigger protect_gift_membership before insert or update on public.profiles for each row execute function public.protect_gift_membership();
create table public.promo_codes (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9-]{6,40}$'),
 name text not null, kind text not null check(kind in ('membership','percent','fixed','free_session')),
 value integer not null default 0, membership_months integer check(membership_months in (1,12)),
 duration_minutes integer check(duration_minutes in (15,30,60)), max_pods integer not null default 1 check(max_pods between 1 and 4),
 max_uses integer check(max_uses>0), per_account_limit integer not null default 1 check(per_account_limit>0),
 recipient_email text, expires_at timestamptz, enabled boolean not null default true,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 check ((kind='percent' and value between 1 and 100) or (kind='fixed' and value>0) or (kind in ('membership','free_session') and value=0)),
 check(kind<>'free_session' or duration_minutes is not null)
);
create table public.promo_redemptions (
 id uuid primary key default gen_random_uuid(), code_id uuid not null references public.promo_codes(id),
 profile_id uuid not null references public.profiles(id), hold_id uuid unique references public.race_booking_holds(id),
 state text not null check(state in ('reserved','consumed','released')), discount_cents integer not null default 0,
 membership_until timestamptz, membership_lifetime boolean not null default false, created_at timestamptz not null default now()
);
create index promo_redemptions_limits on public.promo_redemptions(code_id,profile_id,state);
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.promo_codes, public.promo_redemptions from anon,authenticated;
grant all on public.promo_codes, public.promo_redemptions to service_role;
alter table public.race_booking_holds add column promo_code text, add column promo_discount_cents integer not null default 0;

-- Service-only validation. Callers hold a code-row lock before reserving or consuming usage.
create function public.promo_validate(p_code text,p_profile uuid) returns public.promo_codes language plpgsql security invoker set search_path=public as $$
declare c promo_codes; email text;
begin
 select * into c from promo_codes where code=upper(trim(p_code));
 if not found or not c.enabled or (c.expires_at is not null and c.expires_at<=now()) then raise exception 'Code is invalid, disabled or expired'; end if;
 select lower(u.email) into email from auth.users u where u.id=p_profile;
 if email is null then raise exception 'Sign in to redeem a code'; end if;
 if c.recipient_email is not null and lower(c.recipient_email)<>email then raise exception 'This code is reserved for another account'; end if;
 if c.max_uses is not null and (select count(*) from promo_redemptions where code_id=c.id and state<>'released')>=c.max_uses then raise exception 'This code has reached its usage limit'; end if;
 if (select count(*) from promo_redemptions where code_id=c.id and profile_id=p_profile and state<>'released')>=c.per_account_limit then raise exception 'You have already used this code'; end if;
 return c;
end $$;
create function public.promo_racing_quote(p_code text,p_profile uuid,p_duration integer,p_pods integer,p_subtotal integer) returns jsonb language plpgsql security invoker set search_path=public as $$
declare c promo_codes; savings integer;
begin
 c:=promo_validate(p_code,p_profile);
 if c.kind='membership' then raise exception 'Redeem membership gifts in your account before booking'; end if;
 if p_pods>c.max_pods then raise exception 'This code does not cover that many pods'; end if;
 if c.kind='free_session' and p_duration<>c.duration_minutes then raise exception 'Choose the session length specified by this free-session code'; end if;
 savings:=case c.kind when 'percent' then round(p_subtotal*c.value/100.0)::integer when 'fixed' then least(c.value,p_subtotal) else p_subtotal end;
 return jsonb_build_object('code',c.code,'discount_cents',savings,'subtotal_cents',greatest(0,p_subtotal-savings));
end $$;
create function public.promo_prepare_hold(p_hold uuid,p_profile uuid,p_code text,p_subtotal integer,p_use_purchased boolean) returns jsonb language plpgsql security invoker set search_path=public as $$
declare h race_booking_holds; c promo_codes; q jsonb; w jsonb;
begin
 select * into h from race_booking_holds where id=p_hold for update;
 if not found or h.profile_id is distinct from p_profile or h.status<>'active' or h.expires_at<=now() then raise exception 'Booking hold unavailable'; end if;
 select * into c from promo_codes where code=upper(trim(p_code)) for update;
 q:=promo_racing_quote(p_code,p_profile,h.duration_minutes,h.sim_count,p_subtotal);
 insert into promo_redemptions(code_id,profile_id,hold_id,state,discount_cents) values(c.id,p_profile,h.id,'reserved',(q->>'discount_cents')::integer);
 update race_booking_holds set amount_cents=(q->>'subtotal_cents')::integer+round((q->>'subtotal_cents')::numeric*.08)::integer,promo_code=c.code,promo_discount_cents=(q->>'discount_cents')::integer,
  membership_free_race_applied=false,membership_free_race_month=null,membership_discount_cents=0,membership_credit_type='none',membership_credit_month=null,membership_credit_year=null,
  racing_discount_percent=0,racing_discount_cents=0 where id=h.id;
 w:=rewards_prepare_hold(h.id,p_profile,p_use_purchased,false,(q->>'subtotal_cents')::integer);
 return w || jsonb_build_object('promo_code',c.code,'promo_discount_cents',(q->>'discount_cents')::integer,'membership_free_race_applied',false,'membership_discount_cents',0,'membership_credit_label',null,'racing_discount_percent',0,'racing_discount_cents',0);
end $$;
create function public.promo_wallet_state() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.state='released' then update promo_redemptions set state='released' where hold_id=new.hold_id and state='reserved';
 elsif new.state='consumed' then update promo_redemptions set state='consumed' where hold_id=new.hold_id and state='reserved';
 end if;
 -- Confirmed/refunded bookings retain their use: cancellation is not another free redemption.
 return new;
end $$;
create trigger promo_wallet_state after update of state on public.racing_wallet_reservations for each row execute function public.promo_wallet_state();
create function public.promo_redeem_membership(p_code text,p_profile uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare c promo_codes; p profiles; ends timestamptz;
begin
 select * into c from promo_codes where code=upper(trim(p_code)) for update;
 c:=promo_validate(p_code,p_profile);
 if c.kind<>'membership' then raise exception 'Apply racing codes when booking your session'; end if;
 select * into p from profiles where id=p_profile for update;
 if not found then raise exception 'Account profile unavailable'; end if;
 if p.gift_membership_lifetime or p.gift_membership_until>now() or (p.membership_status in ('active','active-start') and (p.membership_current_period_end is null or p.membership_current_period_end>now())) then raise exception 'This account already has an active membership. Give the gift to a separate recipient account'; end if;
 ends:=case when c.membership_months is null then null else now()+make_interval(months=>c.membership_months) end;
 update profiles set gift_membership_until=ends,gift_membership_lifetime=c.membership_months is null where id=p_profile;
 insert into promo_redemptions(code_id,profile_id,state,membership_until,membership_lifetime) values(c.id,p_profile,'consumed',ends,c.membership_months is null);
 return jsonb_build_object('membership_until',ends,'membership_lifetime',c.membership_months is null);
end $$;
revoke all on function public.promo_validate(text,uuid), public.promo_racing_quote(text,uuid,integer,integer,integer), public.promo_prepare_hold(uuid,uuid,text,integer,boolean), public.promo_redeem_membership(text,uuid), public.promo_wallet_state(), public.protect_gift_membership() from public,anon,authenticated;
grant execute on function public.promo_validate(text,uuid), public.promo_racing_quote(text,uuid,integer,integer,integer), public.promo_prepare_hold(uuid,uuid,text,integer,boolean), public.promo_redeem_membership(text,uuid), public.promo_wallet_state(), public.protect_gift_membership() to service_role;
alter table public.race_bookings add column promo_code text, add column promo_discount_cents integer not null default 0;
create function public.promo_booking_snapshot() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.wallet_hold_id is not null then
  select promo_code,promo_discount_cents into new.promo_code,new.promo_discount_cents from race_booking_holds where id=new.wallet_hold_id;
 end if; return new;
end $$;
create trigger promo_booking_snapshot before insert on public.race_bookings for each row execute function public.promo_booking_snapshot();
revoke all on function public.promo_booking_snapshot() from public,anon,authenticated;
grant execute on function public.promo_booking_snapshot() to service_role;
create view public.promo_code_summary with (security_invoker=true) as
 select c.*,count(r.id) filter(where r.state='consumed') as used_count,
 count(r.id) filter(where r.state='reserved') as reserved_count
 from public.promo_codes c left join public.promo_redemptions r on r.code_id=c.id group by c.id;
revoke all on public.promo_code_summary from anon,authenticated;
grant select on public.promo_code_summary to service_role;

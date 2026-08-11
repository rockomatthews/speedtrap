alter table public.leagues
  add column if not exists full_season_fee_cents integer not null default 30000 check (full_season_fee_cents >= 0);

alter table public.leagues alter column league_night set default 'Tuesday';
alter table public.leagues alter column team_scoring_count set default 4;

update public.leagues
set league_night = 'Tuesday'
where league_night = 'Monday'
  and status in ('draft', 'active');

update public.leagues
set team_scoring_count = 4
where team_scoring_count is distinct from 4;

do $$
begin
  create type public.league_registration_payment_option as enum ('installments', 'full_season');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.league_registration_status as enum ('pending_payment', 'registered', 'cancelled', 'refunded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.league_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  vms_customer_id integer not null,
  driver_name text not null,
  customer_email text not null,
  customer_phone text,
  payment_option public.league_registration_payment_option not null,
  status public.league_registration_status not null default 'pending_payment',
  amount_cents integer not null default 0 check (amount_cents >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, profile_id),
  unique (league_id, vms_customer_id)
);

create index if not exists league_registrations_league_status_idx
  on public.league_registrations (league_id, status);

create index if not exists league_registrations_profile_idx
  on public.league_registrations (profile_id);

drop trigger if exists league_registrations_updated_at on public.league_registrations;
create trigger league_registrations_updated_at
  before update on public.league_registrations
  for each row execute function public.set_updated_at();

alter table public.league_registrations enable row level security;

drop policy if exists "Users can read their own league registrations" on public.league_registrations;
drop policy if exists "Admins can manage league registrations" on public.league_registrations;

create policy "Users can read their own league registrations"
  on public.league_registrations
  for select
  to authenticated
  using ((select auth.uid()) = profile_id or public.is_admin());

create policy "Admins can manage league registrations"
  on public.league_registrations
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.league_registrations to authenticated;

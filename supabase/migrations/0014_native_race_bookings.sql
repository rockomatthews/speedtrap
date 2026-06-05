-- Native online sim booking system.
-- Stripe is the online payment source of truth; VMS remains the racing booking source of truth.

create table if not exists public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.venue_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

create table if not exists public.venue_blackouts (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table if not exists public.race_bookings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'online_stripe' check (source in ('online_stripe', 'toast_walkin', 'admin')),
  profile_id uuid references public.profiles (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  duration_minutes integer not null check (duration_minutes in (15, 30)),
  sim_count integer not null check (sim_count between 1 and 4),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_until timestamptz not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'confirmed', 'payment_failed', 'payment_succeeded_vms_failed', 'cancelled', 'refunded')
  ),
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_refund_id text,
  vms_customer_id bigint,
  vms_booking_id bigint,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.race_booking_resources (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.race_bookings (id) on delete cascade,
  resource_id uuid not null references public.booking_resources (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (booking_id, resource_id)
);

create table if not exists public.race_booking_holds (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  duration_minutes integer not null check (duration_minutes in (15, 30)),
  sim_count integer not null check (sim_count between 1 and 4),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_until timestamptz not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'active' check (status in ('active', 'converted', 'expired', 'cancelled')),
  stripe_payment_intent_id text unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_venue_schedule_rules_updated_at on public.venue_schedule_rules;
create trigger trg_venue_schedule_rules_updated_at
before update on public.venue_schedule_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_venue_blackouts_updated_at on public.venue_blackouts;
create trigger trg_venue_blackouts_updated_at
before update on public.venue_blackouts
for each row execute function public.set_updated_at();

drop trigger if exists trg_race_bookings_updated_at on public.race_bookings;
create trigger trg_race_bookings_updated_at
before update on public.race_bookings
for each row execute function public.set_updated_at();

drop trigger if exists trg_race_booking_holds_updated_at on public.race_booking_holds;
create trigger trg_race_booking_holds_updated_at
before update on public.race_booking_holds
for each row execute function public.set_updated_at();

create index if not exists race_bookings_time_idx on public.race_bookings (starts_at, buffer_until, status);
create index if not exists race_bookings_email_idx on public.race_bookings (lower(customer_email), starts_at desc);
create index if not exists race_booking_holds_time_idx on public.race_booking_holds (starts_at, buffer_until, status, expires_at);
create index if not exists venue_blackouts_time_idx on public.venue_blackouts (starts_at, ends_at);

insert into public.booking_resources (name, display_order)
values ('Sim 1', 1), ('Sim 2', 2), ('Sim 3', 3), ('Sim 4', 4)
on conflict do nothing;

insert into public.venue_schedule_rules (day_of_week, opens_at, closes_at, active)
select d, time '12:00', time '22:00', true
from generate_series(0, 6) as d
where not exists (select 1 from public.venue_schedule_rules);

alter table public.booking_resources enable row level security;
alter table public.venue_schedule_rules enable row level security;
alter table public.venue_blackouts enable row level security;
alter table public.race_bookings enable row level security;
alter table public.race_booking_resources enable row level security;
alter table public.race_booking_holds enable row level security;

drop policy if exists booking_resources_admin_all on public.booking_resources;
create policy booking_resources_admin_all on public.booking_resources
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists venue_schedule_rules_admin_all on public.venue_schedule_rules;
create policy venue_schedule_rules_admin_all on public.venue_schedule_rules
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists venue_blackouts_admin_all on public.venue_blackouts;
create policy venue_blackouts_admin_all on public.venue_blackouts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists race_bookings_read_own_or_admin on public.race_bookings;
create policy race_bookings_read_own_or_admin on public.race_bookings
for select to authenticated
using (
  public.is_admin()
  or profile_id = auth.uid()
  or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists race_booking_resources_read_admin on public.race_booking_resources;
create policy race_booking_resources_read_admin on public.race_booking_resources
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.race_bookings b
    where b.id = race_booking_resources.booking_id
      and (b.profile_id = auth.uid() or lower(b.customer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

grant select on table public.race_bookings to authenticated;
grant select on table public.race_booking_resources to authenticated;

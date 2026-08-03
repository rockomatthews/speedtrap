create table if not exists public.private_event_deposit_quotes (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  event_starts_at timestamptz,
  event_duration_minutes integer check (event_duration_minutes is null or event_duration_minutes > 0),
  guest_count integer check (guest_count is null or guest_count > 0),
  sim_count integer check (sim_count is null or sim_count between 1 and 4),
  total_amount_cents integer not null check (total_amount_cents > 0),
  deposit_percent integer not null default 50 check (deposit_percent between 1 and 100),
  deposit_amount_cents integer not null check (deposit_amount_cents > 0),
  currency text not null default 'usd',
  notes text,
  status text not null default 'quote_sent'
    check (status in ('quote_sent', 'deposit_paid', 'cancelled', 'refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  deposit_paid_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists private_event_deposit_quotes_status_idx
on public.private_event_deposit_quotes (status, event_starts_at);

create index if not exists private_event_deposit_quotes_customer_email_idx
on public.private_event_deposit_quotes (customer_email);

drop trigger if exists trg_private_event_deposit_quotes_updated_at on public.private_event_deposit_quotes;
create trigger trg_private_event_deposit_quotes_updated_at
before update on public.private_event_deposit_quotes
for each row execute function public.set_updated_at();

alter table public.private_event_deposit_quotes enable row level security;

drop policy if exists "Admins can read private event deposit quotes" on public.private_event_deposit_quotes;
create policy "Admins can read private event deposit quotes"
on public.private_event_deposit_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can create private event deposit quotes" on public.private_event_deposit_quotes;
create policy "Admins can create private event deposit quotes"
on public.private_event_deposit_quotes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update private event deposit quotes" on public.private_event_deposit_quotes;
create policy "Admins can update private event deposit quotes"
on public.private_event_deposit_quotes
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

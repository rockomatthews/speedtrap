-- Toast-paid sim session ledger.
-- Toast is the payment source of truth; VMS remains the racing/booking source of truth.

create table if not exists public.toast_session_orders (
  id uuid primary key default gen_random_uuid(),
  toast_event_guid text not null unique,
  toast_order_guid text not null unique,
  toast_check_guid text,
  toast_payment_guid text,
  toast_restaurant_guid text,
  toast_event_type text,
  profile_id uuid references public.profiles (id) on delete set null,
  vms_customer_id bigint,
  vms_booking_id bigint,
  customer_name text,
  customer_email text,
  session_quantity integer not null default 1 check (session_quantity > 0),
  session_minutes integer not null default 30 check (session_minutes > 0),
  status text not null default 'received' check (status in ('received', 'ignored', 'processing', 'booked', 'failed')),
  ignored_reason text,
  error text,
  raw_event jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_toast_session_orders_updated_at on public.toast_session_orders;
create trigger trg_toast_session_orders_updated_at
before update on public.toast_session_orders
for each row execute function public.set_updated_at();

create index if not exists toast_session_orders_profile_idx
on public.toast_session_orders (profile_id, created_at desc);

create index if not exists toast_session_orders_status_idx
on public.toast_session_orders (status, created_at desc);

alter table public.toast_session_orders enable row level security;

drop policy if exists "toast_session_orders_read_own_or_admin" on public.toast_session_orders;
create policy "toast_session_orders_read_own_or_admin"
on public.toast_session_orders for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.vms_customer_id is not null
      and p.vms_customer_id = toast_session_orders.vms_customer_id
  )
);

grant select on table public.toast_session_orders to authenticated;

-- Independent of the deferred game expansion. Start disabled; never rewrite prior bookings.
create table public.racing_discount_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  percent integer not null default 0 check (percent between 0 and 95),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (not enabled or percent > 0)
);
insert into public.racing_discount_settings (id) values (1);
alter table public.racing_discount_settings enable row level security;
revoke all on public.racing_discount_settings from anon, authenticated;
grant select, update on public.racing_discount_settings to service_role;
-- Only the server reads/writes settings. Admin API checks the authenticated profile role.

alter table public.race_booking_holds
  add column racing_discount_percent integer not null default 0 check (racing_discount_percent between 0 and 95),
  add column racing_discount_cents integer not null default 0 check (racing_discount_cents >= 0);
alter table public.race_bookings
  add column racing_discount_percent integer not null default 0 check (racing_discount_percent between 0 and 95),
  add column racing_discount_cents integer not null default 0 check (racing_discount_cents >= 0);

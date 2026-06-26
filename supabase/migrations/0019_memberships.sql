-- Speed Trap monthly memberships.
-- Stripe is the billing source of truth; these fields cache access state for UI and pricing.

alter table public.profiles
add column if not exists membership_status text not null default 'inactive'
  check (membership_status in ('inactive', 'active-start', 'active')),
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists membership_current_period_start timestamptz,
add column if not exists membership_current_period_end timestamptz,
add column if not exists membership_free_race_month text,
add column if not exists membership_free_race_redeemed_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_uidx
on public.profiles (stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_uidx
on public.profiles (stripe_subscription_id)
where stripe_subscription_id is not null;

alter table public.race_booking_holds
add column if not exists profile_id uuid references public.profiles (id) on delete set null,
add column if not exists membership_free_race_month text,
add column if not exists membership_free_race_applied boolean not null default false,
add column if not exists membership_discount_cents integer not null default 0 check (membership_discount_cents >= 0);

alter table public.race_bookings
add column if not exists membership_free_race_month text,
add column if not exists membership_free_race_applied boolean not null default false,
add column if not exists membership_discount_cents integer not null default 0 check (membership_discount_cents >= 0);

create index if not exists race_booking_holds_profile_idx
on public.race_booking_holds (profile_id, created_at desc);

-- Preserve the existing rule: customers may edit normal profile fields, but
-- membership and Stripe linkage remain server-owned through service-role routes.
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, phone, avatar_url) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

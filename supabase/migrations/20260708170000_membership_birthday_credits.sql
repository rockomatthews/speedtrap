alter table public.profiles
add column if not exists birthday date,
add column if not exists membership_monthly_15_race_month text,
add column if not exists membership_monthly_15_race_redeemed_at timestamptz,
add column if not exists membership_birthday_30_race_year integer,
add column if not exists membership_birthday_30_race_redeemed_at timestamptz;

update public.profiles
set
  membership_monthly_15_race_month = coalesce(membership_monthly_15_race_month, membership_free_race_month),
  membership_monthly_15_race_redeemed_at = coalesce(membership_monthly_15_race_redeemed_at, membership_free_race_redeemed_at)
where membership_free_race_month is not null
   or membership_free_race_redeemed_at is not null;

alter table public.race_booking_holds
add column if not exists membership_credit_type text not null default 'none',
add column if not exists membership_credit_month text,
add column if not exists membership_credit_year integer;

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_membership_credit_type_check;

alter table public.race_booking_holds
add constraint race_booking_holds_membership_credit_type_check
check (membership_credit_type in ('none', 'monthly_15', 'birthday_30'));

alter table public.race_bookings
add column if not exists membership_credit_type text not null default 'none',
add column if not exists membership_credit_month text,
add column if not exists membership_credit_year integer;

alter table public.race_bookings
drop constraint if exists race_bookings_membership_credit_type_check;

alter table public.race_bookings
add constraint race_bookings_membership_credit_type_check
check (membership_credit_type in ('none', 'monthly_15', 'birthday_30'));

revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, phone, avatar_url, birthday) on public.profiles to authenticated;

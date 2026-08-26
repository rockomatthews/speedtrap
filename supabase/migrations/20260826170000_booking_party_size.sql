alter table public.race_booking_holds
add column if not exists party_size integer;

update public.race_booking_holds
set party_size = greatest(1, least(8, coalesce(party_size, sim_count, 1)))
where party_size is null or party_size < 1 or party_size > 8;

alter table public.race_booking_holds
alter column party_size set default 1;

alter table public.race_booking_holds
alter column party_size set not null;

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_party_size_check;

alter table public.race_booking_holds
add constraint race_booking_holds_party_size_check
check (party_size between 1 and 8);

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_rotation_duration_check;

alter table public.race_booking_holds
add constraint race_booking_holds_rotation_duration_check
check (party_size <= 4 or duration_minutes >= 30);

alter table public.race_bookings
add column if not exists party_size integer;

update public.race_bookings
set party_size = greatest(1, coalesce(party_size, sim_count, 1))
where party_size is null or party_size < 1;

alter table public.race_bookings
alter column party_size set default 1;

alter table public.race_bookings
alter column party_size set not null;

alter table public.race_bookings
drop constraint if exists race_bookings_party_size_check;

alter table public.race_bookings
add constraint race_bookings_party_size_check
check (party_size >= 1);

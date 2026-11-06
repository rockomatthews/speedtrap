-- New online bookings allow up to fourteen guests; fifteen or more use private events.
-- Preserve prices, pod allocations, and durations on all existing reservations.
alter table public.race_booking_holds drop constraint if exists race_booking_holds_party_size_check;
alter table public.race_booking_holds add constraint race_booking_holds_party_size_check check (party_size between 1 and 14);

-- Widen online party size without rewriting existing holds or confirmed bookings.
-- New sharing/duration rules are validated by the server. Existing paid holds
-- retain their original pod count, duration and price during confirmation.
alter table public.race_booking_holds
  drop constraint if exists race_booking_holds_party_size_check;
alter table public.race_booking_holds
  add constraint race_booking_holds_party_size_check
  check (party_size between 1 and 9);

alter table public.race_booking_holds
add column if not exists payment_method_requested text not null default 'card';

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_payment_method_requested_check;

alter table public.race_booking_holds
add constraint race_booking_holds_payment_method_requested_check
check (payment_method_requested in ('card', 'crypto'));

alter table public.race_bookings
add column if not exists payment_method text;

alter table public.race_bookings
drop constraint if exists race_bookings_payment_method_check;

alter table public.race_bookings
add constraint race_bookings_payment_method_check
check (payment_method is null or payment_method in ('card', 'crypto', 'membership_credit', 'manual', 'unknown'));

update public.race_bookings
set payment_method = case
  when amount_cents = 0 and membership_free_race_applied is true then 'membership_credit'
  when source = 'online_stripe' and stripe_payment_intent_id is not null then 'card'
  else payment_method
end
where payment_method is null;

-- VMS-created bookings should block website availability just like website-created bookings.

alter table public.race_bookings
drop constraint if exists race_bookings_source_check;

alter table public.race_bookings
add constraint race_bookings_source_check
check (source in ('online_stripe', 'toast_walkin', 'admin', 'vms_import'));

alter table public.race_bookings
drop constraint if exists race_bookings_duration_minutes_check;

alter table public.race_bookings
add constraint race_bookings_duration_minutes_check
check (duration_minutes between 1 and 240);

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_duration_minutes_check;

alter table public.race_booking_holds
add constraint race_booking_holds_duration_minutes_check
check (duration_minutes between 1 and 240);

create unique index if not exists race_bookings_vms_booking_id_uidx
on public.race_bookings (vms_booking_id)
where vms_booking_id is not null;

alter table public.race_booking_holds
add column if not exists race_request_type text not null default 'none',
add column if not exists requested_vehicle_id bigint,
add column if not exists requested_vehicle_name text,
add column if not exists requested_circuit_id bigint,
add column if not exists requested_circuit_name text,
add column if not exists requested_hotlap_event_id bigint,
add column if not exists requested_hotlap_event_name text;

alter table public.race_booking_holds
drop constraint if exists race_booking_holds_race_request_type_check;

alter table public.race_booking_holds
add constraint race_booking_holds_race_request_type_check
check (race_request_type in ('none', 'vehicle_circuit', 'hotlap_event'));

alter table public.race_bookings
add column if not exists race_request_type text not null default 'none',
add column if not exists requested_vehicle_id bigint,
add column if not exists requested_vehicle_name text,
add column if not exists requested_circuit_id bigint,
add column if not exists requested_circuit_name text,
add column if not exists requested_hotlap_event_id bigint,
add column if not exists requested_hotlap_event_name text;

alter table public.race_bookings
drop constraint if exists race_bookings_race_request_type_check;

alter table public.race_bookings
add constraint race_bookings_race_request_type_check
check (race_request_type in ('none', 'vehicle_circuit', 'hotlap_event'));

create index if not exists race_bookings_race_request_idx
on public.race_bookings (race_request_type, starts_at desc);

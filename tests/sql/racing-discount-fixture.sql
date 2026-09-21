-- Disposable local PostgreSQL fixture only. Never run this setup on Supabase.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table public.race_booking_holds (id integer primary key, amount_cents integer);
create table public.race_bookings (id integer primary key, amount_cents integer);
insert into race_booking_holds values (1,3024);
insert into race_bookings values (1,3024);

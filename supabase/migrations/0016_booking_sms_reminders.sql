alter table public.race_booking_holds
add column if not exists customer_phone text,
add column if not exists sms_consent_at timestamptz;

alter table public.race_bookings
add column if not exists customer_phone text,
add column if not exists sms_consent_at timestamptz,
add column if not exists reminder_sent_at timestamptz,
add column if not exists reminder_error text,
add column if not exists reminder_provider_message_id text;

create index if not exists race_bookings_sms_reminder_due_idx
on public.race_bookings (starts_at)
where reminder_sent_at is null
  and customer_phone is not null
  and sms_consent_at is not null
  and status in ('confirmed', 'payment_succeeded_vms_failed');

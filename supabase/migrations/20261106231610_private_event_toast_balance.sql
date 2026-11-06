alter table public.private_event_deposit_quotes
  add column balance_paid_at timestamptz,
  add column balance_paid_by uuid references public.profiles(id),
  add column balance_paid_amount_cents integer,
  add column toast_receipt_reference text,
  add constraint private_event_toast_balance_complete check (
    (balance_paid_at is null and balance_paid_by is null and balance_paid_amount_cents is null and toast_receipt_reference is null)
    or
    (balance_paid_at is not null and balance_paid_by is not null and balance_paid_amount_cents is not null and balance_paid_amount_cents > 0
      and toast_receipt_reference is not null and length(trim(toast_receipt_reference)) between 1 and 120)
  );

comment on column public.private_event_deposit_quotes.balance_paid_amount_cents is
  'Quoted pre-tax balance staff attest was collected in Toast. Not a Stripe charge or automated Toast verification.';

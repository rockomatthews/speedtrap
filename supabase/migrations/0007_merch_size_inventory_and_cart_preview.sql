alter table public.merch_items
  add column if not exists size_inventory jsonb not null default '{}'::jsonb;


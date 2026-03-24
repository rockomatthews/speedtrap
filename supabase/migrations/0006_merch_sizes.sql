alter table public.merch_items
  add column if not exists sizes text[] not null default '{}';


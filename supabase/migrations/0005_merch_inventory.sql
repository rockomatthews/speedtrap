alter table public.merch_items
  add column if not exists inventory_count integer not null default 0;

update public.merch_items
set inventory_count = 0
where inventory_count is null;


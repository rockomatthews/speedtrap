-- Merch catalog (used for Stripe one-time purchases)

create table if not exists public.merch_items (
  id text primary key,
  name text not null,
  description text,
  stripe_price_id text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current (function is defined in 0001_profiles.sql, but safe to re-create).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_merch_items_updated_at on public.merch_items;
create trigger trg_merch_items_updated_at
before update on public.merch_items
for each row execute function public.set_updated_at();

-- RLS: merch catalog is authenticated-only.
alter table public.merch_items enable row level security;

drop policy if exists merch_items_read_authenticated on public.merch_items;
create policy merch_items_read_authenticated
on public.merch_items
for select
using (auth.uid() is not null);

-- Admins can manage the catalog.
drop policy if exists merch_items_admin_insert on public.merch_items;
create policy merch_items_admin_insert
on public.merch_items
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists merch_items_admin_update on public.merch_items;
create policy merch_items_admin_update
on public.merch_items
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists merch_items_admin_delete on public.merch_items;
create policy merch_items_admin_delete
on public.merch_items
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);


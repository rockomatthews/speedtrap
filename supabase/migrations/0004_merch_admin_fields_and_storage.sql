-- Extend merch catalog with richer storefront/admin fields.

alter table public.merch_items
  add column if not exists image_url text,
  add column if not exists price_cents integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists stripe_product_id text;

-- Backfill nullable price_cents for existing rows (if any).
update public.merch_items
set price_cents = 0
where price_cents is null;

alter table public.merch_items
  alter column price_cents set not null;

-- Public bucket for merch images.
insert into storage.buckets (id, name, public)
values ('merch', 'merch', true)
on conflict (id) do nothing;

-- Bucket/object policies.
drop policy if exists merch_bucket_public_read on storage.objects;
create policy merch_bucket_public_read
on storage.objects
for select
using (bucket_id = 'merch');

drop policy if exists merch_bucket_admin_insert on storage.objects;
create policy merch_bucket_admin_insert
on storage.objects
for insert
with check (
  bucket_id = 'merch'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists merch_bucket_admin_update on storage.objects;
create policy merch_bucket_admin_update
on storage.objects
for update
using (
  bucket_id = 'merch'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  bucket_id = 'merch'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists merch_bucket_admin_delete on storage.objects;
create policy merch_bucket_admin_delete
on storage.objects
for delete
using (
  bucket_id = 'merch'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);


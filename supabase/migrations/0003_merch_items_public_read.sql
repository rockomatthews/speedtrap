-- Make merch catalog publicly readable (anon + authenticated).

drop policy if exists merch_items_read_authenticated on public.merch_items;
drop policy if exists merch_items_read_public on public.merch_items;

create policy merch_items_read_public
on public.merch_items
for select
using (true);


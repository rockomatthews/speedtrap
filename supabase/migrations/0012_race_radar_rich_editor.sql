-- Rich editor support for Race Radar.

alter table public.race_radar_posts
add column if not exists body_json jsonb;

insert into storage.buckets (id, name, public)
values ('race-radar', 'race-radar', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists race_radar_bucket_public_read on storage.objects;
create policy race_radar_bucket_public_read
on storage.objects
for select
using (bucket_id = 'race-radar');

drop policy if exists race_radar_bucket_admin_insert on storage.objects;
create policy race_radar_bucket_admin_insert
on storage.objects
for insert
with check (bucket_id = 'race-radar' and public.is_admin());

drop policy if exists race_radar_bucket_admin_update on storage.objects;
create policy race_radar_bucket_admin_update
on storage.objects
for update
using (bucket_id = 'race-radar' and public.is_admin())
with check (bucket_id = 'race-radar' and public.is_admin());

drop policy if exists race_radar_bucket_admin_delete on storage.objects;
create policy race_radar_bucket_admin_delete
on storage.objects
for delete
using (bucket_id = 'race-radar' and public.is_admin());

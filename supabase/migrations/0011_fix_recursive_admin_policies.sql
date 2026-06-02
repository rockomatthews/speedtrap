-- Repair recursive RLS policies that checked admin status by querying profiles.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id and role = public.current_profile_role());

drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all"
on public.profiles for select
using (public.is_admin());

drop policy if exists merch_items_admin_insert on public.merch_items;
create policy merch_items_admin_insert
on public.merch_items
for insert
with check (public.is_admin());

drop policy if exists merch_items_admin_update on public.merch_items;
create policy merch_items_admin_update
on public.merch_items
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists merch_items_admin_delete on public.merch_items;
create policy merch_items_admin_delete
on public.merch_items
for delete
using (public.is_admin());

drop policy if exists merch_bucket_admin_insert on storage.objects;
create policy merch_bucket_admin_insert
on storage.objects
for insert
with check (bucket_id = 'merch' and public.is_admin());

drop policy if exists merch_bucket_admin_update on storage.objects;
create policy merch_bucket_admin_update
on storage.objects
for update
using (bucket_id = 'merch' and public.is_admin())
with check (bucket_id = 'merch' and public.is_admin());

drop policy if exists merch_bucket_admin_delete on storage.objects;
create policy merch_bucket_admin_delete
on storage.objects
for delete
using (bucket_id = 'merch' and public.is_admin());

drop policy if exists "vms_hotlap_events_admin_insert" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_insert"
on public.vms_hotlap_events for insert
to authenticated
with check (public.is_admin());

drop policy if exists "vms_hotlap_events_admin_update" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_update"
on public.vms_hotlap_events for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vms_hotlap_events_admin_delete" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_delete"
on public.vms_hotlap_events for delete
to authenticated
using (public.is_admin());

drop policy if exists "vms_hotlap_event_entries_read_own" on public.vms_hotlap_event_entries;
create policy "vms_hotlap_event_entries_read_own"
on public.vms_hotlap_event_entries for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "race_radar_posts_read_published" on public.race_radar_posts;
create policy "race_radar_posts_read_published"
on public.race_radar_posts for select
using (published = true or public.is_admin());

drop policy if exists "race_radar_posts_admin_insert" on public.race_radar_posts;
create policy "race_radar_posts_admin_insert"
on public.race_radar_posts for insert
to authenticated
with check (public.is_admin());

drop policy if exists "race_radar_posts_admin_update" on public.race_radar_posts;
create policy "race_radar_posts_admin_update"
on public.race_radar_posts for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "race_radar_posts_admin_delete" on public.race_radar_posts;
create policy "race_radar_posts_admin_delete"
on public.race_radar_posts for delete
to authenticated
using (public.is_admin());

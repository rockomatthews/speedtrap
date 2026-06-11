alter table public.profiles
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists profile_avatars_public_read on storage.objects;
create policy profile_avatars_public_read
on storage.objects
for select
using (bucket_id = 'profile-avatars');

drop policy if exists profile_avatars_user_insert on storage.objects;
create policy profile_avatars_user_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_user_update on storage.objects;
create policy profile_avatars_user_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_user_delete on storage.objects;
create policy profile_avatars_user_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

grant update (username, display_name, phone, avatar_url) on public.profiles to authenticated;

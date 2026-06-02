-- Portal usernames, hotlap event joins, and Race Radar posts.

alter table public.profiles
add column if not exists username text;

create unique index if not exists profiles_username_unique_idx
on public.profiles (username)
where username is not null;

alter table public.profiles
drop constraint if exists profiles_username_format;

alter table public.profiles
add constraint profiles_username_format
check (
  username is null
  or username ~ '^[a-z0-9][a-z0-9_-]{2,19}$'
);

create table if not exists public.vms_hotlap_event_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.vms_hotlap_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

alter table public.vms_hotlap_event_entries enable row level security;

drop policy if exists "vms_hotlap_event_entries_read_own" on public.vms_hotlap_event_entries;
create policy "vms_hotlap_event_entries_read_own"
on public.vms_hotlap_event_entries for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "vms_hotlap_event_entries_insert_own" on public.vms_hotlap_event_entries;
create policy "vms_hotlap_event_entries_insert_own"
on public.vms_hotlap_event_entries for insert
to authenticated
with check (profile_id = auth.uid());

grant select, insert on table public.vms_hotlap_event_entries to authenticated;

create table if not exists public.race_radar_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) >= 3),
  excerpt text not null default '',
  cover_image_url text,
  body text not null default '',
  tags text[] not null default '{}',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_race_radar_posts_updated_at on public.race_radar_posts;
create trigger trg_race_radar_posts_updated_at
before update on public.race_radar_posts
for each row execute function public.set_updated_at();

alter table public.race_radar_posts enable row level security;

drop policy if exists "race_radar_posts_read_published" on public.race_radar_posts;
create policy "race_radar_posts_read_published"
on public.race_radar_posts for select
using (
  published = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "race_radar_posts_admin_insert" on public.race_radar_posts;
create policy "race_radar_posts_admin_insert"
on public.race_radar_posts for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "race_radar_posts_admin_update" on public.race_radar_posts;
create policy "race_radar_posts_admin_update"
on public.race_radar_posts for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "race_radar_posts_admin_delete" on public.race_radar_posts;
create policy "race_radar_posts_admin_delete"
on public.race_radar_posts for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

grant select, insert, update, delete on table public.race_radar_posts to authenticated;
grant select on table public.race_radar_posts to anon;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) >= 3),
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'members', 'private')),
  starts_at timestamptz,
  ends_at timestamptz,
  scoring_preset text not null default 'standard',
  points_map integer[] not null default array[25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  team_scoring_count integer not null default 2 check (team_scoring_count between 1 and 8),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) >= 2),
  color text not null default '#FFD200',
  logo_url text,
  captain_vms_customer_id bigint,
  captain_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, slug)
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_id uuid references public.league_teams(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  vms_customer_id bigint not null,
  driver_name text not null,
  role text not null default 'driver' check (role in ('driver', 'captain', 'substitute')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, vms_customer_id)
);

create table if not exists public.league_rounds (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'qualifying', 'race-night', 'completed', 'cancelled')),
  car_group text,
  vehicle_ids bigint[] not null default '{}',
  circuit_id bigint,
  circuit_name text,
  qualifying_hotlap_event_id uuid references public.vms_hotlap_events(id) on delete set null,
  race_vms_event_id bigint,
  race_event_name text,
  race_starts_at timestamptz,
  qualifying_starts_at timestamptz,
  qualifying_ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, round_number),
  unique (league_id, slug)
);

create table if not exists public.league_point_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_id uuid references public.league_rounds(id) on delete cascade,
  vms_customer_id bigint not null,
  points integer not null default 0,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists leagues_status_visibility_idx on public.leagues(status, visibility);
create index if not exists league_teams_league_id_idx on public.league_teams(league_id);
create index if not exists league_members_league_id_idx on public.league_members(league_id);
create index if not exists league_members_team_id_idx on public.league_members(team_id);
create index if not exists league_members_vms_customer_id_idx on public.league_members(vms_customer_id);
create index if not exists league_rounds_league_id_idx on public.league_rounds(league_id);
create index if not exists league_rounds_qualifying_hotlap_event_id_idx on public.league_rounds(qualifying_hotlap_event_id);

drop trigger if exists set_leagues_updated_at on public.leagues;
create trigger set_leagues_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();

drop trigger if exists set_league_teams_updated_at on public.league_teams;
create trigger set_league_teams_updated_at
before update on public.league_teams
for each row execute function public.set_updated_at();

drop trigger if exists set_league_members_updated_at on public.league_members;
create trigger set_league_members_updated_at
before update on public.league_members
for each row execute function public.set_updated_at();

drop trigger if exists set_league_rounds_updated_at on public.league_rounds;
create trigger set_league_rounds_updated_at
before update on public.league_rounds
for each row execute function public.set_updated_at();

alter table public.leagues enable row level security;
alter table public.league_teams enable row level security;
alter table public.league_members enable row level security;
alter table public.league_rounds enable row level security;
alter table public.league_point_adjustments enable row level security;

drop policy if exists "Public can read public active leagues" on public.leagues;
create policy "Public can read public active leagues"
on public.leagues
for select
to anon, authenticated
using (visibility = 'public' and status in ('active', 'completed'));

drop policy if exists "Authenticated can read member leagues" on public.leagues;
create policy "Authenticated can read member leagues"
on public.leagues
for select
to authenticated
using (visibility in ('public', 'members') and status in ('active', 'completed'));

drop policy if exists "Admins can manage leagues" on public.leagues;
create policy "Admins can manage leagues"
on public.leagues
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league teams" on public.league_teams;
create policy "Public can read visible league teams"
on public.league_teams
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_teams.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Authenticated can read visible league teams" on public.league_teams;
create policy "Authenticated can read visible league teams"
on public.league_teams
for select
to authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_teams.league_id
      and l.visibility in ('public', 'members')
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Admins can manage league teams" on public.league_teams;
create policy "Admins can manage league teams"
on public.league_teams
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league members" on public.league_members;
create policy "Public can read visible league members"
on public.league_members
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_members.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Authenticated can read visible league members" on public.league_members;
create policy "Authenticated can read visible league members"
on public.league_members
for select
to authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_members.league_id
      and l.visibility in ('public', 'members')
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Admins can manage league members" on public.league_members;
create policy "Admins can manage league members"
on public.league_members
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league rounds" on public.league_rounds;
create policy "Public can read visible league rounds"
on public.league_rounds
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_rounds.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Authenticated can read visible league rounds" on public.league_rounds;
create policy "Authenticated can read visible league rounds"
on public.league_rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_rounds.league_id
      and l.visibility in ('public', 'members')
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Admins can manage league rounds" on public.league_rounds;
create policy "Admins can manage league rounds"
on public.league_rounds
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage league point adjustments" on public.league_point_adjustments;
create policy "Admins can manage league point adjustments"
on public.league_point_adjustments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league point adjustments" on public.league_point_adjustments;
create policy "Public can read visible league point adjustments"
on public.league_point_adjustments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_point_adjustments.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

grant select on public.leagues to anon, authenticated;
grant select on public.league_teams to anon, authenticated;
grant select on public.league_members to anon, authenticated;
grant select on public.league_rounds to anon, authenticated;
grant select on public.league_point_adjustments to anon, authenticated;
grant insert, update, delete on public.leagues to authenticated;
grant insert, update, delete on public.league_teams to authenticated;
grant insert, update, delete on public.league_members to authenticated;
grant insert, update, delete on public.league_rounds to authenticated;
grant insert, update, delete on public.league_point_adjustments to authenticated;

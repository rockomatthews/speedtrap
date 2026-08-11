alter table public.leagues
  add column if not exists season_weeks integer not null default 8 check (season_weeks between 1 and 16),
  add column if not exists team_count integer not null default 8 check (team_count between 2 and 16),
  add column if not exists roster_size integer not null default 4 check (roster_size between 1 and 8),
  add column if not exists weekly_fee_cents integer not null default 4000 check (weekly_fee_cents >= 0),
  add column if not exists prize_pool_percent numeric(5,2) not null default 50 check (prize_pool_percent between 0 and 100),
  add column if not exists league_night text not null default 'Monday',
  add column if not exists league_start_time time not null default '18:00',
  add column if not exists league_end_time time not null default '22:00';

update public.leagues
set
  points_map = array[4, 3, 2, 1],
  team_scoring_count = 4,
  scoring_preset = 'heat-4-3-2-1'
where scoring_preset = 'standard';

create table if not exists public.league_heats (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_id uuid not null references public.league_rounds(id) on delete cascade,
  heat_number integer not null check (heat_number > 0),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'lineup-open' check (status in ('draft', 'lineup-open', 'ready', 'racing', 'completed', 'cancelled')),
  vms_group_event_id bigint,
  vms_booking_id bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (round_id, heat_number)
);

create table if not exists public.league_heat_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_id uuid not null references public.league_rounds(id) on delete cascade,
  heat_id uuid not null references public.league_heats(id) on delete cascade,
  team_id uuid not null references public.league_teams(id) on delete cascade,
  member_id uuid references public.league_members(id) on delete set null,
  vms_customer_id bigint,
  driver_name text,
  grid_position integer,
  finish_position integer check (finish_position is null or finish_position between 1 and 4),
  points integer not null default 0,
  fastest_lap_ms integer,
  vehicle_name text,
  circuit_name text,
  result_status text not null default 'scheduled' check (result_status in ('scheduled', 'confirmed', 'dns', 'dnf', 'penalty')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (heat_id, team_id),
  unique (heat_id, vms_customer_id)
);

create table if not exists public.league_dues (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  amount_cents integer not null default 4000 check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'waived', 'refunded')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_number)
);

create table if not exists public.league_prize_ledger (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  source_type text not null default 'manual_adjustment' check (source_type in ('due', 'payment', 'manual_adjustment', 'payout')),
  amount_cents integer not null,
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists league_heats_league_id_idx on public.league_heats(league_id);
create index if not exists league_heats_round_id_idx on public.league_heats(round_id);
create index if not exists league_heats_starts_at_idx on public.league_heats(starts_at);
create index if not exists league_heat_entries_league_id_idx on public.league_heat_entries(league_id);
create index if not exists league_heat_entries_round_id_idx on public.league_heat_entries(round_id);
create index if not exists league_heat_entries_heat_id_idx on public.league_heat_entries(heat_id);
create index if not exists league_heat_entries_team_id_idx on public.league_heat_entries(team_id);
create index if not exists league_heat_entries_member_id_idx on public.league_heat_entries(member_id);
create index if not exists league_dues_league_id_idx on public.league_dues(league_id);
create index if not exists league_dues_member_id_idx on public.league_dues(member_id);
create index if not exists league_prize_ledger_league_id_idx on public.league_prize_ledger(league_id);

drop trigger if exists set_league_heats_updated_at on public.league_heats;
create trigger set_league_heats_updated_at
before update on public.league_heats
for each row execute function public.set_updated_at();

drop trigger if exists set_league_heat_entries_updated_at on public.league_heat_entries;
create trigger set_league_heat_entries_updated_at
before update on public.league_heat_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_league_dues_updated_at on public.league_dues;
create trigger set_league_dues_updated_at
before update on public.league_dues
for each row execute function public.set_updated_at();

alter table public.league_heats enable row level security;
alter table public.league_heat_entries enable row level security;
alter table public.league_dues enable row level security;
alter table public.league_prize_ledger enable row level security;

drop policy if exists "Public can read visible league heats" on public.league_heats;
create policy "Public can read visible league heats"
on public.league_heats
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_heats.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Authenticated can read visible league heats" on public.league_heats;
create policy "Authenticated can read visible league heats"
on public.league_heats
for select
to authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_heats.league_id
      and l.visibility in ('public', 'members')
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Admins can manage league heats" on public.league_heats;
create policy "Admins can manage league heats"
on public.league_heats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league heat entries" on public.league_heat_entries;
create policy "Public can read visible league heat entries"
on public.league_heat_entries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_heat_entries.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Authenticated can read visible league heat entries" on public.league_heat_entries;
create policy "Authenticated can read visible league heat entries"
on public.league_heat_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_heat_entries.league_id
      and l.visibility in ('public', 'members')
      and l.status in ('active', 'completed')
  )
);

drop policy if exists "Admins can manage league heat entries" on public.league_heat_entries;
create policy "Admins can manage league heat entries"
on public.league_heat_entries
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage league dues" on public.league_dues;
create policy "Admins can manage league dues"
on public.league_dues
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage league prize ledger" on public.league_prize_ledger;
create policy "Admins can manage league prize ledger"
on public.league_prize_ledger
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read visible league prize ledger" on public.league_prize_ledger;
create policy "Public can read visible league prize ledger"
on public.league_prize_ledger
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues l
    where l.id = league_prize_ledger.league_id
      and l.visibility = 'public'
      and l.status in ('active', 'completed')
  )
);

grant select on public.league_heats to anon, authenticated;
grant select on public.league_heat_entries to anon, authenticated;
grant select on public.league_prize_ledger to anon, authenticated;
grant select on public.league_dues to authenticated;
grant insert, update, delete on public.league_heats to authenticated;
grant insert, update, delete on public.league_heat_entries to authenticated;
grant insert, update, delete on public.league_dues to authenticated;
grant insert, update, delete on public.league_prize_ledger to authenticated;

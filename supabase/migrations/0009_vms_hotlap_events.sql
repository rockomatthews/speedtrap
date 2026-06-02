-- Local metadata for VMS hot-lapping events.
-- VMS remains the source of truth for lap results and event scoring.

create extension if not exists pgcrypto;

create table if not exists public.vms_hotlap_events (
  id uuid primary key default gen_random_uuid(),
  vms_hotlap_event_id bigint not null unique check (vms_hotlap_event_id > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) >= 3),
  circuit_id bigint not null check (circuit_id > 0),
  start_date text not null,
  end_date text not null,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_vms_hotlap_events_updated_at on public.vms_hotlap_events;
create trigger trg_vms_hotlap_events_updated_at
before update on public.vms_hotlap_events
for each row execute function public.set_updated_at();

alter table public.vms_hotlap_events enable row level security;

drop policy if exists "vms_hotlap_events_read_authenticated" on public.vms_hotlap_events;
create policy "vms_hotlap_events_read_authenticated"
on public.vms_hotlap_events for select
to authenticated
using (true);

drop policy if exists "vms_hotlap_events_admin_insert" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_insert"
on public.vms_hotlap_events for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "vms_hotlap_events_admin_update" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_update"
on public.vms_hotlap_events for update
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

drop policy if exists "vms_hotlap_events_admin_delete" on public.vms_hotlap_events;
create policy "vms_hotlap_events_admin_delete"
on public.vms_hotlap_events for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

grant select, insert, update, delete on table public.vms_hotlap_events to authenticated;

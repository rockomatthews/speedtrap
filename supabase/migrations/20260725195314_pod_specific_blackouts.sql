alter table public.venue_blackouts
add column if not exists resource_id uuid references public.booking_resources (id) on delete cascade;

create index if not exists venue_blackouts_resource_time_idx
on public.venue_blackouts (resource_id, starts_at, ends_at);

comment on column public.venue_blackouts.resource_id is
'Null means the blackout applies to the whole venue. A resource id means only that sim/pod is blocked.';

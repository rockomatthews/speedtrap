-- Additive, private shadow state. No mail-delivery capability or production booking changes.
create table public.racing_shadow_sources (
 source_id text primary key,
 baseline_through bigint not null check(baseline_through>=0),
 baseline_complete boolean not null default false,
 last_id bigint not null default 0,
 repair_id bigint not null default 0,
 version bigint not null default 0,
 started_at timestamptz not null default now(),
 synced_at timestamptz,
 reconciled_at timestamptz
);
create table public.racing_shadow_laps (
 source_id text not null references public.racing_shadow_sources(source_id),
 lap_id bigint not null,
 driver_id text,
 driver_name text not null,
 board_key text,
 board_label text not null,
 time_ms bigint,
 occurred_at timestamptz,
 valid boolean not null,
 exclusion text,
 removed boolean not null default false,
 checked_at timestamptz not null default now(),
 primary key(source_id,lap_id)
);
create index racing_shadow_board_best on public.racing_shadow_laps(source_id,board_key,time_ms) where valid and not removed;
create table public.racing_shadow_events (
 id uuid primary key default gen_random_uuid(),
 source_id text not null references public.racing_shadow_sources(source_id),
 event_type text not null default 'record_lost' check(event_type='record_lost'),
 board_key text not null,
 recipient_driver_id text not null,
 previous_lap_id bigint not null,
 new_lap_id bigint not null,
 payload jsonb not null,
 status text not null default 'review' check(status in ('review','suppressed','superseded')),
 reason text not null default 'shadow_only',
 review_decision text check(review_decision in ('correct','incorrect')),
 review_note text,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(source_id,board_key,recipient_driver_id,new_lap_id)
);
create index racing_shadow_events_recent on public.racing_shadow_events(created_at desc);
create index racing_shadow_events_cooldown on public.racing_shadow_events(source_id,board_key,recipient_driver_id,created_at);
alter table public.racing_shadow_sources enable row level security;
alter table public.racing_shadow_laps enable row level security;
alter table public.racing_shadow_events enable row level security;
revoke all on public.racing_shadow_sources,public.racing_shadow_laps,public.racing_shadow_events from public,anon,authenticated;
grant all on public.racing_shadow_sources,public.racing_shadow_laps,public.racing_shadow_events to service_role;

create function public.racing_shadow_apply(p_source text,p_version bigint,p_after bigint,p_rows jsonb,p_eof boolean,p_repair boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s racing_shadow_sources; r jsonb; prior racing_shadow_laps; holder racing_shadow_laps;
 lid bigint; edge bigint; prev_id bigint; best bigint; existed boolean; rows_count integer;
 new_valid boolean; bkey text; did text; t bigint; stamp timestamptz;
begin
 select * into s from racing_shadow_sources where source_id=p_source for update;
 if not found then raise exception 'Unknown racing source'; end if;
 if s.version<>p_version or (case when p_repair then s.repair_id else s.last_id end)<>p_after then raise exception 'Stale racing sync; retry from stored cursor'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Invalid racing batch'; end if;
 rows_count:=jsonb_array_length(p_rows); prev_id:=p_after; edge:=p_after;
 -- Reject the complete batch before advancing any cursor on malformed input.
 for r in select value from jsonb_array_elements(p_rows) loop
  lid:=(r->>'lapId')::bigint;
  if lid is null or lid<=prev_id or r->>'sourceId' is distinct from p_source then raise exception 'Invalid racing page order/source'; end if;
  if not (r ? 'valid') or jsonb_typeof(r->'valid')<>'boolean' then raise exception 'Missing lap validity'; end if;
  prev_id:=lid; edge:=lid;
 end loop;
 if p_repair then
  edge:=least(case when p_eof then s.last_id else edge end,s.last_id);
  -- The validated unfiltered VMS page covers this ID interval, including invalid laps.
  update racing_shadow_laps l set removed=true,checked_at=now()
   where l.source_id=p_source and l.lap_id>p_after and l.lap_id<=edge
   and not exists(select 1 from jsonb_array_elements(p_rows) x where (x->>'lapId')::bigint=l.lap_id);
 end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  lid:=(r->>'lapId')::bigint;
  if p_repair and lid>s.last_id then continue; end if;
  bkey:=r->>'boardKey'; did:=r->>'driverId'; t:=(r->>'timeMs')::bigint; stamp:=(r->>'occurredAt')::timestamptz;
  new_valid:=coalesce((r->>'valid')::boolean,false) and bkey is not null and did is not null and t>0 and stamp is not null;
  select * into prior from racing_shadow_laps where source_id=p_source and lap_id=lid;
  existed:=found;
  select min(time_ms) into best from racing_shadow_laps where source_id=p_source and board_key=bkey and valid and not removed;
  -- Only newly observed post-baseline laps can trigger alerts. Edits, replays and late historical imports cannot.
  if not p_repair and not existed and lid>s.baseline_through and stamp>s.started_at and stamp<=now()+interval '5 minutes' and new_valid and t<best then
   for holder in select distinct on(driver_id) * from racing_shadow_laps
    where source_id=p_source and board_key=bkey and valid and not removed and time_ms=best and driver_id<>did
    order by driver_id,lap_id loop
    insert into racing_shadow_events(source_id,board_key,recipient_driver_id,previous_lap_id,new_lap_id,payload,status,reason)
    values(p_source,bkey,holder.driver_id,holder.lap_id,lid,
     jsonb_build_object('boardLabel',r->>'boardLabel','previousMs',best,'newMs',t,'recipientName',holder.driver_name,'newDriverName',r->>'driverName','newDriverId',did,'occurredAt',stamp,'schemaVersion',1,'comparison','VMS venue/car/circuit/transmission; game build and assists unverified'),
     case when exists(select 1 from racing_shadow_events where source_id=p_source and board_key=bkey and recipient_driver_id=holder.driver_id and created_at>now()-interval '24 hours') then 'suppressed' else 'review' end,
     case when exists(select 1 from racing_shadow_events where source_id=p_source and board_key=bkey and recipient_driver_id=holder.driver_id and created_at>now()-interval '24 hours') then '24_hour_cooldown' else 'shadow_only' end)
    on conflict do nothing;
   end loop;
  end if;
  insert into racing_shadow_laps(source_id,lap_id,driver_id,driver_name,board_key,board_label,time_ms,occurred_at,valid,exclusion)
   values(p_source,lid,did,coalesce(r->>'driverName','Driver'),bkey,coalesce(r->>'boardLabel','Unknown'),t,stamp,coalesce(new_valid,false),r->>'exclusion')
   on conflict(source_id,lap_id) do update set driver_id=excluded.driver_id,driver_name=excluded.driver_name,board_key=excluded.board_key,board_label=excluded.board_label,time_ms=excluded.time_ms,occurred_at=excluded.occurred_at,valid=excluded.valid,exclusion=excluded.exclusion,removed=false,checked_at=now();
 end loop;
 -- Never leave a proposed message current after its evidence changes or the recipient reclaims first.
 update racing_shadow_events e set status='superseded',reason='record_reclaimed_or_evidence_changed'
 where e.source_id=p_source and e.status in ('review','suppressed') and (
  not exists(select 1 from racing_shadow_laps l where l.source_id=p_source and l.lap_id=e.new_lap_id and l.driver_id=e.payload->>'newDriverId' and l.valid and not l.removed and l.board_key=e.board_key and l.time_ms=(e.payload->>'newMs')::bigint)
  or not exists(select 1 from racing_shadow_laps l where l.source_id=p_source and l.lap_id=e.previous_lap_id and l.valid and not l.removed and l.driver_id=e.recipient_driver_id and l.board_key=e.board_key and l.time_ms=(e.payload->>'previousMs')::bigint)
  or exists(select 1 from racing_shadow_laps own where own.source_id=p_source and own.board_key=e.board_key and own.driver_id=e.recipient_driver_id and own.valid and not own.removed
   and own.time_ms<=(select min(time_ms) from racing_shadow_laps other where other.source_id=p_source and other.board_key=e.board_key and other.valid and not other.removed))
 );
 update racing_shadow_sources set version=version+1,
  last_id=case when p_repair then last_id else edge end,
  baseline_complete=baseline_complete or (not p_repair and (p_eof or edge>=baseline_through)),
  repair_id=case when p_repair then case when p_eof or edge>=last_id then 0 else edge end else repair_id end,
  reconciled_at=case when p_repair and (p_eof or edge>=last_id) then now() else reconciled_at end,
  synced_at=case when p_repair then synced_at else now() end
 where source_id=p_source returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.racing_shadow_apply(text,bigint,bigint,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.racing_shadow_apply(text,bigint,bigint,jsonb,boolean,boolean) to service_role;

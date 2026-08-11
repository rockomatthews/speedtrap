create or replace function public.is_league_team_captain(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select exists (
      select 1
      from public.league_members lm
      left join public.profiles p on p.id = (select auth.uid())
      where lm.team_id = team_uuid
        and lm.role = 'captain'
        and (
          lm.profile_id = (select auth.uid())
          or (
            p.vms_customer_id is not null
            and lm.vms_customer_id = p.vms_customer_id
          )
        )
    )
    or exists (
      select 1
      from public.league_teams lt
      join public.profiles p on p.id = (select auth.uid())
      where lt.id = team_uuid
        and lt.captain_vms_customer_id is not null
        and p.vms_customer_id = lt.captain_vms_customer_id
    )),
    false
  );
$$;

revoke all on function public.is_league_team_captain(uuid) from public;
grant execute on function public.is_league_team_captain(uuid) to authenticated;

drop policy if exists "Captains can rename own league team" on public.league_teams;
create policy "Captains can rename own league team"
on public.league_teams
for update
to authenticated
using (public.is_league_team_captain(id))
with check (public.is_league_team_captain(id));

revoke update on public.league_teams from authenticated;
grant update (name, slug, updated_at) on public.league_teams to authenticated;

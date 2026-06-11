-- Repair production profile policies that can recurse when a policy queries profiles
-- while evaluating profiles access.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
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
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_read_all" on public.profiles;

create policy "profiles_read_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "profiles_admin_read_all"
on public.profiles for select
to authenticated
using (public.is_admin());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Keep role and VMS linkage server-owned. The self-update policy above only applies
-- to columns the authenticated role is allowed to update.
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, phone) on public.profiles to authenticated;

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { slugify } from '@/lib/leagues/slug';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(48)
});

async function getCaptainContext(slug: string) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user }
  } = await authClient.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: 'Login required' }, { status: 401 }) };

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,vms_customer_id')
    .eq('id', user.id)
    .maybeSingle<{ id: string; vms_customer_id: number | null }>();

  if (profileError) return { error: NextResponse.json({ error: profileError.message }, { status: 500 }) };

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id,slug,name,status,visibility')
    .eq('slug', slug)
    .maybeSingle<{ id: string; slug: string; name: string; status: string; visibility: string }>();

  if (leagueError) return { error: NextResponse.json({ error: leagueError.message }, { status: 500 }) };
  if (!league) return { error: NextResponse.json({ error: 'League not found' }, { status: 404 }) };

  let captainQuery = supabase
    .from('league_members')
    .select('id,team_id,driver_name,vms_customer_id,role')
    .eq('league_id', league.id)
    .eq('role', 'captain')
    .not('team_id', 'is', null);

  if (profile?.vms_customer_id) {
    captainQuery = captainQuery.or(`profile_id.eq.${user.id},vms_customer_id.eq.${profile.vms_customer_id}`);
  } else {
    captainQuery = captainQuery.eq('profile_id', user.id);
  }

  const { data: captain, error: captainError } = await captainQuery.maybeSingle<{
    id: string;
    team_id: string;
    driver_name: string;
    vms_customer_id: number;
    role: 'captain';
  }>();

  if (captainError) return { error: NextResponse.json({ error: captainError.message }, { status: 500 }) };
  if (!captain?.team_id) return { error: NextResponse.json({ error: 'Captain team not found' }, { status: 403 }) };

  const { data: team, error: teamError } = await supabase
    .from('league_teams')
    .select('id,league_id,name,slug,color,captain_vms_customer_id,captain_name')
    .eq('id', captain.team_id)
    .eq('league_id', league.id)
    .single<{
      id: string;
      league_id: string;
      name: string;
      slug: string;
      color: string;
      captain_vms_customer_id: number | null;
      captain_name: string | null;
    }>();

  if (teamError) return { error: NextResponse.json({ error: teamError.message }, { status: 500 }) };

  return { supabase, user, profile, league, captain, team };
}

async function uniqueTeamSlug(supabase: ReturnType<typeof createSupabaseAdminClient>, leagueId: string, teamId: string, name: string) {
  const base = slugify(name) || `team-${teamId.slice(0, 8)}`;
  const { data, error } = await supabase
    .from('league_teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('slug', base)
    .neq('id', teamId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? `${base}-${teamId.slice(0, 8)}` : base;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getCaptainContext(slug);
  if ('error' in context) return context.error;

  return NextResponse.json({
    canManage: true,
    league: context.league,
    team: context.team,
    captain: context.captain
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getCaptainContext(slug);
  if ('error' in context) return context.error;

  const input = updateTeamSchema.parse(await request.json());
  const nextSlug = await uniqueTeamSlug(context.supabase, context.league.id, context.team.id, input.name);

  const { data, error } = await context.supabase
    .from('league_teams')
    .update({
      name: input.name,
      slug: nextSlug,
      captain_vms_customer_id: context.captain.vms_customer_id,
      captain_name: context.captain.driver_name
    })
    .eq('id', context.team.id)
    .eq('league_id', context.league.id)
    .select('id,league_id,name,slug,color,captain_vms_customer_id,captain_name')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}

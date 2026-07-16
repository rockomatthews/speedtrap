import { NextResponse } from 'next/server';
import { z } from 'zod';

import { slugify } from '@/lib/leagues/slug';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

export const dynamic = 'force-dynamic';

const createLeagueSchema = z.object({
  name: z.string().min(3),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  visibility: z.enum(['public', 'members', 'private']).default('public'),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  teamScoringCount: z.coerce.number().int().min(1).max(8).default(2)
});

async function requireAdminUser() {
  const { user, role } = await getCurrentUserAndAdminRole();
  if (!user) return { error: NextResponse.json({ error: 'Login required' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Admin required' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('leagues')
    .select('*, league_teams(*), league_members(*), league_rounds(*, vms_hotlap_events(id, slug, name, vms_hotlap_event_id))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leagues: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const input = createLeagueSchema.parse(await request.json());
  const supabase = createSupabaseAdminClient();
  const slug = slugify(input.slug || input.name);

  if (!slug) return NextResponse.json({ error: 'League slug is required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      name: input.name,
      slug,
      description: input.description || null,
      status: input.status,
      visibility: input.visibility,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      team_scoring_count: input.teamScoringCount,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ league: data });
}

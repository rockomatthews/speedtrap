import { NextResponse } from 'next/server';
import { z } from 'zod';

import { slugify } from '@/lib/leagues/slug';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

export const dynamic = 'force-dynamic';

const updateLeagueSchema = z.object({
  name: z.string().min(3).optional(),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  visibility: z.enum(['public', 'members', 'private']).optional(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  teamScoringCount: z.coerce.number().int().min(1).max(8).optional()
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add-team'),
    name: z.string().min(2),
    slug: z.string().optional(),
    color: z.string().default('#FFD200'),
    captainVmsCustomerId: z.coerce.number().int().positive().optional().nullable(),
    captainName: z.string().optional().nullable()
  }),
  z.object({
    action: z.literal('add-member'),
    vmsCustomerId: z.coerce.number().int().positive(),
    driverName: z.string().min(2),
    teamId: z.string().uuid().optional().nullable(),
    role: z.enum(['driver', 'captain', 'substitute']).default('driver')
  }),
  z.object({
    action: z.literal('add-round'),
    roundNumber: z.coerce.number().int().positive(),
    name: z.string().min(2),
    slug: z.string().optional(),
    status: z.enum(['draft', 'qualifying', 'race-night', 'completed', 'cancelled']).default('draft'),
    carGroup: z.string().optional().nullable(),
    circuitId: z.coerce.number().int().positive().optional().nullable(),
    circuitName: z.string().optional().nullable(),
    qualifyingHotlapEventId: z.string().uuid().optional().nullable(),
    raceVmsEventId: z.coerce.number().int().positive().optional().nullable(),
    raceEventName: z.string().optional().nullable(),
    raceStartsAt: z.string().optional().nullable(),
    qualifyingStartsAt: z.string().optional().nullable(),
    qualifyingEndsAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })
]);

async function requireAdminUser() {
  const { user, role } = await getCurrentUserAndAdminRole();
  if (!user) return { error: NextResponse.json({ error: 'Login required' }, { status: 401 }) };
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Admin required' }, { status: 403 }) };
  return { user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const input = updateLeagueSchema.parse(await request.json());
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = slugify(input.slug);
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt || null;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt || null;
  if (input.teamScoringCount !== undefined) patch.team_scoring_count = input.teamScoringCount;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('leagues').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ league: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const input = actionSchema.parse(await request.json());
  const supabase = createSupabaseAdminClient();

  if (input.action === 'add-team') {
    const slug = slugify(input.slug || input.name);
    const { data, error } = await supabase
      .from('league_teams')
      .insert({
        league_id: id,
        name: input.name,
        slug,
        color: input.color,
        captain_vms_customer_id: input.captainVmsCustomerId || null,
        captain_name: input.captainName || null
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ team: data });
  }

  if (input.action === 'add-member') {
    const { data, error } = await supabase
      .from('league_members')
      .upsert(
        {
          league_id: id,
          vms_customer_id: input.vmsCustomerId,
          driver_name: input.driverName,
          team_id: input.teamId || null,
          role: input.role
        },
        { onConflict: 'league_id,vms_customer_id' }
      )
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data });
  }

  const slug = slugify(input.slug || input.name);
  const { data, error } = await supabase
    .from('league_rounds')
    .insert({
      league_id: id,
      round_number: input.roundNumber,
      slug,
      name: input.name,
      status: input.status,
      car_group: input.carGroup || null,
      circuit_id: input.circuitId || null,
      circuit_name: input.circuitName || null,
      qualifying_hotlap_event_id: input.qualifyingHotlapEventId || null,
      race_vms_event_id: input.raceVmsEventId || null,
      race_event_name: input.raceEventName || null,
      race_starts_at: input.raceStartsAt || null,
      qualifying_starts_at: input.qualifyingStartsAt || null,
      qualifying_ends_at: input.qualifyingEndsAt || null,
      notes: input.notes || null
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ round: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('leagues').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

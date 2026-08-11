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
  teamScoringCount: z.coerce.number().int().min(1).max(8).optional(),
  seasonWeeks: z.coerce.number().int().min(1).max(16).optional(),
  teamCount: z.coerce.number().int().min(2).max(16).optional(),
  rosterSize: z.coerce.number().int().min(1).max(8).optional(),
  weeklyFeeCents: z.coerce.number().int().min(0).optional(),
  prizePoolPercent: z.coerce.number().min(0).max(100).optional(),
  leagueNight: z.string().optional(),
  leagueStartTime: z.string().optional(),
  leagueEndTime: z.string().optional()
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
  }),
  z.object({
    action: z.literal('generate-season')
  }),
  z.object({
    action: z.literal('seed-dues')
  }),
  z.object({
    action: z.literal('assign-heat-driver'),
    entryId: z.string().uuid(),
    memberId: z.string().uuid().nullable().optional()
  }),
  z.object({
    action: z.literal('record-heat-result'),
    entryId: z.string().uuid(),
    finishPosition: z.coerce.number().int().min(1).max(4).nullable().optional(),
    resultStatus: z.enum(['scheduled', 'confirmed', 'dns', 'dnf', 'penalty']).default('confirmed'),
    fastestLapMs: z.coerce.number().int().positive().optional().nullable()
  }),
  z.object({
    action: z.literal('mark-due'),
    memberId: z.string().uuid(),
    weekNumber: z.coerce.number().int().positive(),
    status: z.enum(['pending', 'paid', 'waived', 'refunded']),
    notes: z.string().optional().nullable()
  })
]);

const HEAT_TEAM_PATTERNS = [
  [
    [0, 1, 2, 3],
    [4, 5, 6, 7]
  ],
  [
    [0, 1, 4, 5],
    [2, 3, 6, 7]
  ],
  [
    [0, 2, 4, 6],
    [1, 3, 5, 7]
  ],
  [
    [0, 3, 5, 6],
    [1, 2, 4, 7]
  ]
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atTime(date: Date, time: string) {
  const [hour = '18', minute = '00'] = time.split(':');
  const next = new Date(date);
  next.setUTCHours(Number(hour), Number(minute), 0, 0);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function rotateIndexes(indexes: number[], offset: number, teamCount: number) {
  return indexes.map((index) => (index + offset) % teamCount);
}

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
  if (input.seasonWeeks !== undefined) patch.season_weeks = input.seasonWeeks;
  if (input.teamCount !== undefined) patch.team_count = input.teamCount;
  if (input.rosterSize !== undefined) patch.roster_size = input.rosterSize;
  if (input.weeklyFeeCents !== undefined) patch.weekly_fee_cents = input.weeklyFeeCents;
  if (input.prizePoolPercent !== undefined) patch.prize_pool_percent = input.prizePoolPercent;
  if (input.leagueNight !== undefined) patch.league_night = input.leagueNight;
  if (input.leagueStartTime !== undefined) patch.league_start_time = input.leagueStartTime;
  if (input.leagueEndTime !== undefined) patch.league_end_time = input.leagueEndTime;

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

  if (input.action === 'generate-season') {
    const { data: league, error: leagueError } = await supabase.from('leagues').select('*').eq('id', id).single();
    if (leagueError) return NextResponse.json({ error: leagueError.message }, { status: 500 });
    if (!league.starts_at) return NextResponse.json({ error: 'Set a league start date before generating the season.' }, { status: 400 });

    const { data: teams, error: teamsError } = await supabase.from('league_teams').select('*').eq('league_id', id).order('created_at');
    if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
    const expectedTeamCount = Number(league.team_count ?? 8);
    if ((teams ?? []).length < expectedTeamCount) {
      return NextResponse.json({ error: `Add ${expectedTeamCount} teams before generating heats.` }, { status: 400 });
    }

    const seasonWeeks = Number(league.season_weeks ?? 8);
    const startDate = new Date(league.starts_at);
    const rounds = Array.from({ length: seasonWeeks }, (_, index) => {
      const roundNumber = index + 1;
      const raceDate = atTime(addDays(startDate, index * 7), league.league_start_time ?? '18:00');
      return {
        league_id: id,
        round_number: roundNumber,
        slug: `week-${roundNumber}`,
        name: `Week ${roundNumber}`,
        status: 'race-night',
        race_starts_at: raceDate.toISOString(),
        notes: 'Generated 8-heat league race night.'
      };
    });

    const { data: upsertedRounds, error: roundsError } = await supabase
      .from('league_rounds')
      .upsert(rounds, { onConflict: 'league_id,round_number' })
      .select('*');
    if (roundsError) return NextResponse.json({ error: roundsError.message }, { status: 500 });

    const heats = (upsertedRounds ?? []).flatMap((round: any) => {
      const base = new Date(round.race_starts_at);
      return Array.from({ length: 8 }, (_, index) => {
        const startsAt = addMinutes(base, index * 30);
        return {
          league_id: id,
          round_id: round.id,
          heat_number: index + 1,
          name: `Heat ${index + 1}`,
          starts_at: startsAt.toISOString(),
          ends_at: addMinutes(startsAt, 30).toISOString(),
          status: 'lineup-open'
        };
      });
    });

    const { data: upsertedHeats, error: heatsError } = await supabase
      .from('league_heats')
      .upsert(heats, { onConflict: 'round_id,heat_number' })
      .select('*');
    if (heatsError) return NextResponse.json({ error: heatsError.message }, { status: 500 });

    const teamRows = (teams ?? []).slice(0, expectedTeamCount);
    const entries = (upsertedHeats ?? []).flatMap((heat: any) => {
      const slotIndex = Math.floor((Number(heat.heat_number) - 1) / 2);
      const halfIndex = (Number(heat.heat_number) - 1) % 2;
      const round = (upsertedRounds ?? []).find((row: any) => row.id === heat.round_id);
      const weekOffset = Number(round?.round_number ?? 1) - 1;
      const pattern = HEAT_TEAM_PATTERNS[slotIndex % HEAT_TEAM_PATTERNS.length][halfIndex];
      return rotateIndexes(pattern, weekOffset, expectedTeamCount).map((teamIndex, gridIndex) => ({
        league_id: id,
        round_id: heat.round_id,
        heat_id: heat.id,
        team_id: teamRows[teamIndex].id,
        grid_position: gridIndex + 1
      }));
    });

    const { error: entriesError } = await supabase.from('league_heat_entries').upsert(entries, { onConflict: 'heat_id,team_id' });
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

    return NextResponse.json({ rounds: upsertedRounds, heats: upsertedHeats });
  }

  if (input.action === 'seed-dues') {
    const [{ data: league, error: leagueError }, { data: members, error: membersError }] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id).single(),
      supabase.from('league_members').select('*').eq('league_id', id).not('team_id', 'is', null)
    ]);
    if (leagueError) return NextResponse.json({ error: leagueError.message }, { status: 500 });
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });
    const seasonWeeks = Number(league.season_weeks ?? 8);
    const amountCents = Number(league.weekly_fee_cents ?? 4000);
    const dues = (members ?? []).flatMap((member: any) =>
      Array.from({ length: seasonWeeks }, (_, index) => ({
        league_id: id,
        member_id: member.id,
        week_number: index + 1,
        amount_cents: amountCents,
        status: 'pending'
      }))
    );
    const { error: duesError } = await supabase.from('league_dues').upsert(dues, { onConflict: 'member_id,week_number' });
    if (duesError) return NextResponse.json({ error: duesError.message }, { status: 500 });
    return NextResponse.json({ dues: dues.length });
  }

  if (input.action === 'assign-heat-driver') {
    const { data: entry, error: entryError } = await supabase.from('league_heat_entries').select('*').eq('id', input.entryId).eq('league_id', id).single();
    if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 });

    if (!input.memberId) {
      const { data, error } = await supabase
        .from('league_heat_entries')
        .update({ member_id: null, vms_customer_id: null, driver_name: null, result_status: 'scheduled', finish_position: null, points: 0 })
        .eq('id', input.entryId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ entry: data });
    }

    const { data: member, error: memberError } = await supabase
      .from('league_members')
      .select('*')
      .eq('id', input.memberId)
      .eq('league_id', id)
      .single();
    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
    if (member.team_id !== entry.team_id) return NextResponse.json({ error: 'That driver is not on this team.' }, { status: 400 });

    const { data: existingRoundEntry, error: existingError } = await supabase
      .from('league_heat_entries')
      .select('id')
      .eq('round_id', entry.round_id)
      .eq('member_id', member.id)
      .neq('id', input.entryId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (existingRoundEntry) return NextResponse.json({ error: 'This driver is already assigned to a heat this week.' }, { status: 400 });

    const { data, error } = await supabase
      .from('league_heat_entries')
      .update({ member_id: member.id, vms_customer_id: member.vms_customer_id, driver_name: member.driver_name })
      .eq('id', input.entryId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  if (input.action === 'record-heat-result') {
    const pointsMap = [4, 3, 2, 1];
    const points = input.resultStatus === 'confirmed' && input.finishPosition ? pointsMap[input.finishPosition - 1] ?? 0 : 0;
    const { data, error } = await supabase
      .from('league_heat_entries')
      .update({
        finish_position: input.finishPosition ?? null,
        points,
        fastest_lap_ms: input.fastestLapMs ?? null,
        result_status: input.resultStatus,
        confirmed_by: input.resultStatus === 'confirmed' ? auth.user.id : null,
        confirmed_at: input.resultStatus === 'confirmed' ? new Date().toISOString() : null
      })
      .eq('id', input.entryId)
      .eq('league_id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  if (input.action === 'mark-due') {
    const { data: league, error: leagueError } = await supabase.from('leagues').select('*').eq('id', id).single();
    if (leagueError) return NextResponse.json({ error: leagueError.message }, { status: 500 });
    const { data: due, error: dueError } = await supabase
      .from('league_dues')
      .upsert(
        {
          league_id: id,
          member_id: input.memberId,
          week_number: input.weekNumber,
          amount_cents: Number(league.weekly_fee_cents ?? 4000),
          status: input.status,
          paid_at: input.status === 'paid' ? new Date().toISOString() : null,
          notes: input.notes || null
        },
        { onConflict: 'member_id,week_number' }
      )
      .select('*')
      .single();
    if (dueError) return NextResponse.json({ error: dueError.message }, { status: 500 });

    if (input.status === 'paid') {
      const prizeAmount = Math.round(Number(due.amount_cents) * (Number(league.prize_pool_percent ?? 50) / 100));
      await supabase.from('league_prize_ledger').insert({
        league_id: id,
        source_type: 'due',
        amount_cents: prizeAmount,
        description: `Week ${input.weekNumber} dues prize-pool contribution`
      });
    }

    return NextResponse.json({ due });
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

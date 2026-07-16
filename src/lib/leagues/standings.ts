import { notFound } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { VmsClient } from '@/lib/vms/client';
import type { VmsHotlapLeaderboardRow } from '@/lib/vms/types';

import type {
  League,
  LeagueDriverStanding,
  LeagueMember,
  LeagueRound,
  LeagueRoundDriverResult,
  LeagueStandings,
  LeagueTeam,
  LeagueTeamStanding
} from './types';

function toNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter(Number.isFinite);
  }
  return [];
}

function normalizeLeague(row: any): League {
  return {
    ...row,
    points_map: toNumberArray(row.points_map),
    team_scoring_count: Number(row.team_scoring_count ?? 2)
  };
}

function normalizeRound(row: any): LeagueRound {
  return {
    ...row,
    vehicle_ids: toNumberArray(row.vehicle_ids)
  };
}

function bestRowsByDriver(rows: VmsHotlapLeaderboardRow[]) {
  const byDriver = new Map<number, VmsHotlapLeaderboardRow>();

  for (const row of rows) {
    if (!row.customerId || row.invalid) continue;
    const existing = byDriver.get(row.customerId);
    if (!existing) {
      byDriver.set(row.customerId, row);
      continue;
    }
    const nextTime = row.lapTimeMs ?? Number.MAX_SAFE_INTEGER;
    const existingTime = existing.lapTimeMs ?? Number.MAX_SAFE_INTEGER;
    if (nextTime < existingTime) byDriver.set(row.customerId, row);
  }

  return [...byDriver.values()]
    .sort((a, b) => (a.lapTimeMs ?? Number.MAX_SAFE_INTEGER) - (b.lapTimeMs ?? Number.MAX_SAFE_INTEGER))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getLeagueStandings(slug: string): Promise<LeagueStandings> {
  const supabase = createSupabaseAdminClient();
  const { data: leagueRow, error: leagueError } = await supabase.from('leagues').select('*').eq('slug', slug).maybeSingle();

  if (leagueError) throw new Error(leagueError.message);
  if (!leagueRow) notFound();

  const league = normalizeLeague(leagueRow);
  const [{ data: teamsData, error: teamsError }, { data: membersData, error: membersError }, { data: roundsData, error: roundsError }] =
    await Promise.all([
      supabase.from('league_teams').select('*').eq('league_id', league.id).order('name'),
      supabase.from('league_members').select('*').eq('league_id', league.id).order('driver_name'),
      supabase
        .from('league_rounds')
        .select('*, vms_hotlap_events(id, slug, name, vms_hotlap_event_id)')
        .eq('league_id', league.id)
        .order('round_number')
    ]);

  if (teamsError) throw new Error(teamsError.message);
  if (membersError) throw new Error(membersError.message);
  if (roundsError) throw new Error(roundsError.message);

  const teams = (teamsData ?? []) as LeagueTeam[];
  const members = (membersData ?? []) as LeagueMember[];
  const rounds = (roundsData ?? []).map(normalizeRound);
  const memberByCustomer = new Map(members.map((member) => [Number(member.vms_customer_id), member]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const driverResults = new Map<number, LeagueRoundDriverResult[]>();
  const errors: string[] = [];
  const vms = VmsClient.fromEnv();

  for (const round of rounds) {
    const eventId = round.vms_hotlap_events?.vms_hotlap_event_id;
    if (!eventId) continue;

    try {
      const detail = await vms.getHotlapEvent(eventId, { invalid: 1 });
      const rows = bestRowsByDriver(detail.subEvents.flatMap((subEvent) => subEvent.results));

      for (const row of rows) {
        if (!row.customerId) continue;
        const points = league.points_map[row.rank - 1] ?? 0;
        const current = driverResults.get(row.customerId) ?? [];
        current.push({
          roundId: round.id,
          roundName: round.name,
          roundNumber: round.round_number,
          rank: row.rank,
          points,
          row
        });
        driverResults.set(row.customerId, current);
      }
    } catch (error) {
      errors.push(`${round.name}: ${error instanceof Error ? error.message : 'VMS results could not be loaded'}`);
    }
  }

  const driverStandings: LeagueDriverStanding[] = [...driverResults.entries()]
    .map(([vmsCustomerId, roundResults]) => {
      const member = memberByCustomer.get(vmsCustomerId);
      const team = member?.team_id ? teamById.get(member.team_id) : null;
      const sortedResults = roundResults.sort((a, b) => a.roundNumber - b.roundNumber);

      return {
        vmsCustomerId,
        driverName: member?.driver_name ?? sortedResults[0]?.row.customerName ?? `Driver ${vmsCustomerId}`,
        teamId: member?.team_id ?? null,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
        points: sortedResults.reduce((sum, result) => sum + result.points, 0),
        roundsScored: sortedResults.length,
        wins: sortedResults.filter((result) => result.rank === 1).length,
        bestRank: sortedResults.length ? Math.min(...sortedResults.map((result) => result.rank)) : null,
        roundResults: sortedResults
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || (a.bestRank ?? 999) - (b.bestRank ?? 999) || a.driverName.localeCompare(b.driverName));

  const teamRoundScores = new Map<string, Map<string, number[]>>();
  for (const standing of driverStandings) {
    if (!standing.teamId) continue;
    const roundMap = teamRoundScores.get(standing.teamId) ?? new Map<string, number[]>();
    for (const result of standing.roundResults) {
      const scores = roundMap.get(result.roundId) ?? [];
      scores.push(result.points);
      roundMap.set(result.roundId, scores);
    }
    teamRoundScores.set(standing.teamId, roundMap);
  }

  const teamStandings: LeagueTeamStanding[] = teams
    .map((team) => {
      const roundMap = teamRoundScores.get(team.id) ?? new Map<string, number[]>();
      let points = 0;
      let roundsScored = 0;
      for (const scores of roundMap.values()) {
        const topScores = scores.sort((a, b) => b - a).slice(0, league.team_scoring_count);
        if (topScores.length > 0) roundsScored += 1;
        points += topScores.reduce((sum, score) => sum + score, 0);
      }
      return {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        points,
        roundsScored
      };
    })
    .sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName));

  return { league, teams, members, rounds, driverStandings, teamStandings, errors };
}

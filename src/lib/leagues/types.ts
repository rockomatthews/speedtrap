import type { VmsHotlapLeaderboardRow } from '@/lib/vms/types';

export type LeagueStatus = 'draft' | 'active' | 'completed' | 'archived';
export type LeagueVisibility = 'public' | 'members' | 'private';
export type LeagueRoundStatus = 'draft' | 'qualifying' | 'race-night' | 'completed' | 'cancelled';

export type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: LeagueStatus;
  visibility: LeagueVisibility;
  starts_at: string | null;
  ends_at: string | null;
  points_map: number[];
  team_scoring_count: number;
  season_weeks: number;
  team_count: number;
  roster_size: number;
  weekly_fee_cents: number;
  prize_pool_percent: number;
  league_night: string;
  league_start_time: string;
  league_end_time: string;
  created_at: string;
  updated_at: string;
};

export type LeagueTeam = {
  id: string;
  league_id: string;
  slug: string;
  name: string;
  color: string;
  logo_url: string | null;
  captain_vms_customer_id: number | null;
  captain_name: string | null;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  team_id: string | null;
  profile_id: string | null;
  vms_customer_id: number;
  driver_name: string;
  role: 'driver' | 'captain' | 'substitute';
};

export type LeagueRound = {
  id: string;
  league_id: string;
  round_number: number;
  slug: string;
  name: string;
  status: LeagueRoundStatus;
  car_group: string | null;
  vehicle_ids: number[];
  circuit_id: number | null;
  circuit_name: string | null;
  qualifying_hotlap_event_id: string | null;
  race_vms_event_id: number | null;
  race_event_name: string | null;
  race_starts_at: string | null;
  qualifying_starts_at: string | null;
  qualifying_ends_at: string | null;
  notes: string | null;
  vms_hotlap_events?: {
    id: string;
    slug: string;
    name: string;
    vms_hotlap_event_id: number;
  } | null;
};

export type LeagueHeatStatus = 'draft' | 'lineup-open' | 'ready' | 'racing' | 'completed' | 'cancelled';

export type LeagueHeat = {
  id: string;
  league_id: string;
  round_id: string;
  heat_number: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: LeagueHeatStatus;
  vms_group_event_id: number | null;
  vms_booking_id: number | null;
  notes: string | null;
};

export type LeagueHeatEntry = {
  id: string;
  league_id: string;
  round_id: string;
  heat_id: string;
  team_id: string;
  member_id: string | null;
  vms_customer_id: number | null;
  driver_name: string | null;
  grid_position: number | null;
  finish_position: number | null;
  points: number;
  fastest_lap_ms: number | null;
  vehicle_name: string | null;
  circuit_name: string | null;
  result_status: 'scheduled' | 'confirmed' | 'dns' | 'dnf' | 'penalty';
};

export type LeagueDue = {
  id: string;
  league_id: string;
  member_id: string;
  week_number: number;
  amount_cents: number;
  status: 'pending' | 'paid' | 'waived' | 'refunded';
  paid_at: string | null;
};

export type LeaguePrizeLedgerEntry = {
  id: string;
  league_id: string;
  source_type: 'due' | 'payment' | 'manual_adjustment' | 'payout';
  amount_cents: number;
  description: string;
  created_at: string;
};

export type LeagueDriverStanding = {
  vmsCustomerId: number;
  driverName: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  points: number;
  roundsScored: number;
  wins: number;
  starts: number;
  podiums: number;
  averageFinish: number | null;
  bestRank: number | null;
  roundResults: LeagueRoundDriverResult[];
};

export type LeagueRoundDriverResult = {
  roundId: string;
  roundName: string;
  roundNumber: number;
  rank: number;
  points: number;
  source: 'heat' | 'qualifying';
  heatId?: string;
  heatName?: string;
  finishPosition?: number | null;
  row?: VmsHotlapLeaderboardRow;
};

export type LeagueTeamStanding = {
  teamId: string;
  teamName: string;
  teamColor: string;
  points: number;
  roundsScored: number;
  wins: number;
};

export type LeagueStandings = {
  league: League;
  teams: LeagueTeam[];
  members: LeagueMember[];
  rounds: LeagueRound[];
  heats: LeagueHeat[];
  heatEntries: LeagueHeatEntry[];
  dues: LeagueDue[];
  prizeLedger: LeaguePrizeLedgerEntry[];
  driverStandings: LeagueDriverStanding[];
  teamStandings: LeagueTeamStanding[];
  errors: string[];
};

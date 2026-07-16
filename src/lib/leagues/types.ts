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

export type LeagueDriverStanding = {
  vmsCustomerId: number;
  driverName: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  points: number;
  roundsScored: number;
  wins: number;
  bestRank: number | null;
  roundResults: LeagueRoundDriverResult[];
};

export type LeagueRoundDriverResult = {
  roundId: string;
  roundName: string;
  roundNumber: number;
  rank: number;
  points: number;
  row: VmsHotlapLeaderboardRow;
};

export type LeagueTeamStanding = {
  teamId: string;
  teamName: string;
  teamColor: string;
  points: number;
  roundsScored: number;
};

export type LeagueStandings = {
  league: League;
  teams: LeagueTeam[];
  members: LeagueMember[];
  rounds: LeagueRound[];
  driverStandings: LeagueDriverStanding[];
  teamStandings: LeagueTeamStanding[];
  errors: string[];
};

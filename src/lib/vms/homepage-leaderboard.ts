import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { syncHotlapEventsFromVms, computeHotlapStatus, LOCAL_HOTLAP_EVENT_SELECT } from '@/lib/vms/hotlap-sync';
import { VmsClient } from '@/lib/vms/client';
import { type LocalHotlapEvent, type VmsHotlapLeaderboardRow } from '@/lib/vms/types';

export type HomepageLeaderboardRow = {
  rank: string;
  driver: string;
  lap: string;
  delta: string;
};

export type HomepageLeaderboardState = {
  rows: HomepageLeaderboardRow[];
  eventName: string | null;
  error: string | null;
};

const CACHE_MS = 60_000;

let cachedState: { expiresAt: number; value: HomepageLeaderboardState } | null = null;

function formatRank(index: number) {
  return String(index + 1).padStart(2, '0');
}

function formatLap(row: VmsHotlapLeaderboardRow) {
  if (row.lapTimeStr) return row.lapTimeStr;
  if (typeof row.lapTimeMs === 'number') return (row.lapTimeMs / 1000).toFixed(3);
  return '--';
}

function formatDelta(row: VmsHotlapLeaderboardRow, leader: VmsHotlapLeaderboardRow | undefined, index: number) {
  if (index === 0) return 'leader';
  if (typeof row.lapTimeMs === 'number' && typeof leader?.lapTimeMs === 'number') {
    return `+${((row.lapTimeMs - leader.lapTimeMs) / 1000).toFixed(3)}`;
  }
  return '';
}

function asLeaderboardRows(results: VmsHotlapLeaderboardRow[]) {
  const validResults = results.filter((row) => row.invalid !== 1);
  const rows = validResults.length > 0 ? validResults : results;
  const sortedRows = [...rows].sort((a, b) => {
    if (typeof a.lapTimeMs === 'number' && typeof b.lapTimeMs === 'number') return a.lapTimeMs - b.lapTimeMs;
    return a.rank - b.rank;
  });
  const leader = sortedRows[0];

  return sortedRows.slice(0, 3).map((row, index) => ({
    rank: formatRank(index),
    driver: (row.customerName ?? 'Driver').toUpperCase(),
    lap: formatLap(row),
    delta: formatDelta(row, leader, index)
  }));
}

function pickHomepageEvent(events: LocalHotlapEvent[]) {
  const withComputedStatus = events.map((event) => ({
    ...event,
    computedStatus: computeHotlapStatus(event.start_date, event.end_date)
  }));

  return (
    withComputedStatus.find((event) => event.computedStatus === 'active') ??
    withComputedStatus.find((event) => event.computedStatus === 'scheduled') ??
    null
  );
}

async function loadHomepageLeaderboardRows(): Promise<HomepageLeaderboardState> {
  try {
    const supabaseAdmin = createSupabaseAdminClient();

    await syncHotlapEventsFromVms({ supabaseAdmin });

    const { data, error } = await supabaseAdmin
      .from('vms_hotlap_events')
      .select(LOCAL_HOTLAP_EVENT_SELECT)
      .neq('status', 'cancelled')
      .neq('status', 'draft')
      .order('start_date', { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);

    const event = pickHomepageEvent((data ?? []) as LocalHotlapEvent[]);
    if (!event) return { rows: [], eventName: null, error: null };

    const detail = await VmsClient.fromEnv().getHotlapEvent(event.vms_hotlap_event_id, { invalid: 1 });
    const subEventWithResults = detail.subEvents.find((subEvent) => subEvent.results.length > 0);

    return {
      rows: subEventWithResults ? asLeaderboardRows(subEventWithResults.results) : [],
      eventName: event.name,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Homepage leaderboard could not be loaded.';
    console.error('Failed to load homepage VMS leaderboard', error);
    return { rows: [], eventName: null, error: message };
  }
}

export async function getHomepageLeaderboardRows() {
  if (cachedState && cachedState.expiresAt > Date.now()) return cachedState.value;

  const value = await loadHomepageLeaderboardRows();
  cachedState = { expiresAt: Date.now() + CACHE_MS, value };
  return value;
}

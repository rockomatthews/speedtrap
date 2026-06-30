import { type SupabaseClient } from '@supabase/supabase-js';

import { type VmsClient } from '@/lib/vms/client';
import {
  type LocalHotlapEvent,
  type VmsCustomerProfile,
  type VmsDriverLeaderboardPlacement,
  type VmsDriverPublicProfile
} from '@/lib/vms/types';

const LOCAL_EVENT_SELECT = 'id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at';

type LocalProfileMeta = {
  vms_customer_id: number | null;
  avatar_url: string | null;
  display_name: string | null;
};

function deriveStatus(event: Pick<LocalHotlapEvent, 'start_date' | 'end_date' | 'status'>) {
  if (event.status === 'cancelled' || event.status === 'draft') return event.status;
  const now = Date.now();
  const start = Date.parse(event.start_date.replace(' ', 'T'));
  const end = Date.parse(event.end_date.replace(' ', 'T'));
  if (Number.isFinite(start) && now < start) return 'scheduled';
  if (Number.isFinite(end) && now > end) return 'completed';
  return 'active';
}

export async function getPublicDriverMeta(supabaseAdmin: SupabaseClient, customerIds: number[]) {
  const ids = Array.from(new Set(customerIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0) return new Map<number, LocalProfileMeta>();

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('vms_customer_id,avatar_url,display_name')
    .in('vms_customer_id', ids);

  const map = new Map<number, LocalProfileMeta>();
  for (const row of (data ?? []) as LocalProfileMeta[]) {
    if (row.vms_customer_id) map.set(row.vms_customer_id, row);
  }
  return map;
}

export function toPublicDriver(customer: VmsCustomerProfile, meta?: LocalProfileMeta | null): VmsDriverPublicProfile {
  const siteName = meta?.display_name?.trim();
  return {
    id: customer.id,
    name: customer.name.trim() || siteName || `Driver ${customer.id}`,
    avatarUrl: meta?.avatar_url ?? null,
    className: customer.className,
    classId: customer.classId,
    homeVenue: customer.homeVenue,
    lapsRecorded: customer.lapsRecorded,
    lastVisit: customer.lastVisit,
    lastVehicle: customer.lastVehicle,
    lastCircuit: customer.lastCircuit,
    lastGroupEvent: customer.lastGroupEvent,
    lastRaceEvent: customer.lastRaceEvent
  };
}

export async function getDriverLeaderboardPlacements(
  supabaseAdmin: SupabaseClient,
  vms: VmsClient,
  customerId: number
): Promise<VmsDriverLeaderboardPlacement[]> {
  const { data, error } = await supabaseAdmin
    .from('vms_hotlap_events')
    .select(LOCAL_EVENT_SELECT)
    .not('status', 'in', '("draft","cancelled")')
    .order('start_date', { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to load local hotlap events: ${error.message}`);

  const events = (data ?? []) as LocalHotlapEvent[];
  const perEvent = await Promise.all(
    events.map(async (localEvent) => {
      try {
        const detail = await vms.getHotlapEvent(localEvent.vms_hotlap_event_id, { invalid: 1 });
        const placements: VmsDriverLeaderboardPlacement[] = [];
        for (const subEvent of detail.subEvents) {
          const row = subEvent.results.find((result) => result.customerId === customerId);
          if (!row) continue;
          placements.push({
            eventId: localEvent.id,
            eventSlug: localEvent.slug,
            eventName: localEvent.name,
            eventStatus: deriveStatus(localEvent),
            subEventId: subEvent.id,
            subEventName: subEvent.name,
            circuitName: subEvent.circuitName,
            rank: row.rank,
            lapTimeMs: row.lapTimeMs,
            lapTimeStr: row.lapTimeStr,
            vehicleName: row.vehicleName,
            venueName: row.venueName,
            date: row.date,
            invalid: row.invalid,
            verified: row.verified
          });
        }
        return placements;
      } catch (error) {
        console.error('[driver-placements] failed to load VMS event', localEvent.vms_hotlap_event_id, error);
        return [];
      }
    })
  );

  return perEvent.flat().sort((a, b) => {
    const aActive = a.eventStatus === 'active' ? 0 : 1;
    const bActive = b.eventStatus === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.rank - b.rank;
  });
}

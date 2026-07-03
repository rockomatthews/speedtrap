import { type SupabaseClient } from '@supabase/supabase-js';

import { VmsClient } from '@/lib/vms/client';

export const LOCAL_HOTLAP_EVENT_SELECT =
  'id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at';

function toSlug(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56) || 'hotlap-event'
  );
}

export function computeHotlapStatus(startDate: string | null, endDate: string | null) {
  const now = Date.now();
  const start = startDate ? Date.parse(startDate.replace(' ', 'T')) : NaN;
  const end = endDate ? Date.parse(endDate.replace(' ', 'T')) : NaN;
  if (Number.isFinite(start) && now < start) return 'scheduled';
  if (Number.isFinite(end) && now > end) return 'completed';
  return 'active';
}

export async function syncHotlapEventsFromVms(input: {
  supabaseAdmin: SupabaseClient;
  createdBy?: string | null;
  includePast?: boolean;
}) {
  const vms = VmsClient.fromEnv();
  const summaries = await vms.listHotlapEvents({
    past: input.includePast ? 1 : undefined,
    current: 1,
    future: 1,
    order: 'datedesc'
  });
  const rows = [];
  const skipped = [];

  for (const summary of summaries) {
    const detail = await vms.getHotlapEvent(summary.id, { invalid: 1 });
    const event = detail.event ?? summary;
    const circuitId = detail.subEvents[0]?.circuitId ?? event.circuitId ?? summary.circuitId;
    const startDate = event.startDate ?? summary.startDate ?? '';
    const endDate = event.endDate ?? summary.endDate ?? '';

    if (!event.id || !event.name || !circuitId || !startDate || !endDate) {
      skipped.push({ id: summary.id, name: summary.name, reason: 'Missing event name, circuit, or date range.' });
      continue;
    }

    rows.push({
      vms_hotlap_event_id: event.id,
      slug: `${toSlug(event.name)}-${event.id}`,
      name: event.name,
      circuit_id: circuitId,
      start_date: startDate,
      end_date: endDate,
      status: computeHotlapStatus(startDate, endDate),
      ...(input.createdBy ? { created_by: input.createdBy } : {})
    });
  }

  if (rows.length === 0) {
    return { events: [], synced: 0, skipped };
  }

  const { data, error } = await input.supabaseAdmin
    .from('vms_hotlap_events')
    .upsert(rows, { onConflict: 'vms_hotlap_event_id' })
    .select(LOCAL_HOTLAP_EVENT_SELECT);

  if (error) throw new Error(`Failed to sync hotlap event metadata: ${error.message}`);

  return { events: data ?? [], synced: data?.length ?? 0, skipped };
}

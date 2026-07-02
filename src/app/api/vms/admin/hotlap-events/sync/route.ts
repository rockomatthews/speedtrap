import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const LOCAL_EVENT_SELECT = 'id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at';

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

function computeStatus(startDate: string | null, endDate: string | null) {
  const now = Date.now();
  const start = startDate ? Date.parse(startDate.replace(' ', 'T')) : NaN;
  const end = endDate ? Date.parse(endDate.replace(' ', 'T')) : NaN;
  if (Number.isFinite(start) && now < start) return 'scheduled';
  if (Number.isFinite(end) && now > end) return 'completed';
  return 'active';
}

async function requireAdmin() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (profile?.role !== 'admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

export async function POST() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const vms = VmsClient.fromEnv();
    const summaries = await vms.listHotlapEvents({ past: 1, current: 1, future: 1, order: 'datedesc' });
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
        status: computeStatus(startDate, endDate),
        created_by: adminCheck.user.id
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ events: [], synced: 0, skipped });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('vms_hotlap_events')
      .upsert(rows, { onConflict: 'vms_hotlap_event_id' })
      .select(LOCAL_EVENT_SELECT);

    if (error) {
      return NextResponse.json({ error: `Failed to sync hotlap event metadata: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ events: data ?? [], synced: data?.length ?? 0, skipped });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

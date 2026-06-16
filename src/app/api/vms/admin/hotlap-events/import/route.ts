import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const importSchema = z.object({
  vmsHotlapEventId: z.coerce.number().int().positive(),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
  circuitId: z.coerce.number().int().positive().optional()
});

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

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const raw = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid VMS hotlap import.' }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const detail = await VmsClient.fromEnv().getHotlapEvent(input.vmsHotlapEventId, { invalid: 1 });
    if (!detail.event?.id || !detail.event.name) {
      return NextResponse.json({ error: 'VMS did not return a readable hotlap event.' }, { status: 502 });
    }

    const circuitId = input.circuitId ?? detail.subEvents[0]?.circuitId ?? detail.event.circuitId;
    if (!circuitId) {
      return NextResponse.json({ error: 'VMS event does not include a circuit id. Provide circuitId explicitly.' }, { status: 400 });
    }

    const startDate = detail.event.startDate ?? '';
    const endDate = detail.event.endDate ?? '';
    const slug = input.slug ?? `${toSlug(detail.event.name)}-${detail.event.id}`;
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('vms_hotlap_events')
      .upsert(
        {
          vms_hotlap_event_id: detail.event.id,
          slug,
          name: detail.event.name,
          circuit_id: circuitId,
          start_date: startDate,
          end_date: endDate,
          status: computeStatus(startDate, endDate),
          created_by: adminCheck.user.id
        },
        { onConflict: 'vms_hotlap_event_id' }
      )
      .select(LOCAL_EVENT_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: `Failed to import hotlap event metadata: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ localEvent: data, event: detail.event, subEvents: detail.subEvents });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

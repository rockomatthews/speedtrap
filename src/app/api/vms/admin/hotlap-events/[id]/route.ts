import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const subEventSchema = z.object({
  id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(3),
  circuitId: z.coerce.number().int().positive().nullable().optional(),
  vehicleIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  classIds: z.array(z.coerce.number().int().positive()).optional().default([])
});

const hotlapEventSchema = z.object({
  name: z.string().trim().min(3),
  startDate: z.string().trim().min(16),
  endDate: z.string().trim().min(16),
  circuitId: z.coerce.number().int().positive(),
  venueIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
  qualificationPercentage: z.coerce.number().int().min(1).max(100).nullable().optional(),
  subEvents: z.array(subEventSchema).min(1).default([{ name: 'Overall', vehicleIds: [], classIds: [] }])
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toVmsDate(value: string) {
  const trimmed = value.trim();
  const withSpace = trimmed.replace('T', ' ');
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(withSpace) ? `${withSpace}:00` : withSpace;
}

function computeStatus(startDate: string, endDate: string) {
  const now = Date.now();
  const start = Date.parse(startDate.replace(' ', 'T'));
  const end = Date.parse(endDate.replace(' ', 'T'));
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

async function findLocalEvent(id: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const select = 'id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at';

  if (/^\d+$/.test(id)) {
    return supabaseAdmin.from('vms_hotlap_events').select(select).eq('vms_hotlap_event_id', Number(id)).maybeSingle();
  }
  if (isUuid(id)) {
    return supabaseAdmin.from('vms_hotlap_events').select(select).eq('id', id).maybeSingle();
  }
  return supabaseAdmin.from('vms_hotlap_events').select(select).eq('slug', id).maybeSingle();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await context.params;
  const { data: localEvent, error: loadError } = await findLocalEvent(id);
  if (loadError) return NextResponse.json({ error: `Failed to load hotlap event: ${loadError.message}` }, { status: 500 });
  if (!localEvent) return NextResponse.json({ error: 'Hotlap event not found.' }, { status: 404 });

  const raw = await request.json().catch(() => null);
  const parsed = hotlapEventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid hotlap event.' }, { status: 400 });
  }

  const input = parsed.data;
  const startDate = toVmsDate(input.startDate);
  const endDate = toVmsDate(input.endDate);
  const venueIds = input.venueIds?.length ? input.venueIds : [env.VMS_HOME_VENUE_ID ?? 1];

  try {
    const vms = VmsClient.fromEnv();
    let detail = await vms.updateHotlapEvent(localEvent.vms_hotlap_event_id, {
      name: input.name,
      startDate,
      endDate,
      circuitId: input.circuitId,
      venueIds,
      qualificationPercentage: input.qualificationPercentage ?? null,
      subEvents: input.subEvents
    });

    const existingSubEvents = input.subEvents.filter((subEvent) => subEvent.id);
    if (existingSubEvents.length > 0) {
      detail = await vms.updateHotlapSubEvents(
        localEvent.vms_hotlap_event_id,
        existingSubEvents.map((subEvent) => ({
          id: subEvent.id,
          name: subEvent.name,
          circuitId: subEvent.circuitId ?? input.circuitId,
          vehicleIds: subEvent.vehicleIds,
          classIds: subEvent.classIds
        }))
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('vms_hotlap_events')
      .update({
        name: input.name,
        circuit_id: input.circuitId,
        start_date: startDate,
        end_date: endDate,
        status: computeStatus(startDate, endDate)
      })
      .eq('id', localEvent.id)
      .select('id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: `VMS event updated, but Supabase metadata update failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ localEvent: data, event: detail.event, subEvents: detail.subEvents });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await context.params;
  const { data: localEvent, error: loadError } = await findLocalEvent(id);
  if (loadError) return NextResponse.json({ error: `Failed to load hotlap event: ${loadError.message}` }, { status: 500 });
  if (!localEvent) return NextResponse.json({ error: 'Hotlap event not found.' }, { status: 404 });

  try {
    await VmsClient.fromEnv().deleteHotlapEvent(localEvent.vms_hotlap_event_id);

    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin.from('vms_hotlap_events').delete().eq('id', localEvent.id);
    if (error) {
      return NextResponse.json({ error: `VMS event deleted, but Supabase metadata delete failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const subEventSchema = z.object({
  name: z.string().trim().min(3),
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

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

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
    const detail = await VmsClient.fromEnv().createHotlapEvent({
      name: input.name,
      startDate,
      endDate,
      circuitId: input.circuitId,
      venueIds,
      qualificationPercentage: input.qualificationPercentage ?? null,
      subEvents: input.subEvents
    });

    if (!detail.event?.id) {
      return NextResponse.json({ error: 'VMS did not return a hotlap event id.' }, { status: 502 });
    }

    const slug = `${toSlug(input.name)}-${detail.event.id}`;
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('vms_hotlap_events')
      .insert({
        vms_hotlap_event_id: detail.event.id,
        slug,
        name: input.name,
        circuit_id: input.circuitId,
        start_date: startDate,
        end_date: endDate,
        status: computeStatus(startDate, endDate),
        created_by: adminCheck.user.id
      })
      .select('id,vms_hotlap_event_id,slug,name,circuit_id,start_date,end_date,status,created_by,created_at,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: `VMS event created, but Supabase metadata save failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ localEvent: data, event: detail.event, subEvents: detail.subEvents }, { status: 201 });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

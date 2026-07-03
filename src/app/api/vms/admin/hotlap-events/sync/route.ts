import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { syncHotlapEventsFromVms } from '@/lib/vms/hotlap-sync';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

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
    const result = await syncHotlapEventsFromVms({
      supabaseAdmin: createSupabaseAdminClient(),
      createdBy: adminCheck.user.id,
      includePast: true
    });
    return NextResponse.json(result);
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

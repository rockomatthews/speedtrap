import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { getDriverLeaderboardPlacements, getPublicDriverMeta, toPublicDriver } from '@/lib/vms/driver-public';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId } = await context.params;
  const id = Number(customerId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid driver id.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const lapCount = Math.min(50, Math.max(1, Number(url.searchParams.get('lapCount') ?? 12)));

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const vms = VmsClient.fromEnv();
    const [customer, laps, placements, meta] = await Promise.all([
      vms.getCustomer(id),
      vms.getCustomerLapTimes(id, { index: 0, count: lapCount }),
      getDriverLeaderboardPlacements(supabaseAdmin, vms, id),
      getPublicDriverMeta(supabaseAdmin, [id])
    ]);

    if (!customer) return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });

    return NextResponse.json({
      driver: toPublicDriver(customer, meta.get(id)),
      laps,
      placements
    });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

function toInt(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const index = toInt(url.searchParams.get('index')) ?? 0;
  const count = toInt(url.searchParams.get('count')) ?? 100;

  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  try {
    const vms = VmsClient.fromEnv();
    const results = await vms.getCustomerLapTimes(profile.vms_customer_id, { index, count });

    return NextResponse.json({
      index,
      count,
      results
    });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}


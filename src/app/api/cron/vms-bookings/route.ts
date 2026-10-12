import { NextResponse } from 'next/server';

import { syncUpcomingVmsBookings } from '@/lib/bookings/vms-sync';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sync = await syncUpcomingVmsBookings(createSupabaseAdminClient());
    return NextResponse.json({ sync }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Scheduled VMS booking sync failed', error);
    return NextResponse.json({ error: 'VMS booking sync failed. Existing reservations were retained unless already reconciled.' }, { status: 502 });
  }
}

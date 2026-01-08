import { NextResponse } from 'next/server';

import { env } from '@/lib/supabase/env';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { buildXml, parseXml } from '@/lib/vms/xml';

function toBool01(v: string | null) {
  if (v === null) return null;
  if (v === '0' || v.toLowerCase() === 'false') return 0;
  if (v === '1' || v.toLowerCase() === 'true') return 1;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const past = toBool01(url.searchParams.get('past')) ?? 1;
  const future = toBool01(url.searchParams.get('future')) ?? 1;

  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  const vms = VmsClient.fromEnv();
  const xml = await vms.request(`/bookings?past=${past}&future=${future}`, { method: 'GET' });
  const obj = parseXml<any>(xml);

  const bookingsRaw = obj?.bookings?.booking ?? [];
  const bookings = Array.isArray(bookingsRaw) ? bookingsRaw : bookingsRaw ? [bookingsRaw] : [];

  // Filter to booking owner for now. (Docs note owner may not be a participant.)
  const mine = bookings.filter((b: any) => Number(b?.customer_id) === profile.vms_customer_id);

  return NextResponse.json({ past, future, results: mine, total: mine.length });
}

export async function POST(request: Request) {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  const body = (await request.json().catch(() => null)) as
    | { event_name?: string; start_date?: string; end_date?: string; status?: string; venue_id?: number }
    | null;

  if (!body?.start_date || !body?.end_date) {
    return NextResponse.json({ error: 'Missing start_date/end_date' }, { status: 400 });
  }

  const venueId = body.venue_id ?? env.VMS_HOME_VENUE_ID ?? 1;
  const status = body.status ?? 'Booked';
  const eventName = body.event_name ?? 'Booking';

  const bookingXml = buildXml('booking', {
    event_name: eventName,
    customer_id: profile.vms_customer_id,
    start_date: body.start_date,
    end_date: body.end_date,
    status,
    venue_id: venueId
  });

  const vms = VmsClient.fromEnv();
  const createdXml = await vms.request('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    body: bookingXml
  });
  const createdObj = parseXml<any>(createdXml);

  return NextResponse.json({ booking: createdObj?.booking ?? createdObj });
}



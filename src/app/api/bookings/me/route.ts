import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';

const SELECT =
  'id,source,customer_name,customer_email,duration_minutes,sim_count,starts_at,ends_at,amount_cents,currency,status,stripe_payment_intent_id,stripe_refund_id,vms_booking_id,error,created_at';

export async function GET() {
  const { supabase, user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('race_bookings')
    .select(SELECT)
    .order('starts_at', { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: `Failed to load bookings: ${error.message}` }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}

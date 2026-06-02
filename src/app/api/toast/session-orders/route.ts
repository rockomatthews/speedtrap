import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';

const SELECT =
  'id,toast_order_guid,toast_check_guid,toast_payment_guid,vms_customer_id,vms_booking_id,customer_name,customer_email,session_quantity,session_minutes,status,ignored_reason,error,processed_at,created_at,updated_at';

export async function GET() {
  const { supabase, user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('toast_session_orders').select(SELECT).order('created_at', { ascending: false }).limit(20);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load paid racing sessions: ${error.message}. Run migration 0013 in Supabase.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessions: data ?? [] });
}

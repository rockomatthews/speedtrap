import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';

const SELECT =
  'id,toast_event_guid,toast_order_guid,toast_check_guid,toast_payment_guid,toast_restaurant_guid,toast_event_type,profile_id,vms_customer_id,vms_booking_id,customer_name,customer_email,session_quantity,session_minutes,status,ignored_reason,error,processed_at,created_at,updated_at';

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('toast_session_orders').select(SELECT).order('created_at', { ascending: false }).limit(100);

  if (error) return NextResponse.json({ error: `Failed to load Toast sessions: ${error.message}` }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

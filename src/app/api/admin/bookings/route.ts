import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const RACE_SELECT =
  'id,source,customer_name,customer_email,customer_phone,duration_minutes,sim_count,starts_at,ends_at,amount_cents,currency,status,vms_booking_id,error,reminder_sent_at,reminder_error,membership_free_race_applied,membership_discount_cents,created_at';
const TOAST_SELECT =
  'id,toast_order_guid,customer_name,customer_email,session_quantity,session_minutes,status,vms_booking_id,error,ignored_reason,processed_at,created_at';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createSupabaseAdminClient();
  const [race, toast] = await Promise.all([
    supabase.from('race_bookings').select(RACE_SELECT).order('starts_at', { ascending: false }).limit(100),
    supabase.from('toast_session_orders').select(TOAST_SELECT).order('created_at', { ascending: false }).limit(100)
  ]);
  if (race.error) return NextResponse.json({ error: race.error.message }, { status: 500 });
  if (toast.error) return NextResponse.json({ error: toast.error.message }, { status: 500 });
  return NextResponse.json({ raceBookings: race.data ?? [], toastSessions: toast.data ?? [] });
}

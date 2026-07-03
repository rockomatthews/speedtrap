import { type NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { localDateTimeToUtc } from '@/lib/bookings/time';
import { syncUpcomingVmsBookings } from '@/lib/bookings/vms-sync';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const RACE_SELECT =
  'id,source,customer_name,customer_email,customer_phone,duration_minutes,sim_count,starts_at,ends_at,amount_cents,currency,status,vms_booking_id,error,reminder_sent_at,reminder_error,membership_free_race_applied,membership_discount_cents,race_request_type,requested_vehicle_id,requested_vehicle_name,requested_circuit_id,requested_circuit_name,requested_hotlap_event_id,requested_hotlap_event_name,created_at';
const TOAST_SELECT =
  'id,toast_order_guid,customer_name,customer_email,session_quantity,session_minutes,status,vms_booking_id,error,ignored_reason,processed_at,created_at';

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}

function rangeFromParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get('date');
  const weekStart = params.get('weekStart');
  const from = params.get('from');
  const to = params.get('to');

  if (date) {
    return {
      from: localDateTimeToUtc(date, '00:00:00').toISOString(),
      to: localDateTimeToUtc(addDays(date, 1), '00:00:00').toISOString()
    };
  }

  if (weekStart) {
    return {
      from: localDateTimeToUtc(weekStart, '00:00:00').toISOString(),
      to: localDateTimeToUtc(addDays(weekStart, 7), '00:00:00').toISOString()
    };
  }

  if (from && to) return { from, to };
  return null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createSupabaseAdminClient();
  await syncUpcomingVmsBookings(supabase);
  const range = rangeFromParams(request);
  const limit = range ? 500 : 100;
  let raceQuery = supabase.from('race_bookings').select(RACE_SELECT).order('starts_at', { ascending: true }).limit(limit);
  if (range) {
    raceQuery = raceQuery.lt('starts_at', range.to).gt('ends_at', range.from);
  } else {
    raceQuery = supabase.from('race_bookings').select(RACE_SELECT).order('starts_at', { ascending: false }).limit(limit);
  }
  const [race, toast] = await Promise.all([
    raceQuery,
    supabase.from('toast_session_orders').select(TOAST_SELECT).order('created_at', { ascending: false }).limit(100)
  ]);
  if (race.error) return NextResponse.json({ error: race.error.message }, { status: 500 });
  if (toast.error) return NextResponse.json({ error: toast.error.message }, { status: 500 });
  return NextResponse.json({ raceBookings: race.data ?? [], toastSessions: toast.data ?? [] });
}

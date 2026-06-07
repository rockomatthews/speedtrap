import { NextResponse } from 'next/server';

import { BOOKING_TIMEZONE } from '@/lib/bookings/config';
import { normalizeUsPhone } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendSms } from '@/lib/twilio/client';

export const runtime = 'nodejs';

type ReminderBooking = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  duration_minutes: number;
  sim_count: number;
};

function formatRaceTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function reminderBody(booking: ReminderBooking) {
  const name = booking.customer_name?.split(/\s+/)[0] || 'Driver';
  const sims = `${booking.sim_count} sim${booking.sim_count === 1 ? '' : 's'}`;
  return `Speed Trap reminder: ${name}, your ${booking.duration_minutes}-minute race for ${sims} starts at ${formatRaceTime(
    booking.starts_at
  )}. See you soon.`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3.5 * 60 * 1000);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('race_bookings')
    .select('id,customer_name,customer_phone,starts_at,duration_minutes,sim_count')
    .in('status', ['confirmed', 'payment_succeeded_vms_failed'])
    .not('customer_phone', 'is', null)
    .not('sms_consent_at', 'is', null)
    .is('reminder_sent_at', null)
    .gt('starts_at', now.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .order('starts_at', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const booking of (data ?? []) as ReminderBooking[]) {
    const to = booking.customer_phone ? normalizeUsPhone(booking.customer_phone) : null;
    if (!to) {
      await supabase.from('race_bookings').update({ reminder_error: 'Invalid reminder phone number.' }).eq('id', booking.id);
      results.push({ id: booking.id, sent: false, error: 'Invalid reminder phone number.' });
      continue;
    }

    try {
      const sent = await sendSms({ to, body: reminderBody(booking) });
      const update = await supabase
        .from('race_bookings')
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_error: null,
          reminder_provider_message_id: sent.sid
        })
        .eq('id', booking.id)
        .is('reminder_sent_at', null);

      if (update.error) throw new Error(update.error.message);
      results.push({ id: booking.id, sent: true, providerMessageId: sent.sid });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reminder.';
      await supabase.from('race_bookings').update({ reminder_error: message }).eq('id', booking.id);
      results.push({ id: booking.id, sent: false, error: message });
    }
  }

  return NextResponse.json({ checked: data?.length ?? 0, results });
}

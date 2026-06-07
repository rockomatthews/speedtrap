import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSlotAvailable } from '@/lib/bookings/availability';
import { BOOKING_BUFFER_MINUTES, BOOKING_HOLD_MINUTES, bookingAmountCents } from '@/lib/bookings/config';
import { addMinutes, utcToVenueDate } from '@/lib/bookings/time';
import { normalizeUsPhone } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const holdSchema = z.object({
  customerName: z.string().trim().min(3).max(120),
  customerEmail: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  customerPhone: z.string().trim().min(7).max(40),
  smsConsent: z.boolean().refine((value) => value === true, 'SMS reminder consent is required.'),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().refine((value) => value === 15 || value === 30),
  simCount: z.number().int().min(1).max(4)
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = holdSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid booking hold.' }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const start = new Date(parsed.data.startsAt);
    const end = addMinutes(start, parsed.data.durationMinutes);
    const bufferUntil = addMinutes(end, BOOKING_BUFFER_MINUTES);
    const amountCents = bookingAmountCents(parsed.data.durationMinutes, parsed.data.simCount);
    if (!amountCents) return NextResponse.json({ error: 'Unsupported booking product.' }, { status: 400 });
    const customerPhone = normalizeUsPhone(parsed.data.customerPhone);
    if (!customerPhone) return NextResponse.json({ error: 'Enter a valid mobile phone number.' }, { status: 400 });

    await assertSlotAvailable(supabase, {
      date: utcToVenueDate(start),
      startsAt: start.toISOString(),
      durationMinutes: parsed.data.durationMinutes,
      simCount: parsed.data.simCount
    });

    const { data, error } = await supabase
      .from('race_booking_holds')
      .insert({
        customer_name: parsed.data.customerName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim(),
        customer_email: parsed.data.customerEmail,
        customer_phone: customerPhone,
        sms_consent_at: new Date().toISOString(),
        duration_minutes: parsed.data.durationMinutes,
        sim_count: parsed.data.simCount,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        buffer_until: bufferUntil.toISOString(),
        amount_cents: amountCents,
        currency: 'usd',
        expires_at: addMinutes(new Date(), BOOKING_HOLD_MINUTES).toISOString()
      })
      .select('id,amount_cents,currency,expires_at')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ hold: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to hold booking.' }, { status: 409 });
  }
}

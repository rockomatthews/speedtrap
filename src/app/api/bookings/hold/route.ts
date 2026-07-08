import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSlotAvailable } from '@/lib/bookings/availability';
import {
  BOOKING_BUFFER_MINUTES,
  BOOKING_HOLD_MINUTES,
  MAX_CUSTOM_DURATION_MINUTES,
  MIN_CUSTOM_DURATION_MINUTES,
  supportedBookingDuration
} from '@/lib/bookings/config';
import { raceRequestDbFields, validateRaceRequest } from '@/lib/bookings/race-request';
import { addMinutes, utcToVenueDate } from '@/lib/bookings/time';
import { syncUpcomingVmsBookings } from '@/lib/bookings/vms-sync';
import { membershipBookingPrice, type MembershipProfile } from '@/lib/membership';
import { normalizeUsPhone } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

const raceRequestSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('vehicle_circuit'), vehicleId: z.number().int().positive(), circuitId: z.number().int().positive() }),
    z.object({ type: z.literal('hotlap_event'), eventId: z.number().int().positive() })
  ])
  .optional();

const holdSchema = z.object({
  customerName: z.string().trim().min(3).max(120),
  customerEmail: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  customerPhone: z.string().trim().min(7).max(40),
  smsConsent: z.boolean().refine((value) => value === true, 'SMS reminder consent is required.'),
  startsAt: z.string().datetime(),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_CUSTOM_DURATION_MINUTES)
    .max(MAX_CUSTOM_DURATION_MINUTES)
    .refine(supportedBookingDuration, 'Unsupported booking duration.'),
  simCount: z.number().int().min(1).max(4),
  raceRequest: raceRequestSchema
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = holdSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid booking hold.' }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const authClient = await createRouteHandlerClient();
    const {
      data: { user }
    } = await authClient.auth.getUser().catch(() => ({ data: { user: null } }));
    const start = new Date(parsed.data.startsAt);
    const end = addMinutes(start, parsed.data.durationMinutes);
    const bufferUntil = addMinutes(end, BOOKING_BUFFER_MINUTES);
    const customerPhone = normalizeUsPhone(parsed.data.customerPhone);
    if (!customerPhone) return NextResponse.json({ error: 'Enter a valid mobile phone number.' }, { status: 400 });

    let membershipProfile: MembershipProfile | null = null;
    const userEmail = user?.email?.toLowerCase() ?? null;
    if (user?.id && userEmail && userEmail === parsed.data.customerEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'id,membership_status,membership_current_period_end,birthday,membership_free_race_month,membership_free_race_redeemed_at,membership_monthly_15_race_month,membership_monthly_15_race_redeemed_at,membership_birthday_30_race_year,membership_birthday_30_race_redeemed_at'
        )
        .eq('id', user.id)
        .maybeSingle<MembershipProfile>();
      membershipProfile = profile ?? null;
    }

    const price = membershipBookingPrice({
      durationMinutes: parsed.data.durationMinutes,
      simCount: parsed.data.simCount,
      profile: membershipProfile,
      creditDate: start
    });
    if (!price) return NextResponse.json({ error: 'Unsupported booking product.' }, { status: 400 });
    const raceRequest = await validateRaceRequest(parsed.data.raceRequest, start);

    await syncUpcomingVmsBookings(supabase);

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
        amount_cents: price.amountCents,
        currency: 'usd',
        profile_id: membershipProfile?.id ?? null,
        membership_free_race_month: price.freeRaceMonth,
        membership_free_race_applied: price.freeRaceApplied,
        membership_discount_cents: price.discountCents,
        membership_credit_type: price.creditType,
        membership_credit_month: price.creditMonth,
        membership_credit_year: price.creditYear,
        ...raceRequestDbFields(raceRequest),
        expires_at: addMinutes(new Date(), BOOKING_HOLD_MINUTES).toISOString()
      })
      .select('id,amount_cents,currency,expires_at,membership_free_race_applied,membership_discount_cents')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ hold: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to hold booking.' }, { status: 409 });
  }
}

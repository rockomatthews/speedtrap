import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { confirmRaceBookingFromHold } from '@/lib/bookings/confirm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';

const paymentSchema = z.object({
  holdId: z.string().uuid()
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment request.' }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: hold, error } = await supabase
      .from('race_booking_holds')
      .select('*')
      .eq('id', parsed.data.holdId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hold) return NextResponse.json({ error: 'Booking hold expired. Pick a time again.' }, { status: 410 });

    if (hold.amount_cents === 0) {
      const booking = await confirmRaceBookingFromHold({
        supabase,
        holdId: hold.id,
        profileId: hold.profile_id ?? null
      });
      return NextResponse.json({
        freeBooking: true,
        booking,
        amountCents: 0,
        currency: hold.currency
      });
    }

    const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
    let paymentIntent: Stripe.PaymentIntent;

    if (hold.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(hold.stripe_payment_intent_id);
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: hold.amount_cents,
        currency: hold.currency,
        receipt_email: hold.customer_email,
        description: `${hold.sim_count} x ${hold.duration_minutes} min Speed Trap race session`,
        payment_method_types: ['card'],
        metadata: {
          booking_hold_id: hold.id,
          source: 'speedtrap_online_booking',
          sms_reminder: hold.sms_consent_at ? 'true' : 'false'
        }
      });

      const update = await supabase
        .from('race_booking_holds')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', hold.id);
      if (update.error) throw new Error(update.error.message);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents: hold.amount_cents,
      currency: hold.currency
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to start payment.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { confirmRaceBookingFromHold } from '@/lib/bookings/confirm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv, stripeCryptoPaymentsEnabled } from '@/lib/stripe/env';

const paymentSchema = z.object({
  holdId: z.string().uuid(),
  paymentMethod: z.enum(['card', 'crypto']).default('card')
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

    const requestedPaymentMethod = parsed.data.paymentMethod;
    if (requestedPaymentMethod === 'crypto' && !stripeCryptoPaymentsEnabled()) {
      return NextResponse.json({ error: 'Crypto payments are not enabled yet.' }, { status: 403 });
    }

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
    const partySize = Number(hold.party_size ?? hold.sim_count ?? 1);
    const simCount = Number(hold.sim_count ?? 1);
    const driverPodDescription = `${partySize} driver${partySize === 1 ? '' : 's'} / ${simCount} pod${simCount === 1 ? '' : 's'}`;
    let paymentIntent: Stripe.PaymentIntent;
    const createPaymentIntent = () =>
      stripe.paymentIntents.create({
        amount: hold.amount_cents,
        currency: hold.currency,
        receipt_email: hold.customer_email,
        description: `${driverPodDescription} · ${hold.duration_minutes} min Speed Trap race session`,
        payment_method_types: (requestedPaymentMethod === 'crypto' ? ['crypto'] : ['card']) as any,
        metadata: {
          booking_hold_id: hold.id,
          source: 'speedtrap_online_booking',
          party_size: String(partySize),
          sim_count: String(simCount),
          payment_method_requested: requestedPaymentMethod,
          sales_tax_rate_percent: '8',
          sales_tax_included: 'true',
          sms_reminder: hold.sms_consent_at ? 'true' : 'false'
        }
      });

    if (hold.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(hold.stripe_payment_intent_id);
      const existingMethod = paymentIntent.metadata?.payment_method_requested === 'crypto' ? 'crypto' : 'card';
      if (paymentIntent.status === 'canceled') {
        paymentIntent = await createPaymentIntent();
      } else if (existingMethod !== requestedPaymentMethod && paymentIntent.status !== 'succeeded') {
        await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => null);
        paymentIntent = await createPaymentIntent();
      }
    } else {
      paymentIntent = await createPaymentIntent();
    }

    const update = await supabase
      .from('race_booking_holds')
      .update({ stripe_payment_intent_id: paymentIntent.id, payment_method_requested: requestedPaymentMethod })
      .eq('id', hold.id);
    if (update.error) throw new Error(update.error.message);
    if (!paymentIntent.client_secret) {
      throw new Error('Stripe did not return a client secret for this payment. Please try again.');
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents: hold.amount_cents,
      currency: hold.currency,
      paymentMethod: requestedPaymentMethod
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to start payment.' }, { status: 500 });
  }
}

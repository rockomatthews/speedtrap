import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { confirmRaceBookingFromPaymentIntent } from '@/lib/bookings/confirm';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';

const confirmSchema = z.object({
  paymentIntentId: z.string().min(8)
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid confirmation request.' }, { status: 400 });

  try {
    const { user } = await getAuthedProfile().catch(() => ({ user: null }));
    const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
    const booking = await confirmRaceBookingFromPaymentIntent({
      supabase: createSupabaseAdminClient(),
      stripe,
      paymentIntentId: parsed.data.paymentIntentId,
      profileId: user?.id ?? null
    });
    return NextResponse.json({ booking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to confirm booking.' }, { status: 500 });
  }
}

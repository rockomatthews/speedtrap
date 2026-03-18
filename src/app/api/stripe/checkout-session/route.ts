import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { stripeEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CreateCheckoutSessionBody = {
  priceId?: string;
  quantity?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateCheckoutSessionBody | null;

  if (!body?.priceId) {
    return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
  }

  const allowedPriceIds = new Set<string>([
    stripeEnv.STRIPE_PRICE_HOODIE,
    stripeEnv.STRIPE_PRICE_TSHIRT,
    stripeEnv.STRIPE_PRICE_KEYCHAIN
  ]);

  if (!allowedPriceIds.has(body.priceId)) {
    return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
  }

  const quantityRaw = body.quantity;
  const quantity =
    typeof quantityRaw === 'number' && Number.isFinite(quantityRaw) ? Math.min(10, Math.max(1, Math.floor(quantityRaw))) : 1;

  const origin = env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: body.priceId, quantity }],
      success_url: `${origin}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/merch/cancel`,
      metadata: {
        merch_price_id: body.priceId,
        merch_quantity: String(quantity)
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to start checkout session.' },
      { status: 500 }
    );
  }
}


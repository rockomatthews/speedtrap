import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
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

  const quantityRaw = body.quantity;
  const quantity =
    typeof quantityRaw === 'number' && Number.isFinite(quantityRaw) ? Math.min(10, Math.max(1, Math.floor(quantityRaw))) : 1;

  const supabase = await createRouteHandlerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent priceId tampering by validating it against the authenticated user's accessible merch catalog.
  const { data: item, error: itemError } = await supabase
    .from('merch_items')
    .select('id,stripe_price_id')
    .eq('active', true)
    .eq('stripe_price_id', body.priceId)
    .maybeSingle();

  if (itemError) {
    return NextResponse.json({ error: 'Failed to validate merch item.' }, { status: 500 });
  }

  if (!item) {
    return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
  }

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
        merch_quantity: String(quantity),
        merch_item_id: String(item.id)
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


import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getStripeMembershipEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in before joining the membership.' }, { status: 401 });
  }

  const origin = new URL(request.url).origin || env.NEXT_PUBLIC_SITE_URL;

  try {
    const stripeEnv = getStripeMembershipEnv();
    const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
    const admin = createSupabaseAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select('id,stripe_customer_id,stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }>();
    if (error) throw new Error(error.message);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : user.email ?? undefined,
      client_reference_id: user.id,
      line_items: [{ price: stripeEnv.STRIPE_MEMBERSHIP_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/membership/success`,
      cancel_url: `${origin}/pricing?membership=cancelled`,
      metadata: {
        source: 'speedtrap_membership',
        profile_id: user.id
      },
      subscription_data: {
        metadata: {
          source: 'speedtrap_membership',
          profile_id: user.id
        }
      }
    });

    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start membership checkout.' },
      { status: 500 }
    );
  }
}

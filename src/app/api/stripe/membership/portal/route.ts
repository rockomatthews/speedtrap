import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { getStripeEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Sign in to manage your membership.' }, { status: 401 });
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: 'No Stripe membership customer is linked yet.' }, { status: 404 });

  try {
    const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
    const origin = new URL(request.url).origin || env.NEXT_PUBLIC_SITE_URL;
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard`
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to open membership management.' },
      { status: 500 }
    );
  }
}

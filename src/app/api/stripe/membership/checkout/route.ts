import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getStripeMembershipEnv } from '@/lib/stripe/env';
import { STRIPE_SALES_TAX_LABEL, salesTaxCents, salesTaxMetadata } from '@/lib/stripe/tax';

import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const checkoutSchema = z
  .object({
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
  })
  .optional();

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in before joining the membership.' }, { status: 401 });
  }

  const origin = new URL(request.url).origin || env.NEXT_PUBLIC_SITE_URL;
  const raw = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(raw ?? undefined);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter birthday as YYYY-MM-DD.' }, { status: 400 });
  }
  const birthday = parsed.data?.birthday || null;

  try {
    const stripeEnv = getStripeMembershipEnv();
    const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
    const admin = createSupabaseAdminClient();
    const membershipPrice = await stripe.prices.retrieve(stripeEnv.STRIPE_MEMBERSHIP_PRICE_ID);
    const membershipSubtotalCents = membershipPrice.unit_amount ?? 0;
    const taxCents = salesTaxCents(membershipSubtotalCents);
    const taxMetadata = salesTaxMetadata(membershipSubtotalCents);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: stripeEnv.STRIPE_MEMBERSHIP_PRICE_ID, quantity: 1 }];
    if (taxCents > 0 && membershipPrice.recurring) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: membershipPrice.currency || 'usd',
          unit_amount: taxCents,
          recurring: {
            interval: membershipPrice.recurring.interval,
            interval_count: membershipPrice.recurring.interval_count ?? 1
          },
          product_data: {
            name: STRIPE_SALES_TAX_LABEL,
            description: 'Ohio sales tax'
          }
        }
      });
    }

    const { data: profile, error } = await admin
      .from('profiles')
      .select('id,stripe_customer_id,stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }>();
    if (error) throw new Error(error.message);

    if (birthday) {
      await admin.from('profiles').update({ birthday }).eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : user.email ?? undefined,
      client_reference_id: user.id,
      line_items: lineItems,
      success_url: `${origin}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?membership=cancelled`,
      metadata: {
        source: 'speedtrap_membership',
        profile_id: user.id,
        birthday: birthday ?? '',
        ...taxMetadata
      },
      subscription_data: {
        metadata: {
          source: 'speedtrap_membership',
          profile_id: user.id,
          birthday: birthday ?? '',
          ...taxMetadata
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

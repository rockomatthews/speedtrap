import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';
import { STRIPE_SALES_TAX_LABEL, salesTaxCents, salesTaxMetadata } from '@/lib/stripe/tax';

export const runtime = 'nodejs';

function formatDollars(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cleanToken = String(token ?? '').trim();
  if (!cleanToken) return NextResponse.json({ error: 'Missing deposit link token.' }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: quote, error } = await supabaseAdmin
    .from('private_event_deposit_quotes')
    .select(
      'id,public_token,customer_name,customer_email,total_amount_cents,deposit_amount_cents,currency,status,stripe_checkout_session_id'
    )
    .eq('public_token', cleanToken)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quote) return NextResponse.json({ error: 'Deposit link not found.' }, { status: 404 });
  if (quote.status === 'deposit_paid') return NextResponse.json({ error: 'This deposit has already been paid.' }, { status: 409 });
  if (quote.status !== 'quote_sent') return NextResponse.json({ error: 'This deposit link is no longer active.' }, { status: 409 });

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
  const taxCents = salesTaxCents(quote.deposit_amount_cents);
  const taxMetadata = salesTaxMetadata(quote.deposit_amount_cents);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: quote.currency || 'usd',
        unit_amount: quote.deposit_amount_cents,
        product_data: {
          name: 'Speed Trap private event deposit',
          description: `50% deposit for ${formatDollars(quote.total_amount_cents)} private event quote`
        }
      }
    }
  ];
  if (taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: quote.currency || 'usd',
        unit_amount: taxCents,
        product_data: {
          name: STRIPE_SALES_TAX_LABEL,
          description: 'Ohio sales tax'
        }
      }
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: quote.customer_email,
    line_items: lineItems,
    success_url: `${origin}/private-events/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/private-events/deposit/${quote.public_token}`,
    metadata: {
      source: 'speedtrap_private_event_deposit',
      quote_id: quote.id,
      public_token: quote.public_token,
      ...taxMetadata
    },
    payment_intent_data: {
      metadata: {
        source: 'speedtrap_private_event_deposit',
        quote_id: quote.id,
        public_token: quote.public_token,
        ...taxMetadata
      }
    }
  });

  if (!session.url) return NextResponse.json({ error: 'Failed to create Stripe deposit checkout.' }, { status: 500 });

  await supabaseAdmin
    .from('private_event_deposit_quotes')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', quote.id)
    .eq('status', 'quote_sent');

  return NextResponse.json({ url: session.url });
}

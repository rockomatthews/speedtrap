import Stripe from 'stripe';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  const stripeEnv = getStripeEnv();
  const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeEnv.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const merchItemId = session.metadata?.merch_item_id ?? null;
        const qtyRaw = session.metadata?.merch_quantity ?? '1';
        const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(1, Math.floor(Number(qtyRaw))) : 1;

        if (merchItemId) {
          const supabaseAdmin = createSupabaseAdminClient();
          const { data: existing } = await supabaseAdmin
            .from('merch_items')
            .select('id,inventory_count')
            .eq('id', merchItemId)
            .maybeSingle();
          if (existing && typeof existing.inventory_count === 'number') {
            const nextInventory = Math.max(0, existing.inventory_count - qty);
            await supabaseAdmin.from('merch_items').update({ inventory_count: nextInventory }).eq('id', merchItemId);
          }
        }

        console.log('[stripe webhook] checkout.session.completed', {
          id: session.id,
          status: session.status,
          amount_total: session.amount_total,
          currency: session.currency
        });
        break;
      }
      default: {
        // For now we only acknowledge completed checkout sessions.
        break;
      }
    }
  } catch (e) {
    // Don't fail the webhook; Stripe will retry if we return non-2xx.
    console.error('[stripe webhook] handler error', e);
  }

  return NextResponse.json({ received: true });
}


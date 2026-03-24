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
        const supabaseAdmin = createSupabaseAdminClient();
        const merchCartMeta = session.metadata?.merch_cart ?? '';

        if (merchCartMeta) {
          // Format: itemId:qty:size|itemId:qty:size
          const entries = merchCartMeta.split('|').map((s) => s.trim()).filter(Boolean);
          for (const entry of entries) {
            const [itemId, qtyRaw, sizeRaw] = entry.split(':');
            const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(1, Math.floor(Number(qtyRaw))) : 1;
            if (!itemId) continue;

            const { data: existing } = await supabaseAdmin
              .from('merch_items')
              .select('id,inventory_count,size_inventory,sizes')
              .eq('id', itemId)
              .maybeSingle();
            if (!existing) continue;

            const size = sizeRaw && sizeRaw !== '-' ? sizeRaw.toUpperCase() : null;
            const sizes = Array.isArray(existing.sizes) ? existing.sizes.map((s: unknown) => String(s).toUpperCase()) : [];

            if (size && sizes.includes(size)) {
              const currentObj =
                existing.size_inventory && typeof existing.size_inventory === 'object'
                  ? (existing.size_inventory as Record<string, unknown>)
                  : {};
              const current = Number(currentObj[size]);
              const currentQty = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
              const nextQty = Math.max(0, currentQty - qty);
              await supabaseAdmin
                .from('merch_items')
                .update({ size_inventory: { ...currentObj, [size]: nextQty } })
                .eq('id', itemId);
            } else if (typeof existing.inventory_count === 'number') {
              const nextInventory = Math.max(0, existing.inventory_count - qty);
              await supabaseAdmin.from('merch_items').update({ inventory_count: nextInventory }).eq('id', itemId);
            }
          }
        } else {
          // Backward compatibility fallback for older sessions without metadata.
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
          for (const li of lineItems.data) {
            const priceId = typeof li.price?.id === 'string' ? li.price.id : null;
            const qty = typeof li.quantity === 'number' ? Math.max(1, Math.floor(li.quantity)) : 1;
            if (!priceId) continue;

            const { data: existing } = await supabaseAdmin
              .from('merch_items')
              .select('id,inventory_count')
              .eq('stripe_price_id', priceId)
              .maybeSingle();
            if (!existing || typeof existing.inventory_count !== 'number') continue;

            const nextInventory = Math.max(0, existing.inventory_count - qty);
            await supabaseAdmin.from('merch_items').update({ inventory_count: nextInventory }).eq('id', existing.id);
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


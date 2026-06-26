import Stripe from 'stripe';

import { confirmRaceBookingFromPaymentIntent } from '@/lib/bookings/confirm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeWebhookEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function unixToIso(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function stripeId(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function invoiceSubscriptionId(invoice: any) {
  return (
    stripeId(invoice.subscription) ??
    stripeId(invoice.parent?.subscription_details?.subscription) ??
    stripeId(invoice.lines?.data?.[0]?.subscription) ??
    null
  );
}

async function syncMembershipFromSubscription(input: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  subscription: Stripe.Subscription;
  resetCredit: boolean;
}) {
  const subscriptionAny = input.subscription as any;
  const subscriptionId = input.subscription.id;
  const customerId = stripeId(input.subscription.customer);
  const profileIdFromMeta = input.subscription.metadata?.profile_id ?? null;
  const active = input.subscription.status === 'active' || input.subscription.status === 'trialing';

  let profileId: string | null = profileIdFromMeta;
  if (!profileId) {
    const { data } = await input.supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`stripe_subscription_id.eq.${subscriptionId}${customerId ? `,stripe_customer_id.eq.${customerId}` : ''}`)
      .maybeSingle<{ id: string }>();
    profileId = data?.id ?? null;
  }
  if (!profileId) return;

  if (!active) {
    await input.supabaseAdmin
      .from('profiles')
      .update({
        membership_status: 'inactive',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        membership_current_period_start: unixToIso(subscriptionAny.current_period_start),
        membership_current_period_end: unixToIso(subscriptionAny.current_period_end)
      })
      .eq('id', profileId);
    return;
  }

  const { data: existing } = await input.supabaseAdmin
    .from('profiles')
    .select('membership_status,membership_current_period_start')
    .eq('id', profileId)
    .maybeSingle<{ membership_status: string | null; membership_current_period_start: string | null }>();

  const currentPeriodStart = unixToIso(subscriptionAny.current_period_start);
  const periodChanged = Boolean(currentPeriodStart && existing?.membership_current_period_start !== currentPeriodStart);
  const shouldResetCredit = input.resetCredit || periodChanged || existing?.membership_status === 'inactive';
  const update: Record<string, unknown> = {
    membership_status: shouldResetCredit ? 'active-start' : existing?.membership_status ?? 'active-start',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    membership_current_period_start: currentPeriodStart,
    membership_current_period_end: unixToIso(subscriptionAny.current_period_end)
  };
  if (shouldResetCredit) {
    update.membership_free_race_month = null;
    update.membership_free_race_redeemed_at = null;
  }

  await input.supabaseAdmin
    .from('profiles')
    .update(update)
    .eq('id', profileId);
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  const stripeEnv = getStripeWebhookEnv();
  const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeEnv.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid Stripe webhook signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.metadata?.source === 'speedtrap_online_booking') {
          await confirmRaceBookingFromPaymentIntent({
            supabase: createSupabaseAdminClient(),
            stripe,
            paymentIntentId: paymentIntent.id
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const holdId = paymentIntent.metadata?.booking_hold_id;
        if (holdId) {
          await createSupabaseAdminClient()
            .from('race_booking_holds')
            .update({ status: 'cancelled' })
            .eq('id', holdId)
            .eq('status', 'active');
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseAdmin = createSupabaseAdminClient();
        const merchCartMeta = session.metadata?.merch_cart ?? '';

        if (session.mode === 'subscription' && session.metadata?.source === 'speedtrap_membership') {
          const subscriptionId = stripeId(session.subscription);
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await syncMembershipFromSubscription({ supabaseAdmin, subscription, resetCredit: true });
          } else if (session.client_reference_id || session.metadata?.profile_id) {
            await supabaseAdmin
              .from('profiles')
              .update({
                membership_status: 'active-start',
                stripe_customer_id: stripeId(session.customer),
                stripe_subscription_id: null,
                membership_free_race_month: null,
                membership_free_race_redeemed_at: null
              })
              .eq('id', session.metadata?.profile_id ?? session.client_reference_id);
          }
          break;
        }

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
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await syncMembershipFromSubscription({
          supabaseAdmin: createSupabaseAdminClient(),
          subscription: event.data.object as Stripe.Subscription,
          resetCredit: false
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = stripeId(subscription.customer);
        await createSupabaseAdminClient()
          .from('profiles')
          .update({
            membership_status: 'inactive',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            membership_current_period_end: unixToIso((subscription as any).current_period_end)
          })
          .or(`stripe_subscription_id.eq.${subscriptionId}${customerId ? `,stripe_customer_id.eq.${customerId}` : ''}`);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoiceSubscriptionId(invoice);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncMembershipFromSubscription({
            supabaseAdmin: createSupabaseAdminClient(),
            subscription,
            resetCredit: true
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoiceSubscriptionId(invoice);
        const customerId = stripeId(invoice.customer);
        const filters = [subscriptionId ? `stripe_subscription_id.eq.${subscriptionId}` : null, customerId ? `stripe_customer_id.eq.${customerId}` : null]
          .filter(Boolean)
          .join(',');
        if (filters) {
          await createSupabaseAdminClient().from('profiles').update({ membership_status: 'inactive' }).or(filters);
        }
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

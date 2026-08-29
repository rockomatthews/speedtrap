import Stripe from 'stripe';

import { releaseBookingResources } from '@/lib/bookings/availability';
import { confirmRaceBookingFromPaymentIntent } from '@/lib/bookings/confirm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeWebhookEnv } from '@/lib/stripe/env';
import { VmsClient } from '@/lib/vms/client';
import {
  invoiceSubscriptionId,
  stripeId,
  syncMembershipFromSubscription,
  syncVmsMembershipStatusForProfiles,
  unixToIso
} from '@/lib/stripe/membership-sync';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function markRaceBookingRefundedFromStripe(input: {
  supabaseAdmin: SupabaseAdminClient;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  refundId?: string | null;
  refundAmountCents?: number | null;
}) {
  const { supabaseAdmin, paymentIntentId, chargeId, refundId, refundAmountCents } = input;
  if (!paymentIntentId && !chargeId) return;

  let query = supabaseAdmin
    .from('race_bookings')
    .select('id,status,amount_cents,stripe_refund_id,vms_booking_id,stripe_payment_intent_id,stripe_charge_id')
    .limit(1);

  if (paymentIntentId) {
    query = query.eq('stripe_payment_intent_id', paymentIntentId);
  } else if (chargeId) {
    query = query.eq('stripe_charge_id', chargeId);
  }

  const { data: booking, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) return;

  if (refundAmountCents != null && booking.amount_cents > 0 && refundAmountCents < booking.amount_cents) {
    if (refundId && !booking.stripe_refund_id) {
      await supabaseAdmin.from('race_bookings').update({ stripe_refund_id: refundId }).eq('id', booking.id);
    }
    return;
  }

  if (['refunded', 'cancelled'].includes(booking.status)) {
    if (refundId && !booking.stripe_refund_id) {
      await supabaseAdmin.from('race_bookings').update({ stripe_refund_id: refundId }).eq('id', booking.id);
    }
    await releaseBookingResources(supabaseAdmin, booking.id);
    return;
  }

  let vmsError: string | null = null;
  if (booking.vms_booking_id) {
    try {
      await VmsClient.fromEnv().updateBooking(Number(booking.vms_booking_id), { status: 'Cancelled' });
    } catch (error) {
      vmsError = error instanceof Error ? error.message : 'Failed to cancel VMS booking after Stripe refund.';
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('race_bookings')
    .update({
      status: 'refunded',
      stripe_refund_id: refundId ?? booking.stripe_refund_id,
      error: vmsError ? `Stripe refund received, but VMS cancellation failed: ${vmsError}` : null
    })
    .eq('id', booking.id);
  if (updateError) throw new Error(updateError.message);
  await releaseBookingResources(supabaseAdmin, booking.id);

  if (paymentIntentId) {
    await supabaseAdmin
      .from('race_booking_holds')
      .update({ status: 'cancelled' })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .eq('status', 'active');
  }
}

async function markPrivateEventDepositPaid(input: {
  supabaseAdmin: SupabaseAdminClient;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  quoteId?: string | null;
}) {
  const { supabaseAdmin, checkoutSessionId, paymentIntentId, chargeId, quoteId } = input;
  if (!quoteId && !checkoutSessionId && !paymentIntentId && !chargeId) return;

  let query = supabaseAdmin
    .from('private_event_deposit_quotes')
    .select('id,status')
    .limit(1);

  if (quoteId) {
    query = query.eq('id', quoteId);
  } else if (checkoutSessionId) {
    query = query.eq('stripe_checkout_session_id', checkoutSessionId);
  } else if (paymentIntentId) {
    query = query.eq('stripe_payment_intent_id', paymentIntentId);
  } else if (chargeId) {
    query = query.eq('stripe_charge_id', chargeId);
  }

  const { data: quote, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote || quote.status === 'deposit_paid') return;

  const updates = {
    status: 'deposit_paid',
    stripe_checkout_session_id: checkoutSessionId ?? undefined,
    stripe_payment_intent_id: paymentIntentId ?? undefined,
    stripe_charge_id: chargeId ?? undefined,
    deposit_paid_at: new Date().toISOString()
  };

  const { error: updateError } = await supabaseAdmin
    .from('private_event_deposit_quotes')
    .update(updates)
    .eq('id', quote.id)
    .neq('status', 'cancelled');
  if (updateError) throw new Error(updateError.message);
}

async function markPrivateEventDepositRefunded(input: {
  supabaseAdmin: SupabaseAdminClient;
  paymentIntentId?: string | null;
  chargeId?: string | null;
}) {
  const { supabaseAdmin, paymentIntentId, chargeId } = input;
  if (!paymentIntentId && !chargeId) return;

  let query = supabaseAdmin
    .from('private_event_deposit_quotes')
    .select('id,status')
    .limit(1);

  if (paymentIntentId) {
    query = query.eq('stripe_payment_intent_id', paymentIntentId);
  } else if (chargeId) {
    query = query.eq('stripe_charge_id', chargeId);
  }

  const { data: quote, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote || quote.status !== 'deposit_paid') return;

  const { error: updateError } = await supabaseAdmin
    .from('private_event_deposit_quotes')
    .update({ status: 'refunded' })
    .eq('id', quote.id);
  if (updateError) throw new Error(updateError.message);
}

async function markLeagueRegistrationPaid(input: {
  supabaseAdmin: SupabaseAdminClient;
  registrationId?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
}) {
  const { supabaseAdmin, registrationId, checkoutSessionId, paymentIntentId, chargeId } = input;
  if (!registrationId && !checkoutSessionId && !paymentIntentId && !chargeId) return;

  let query = supabaseAdmin
    .from('league_registrations')
    .select(
      'id,league_id,profile_id,vms_customer_id,driver_name,customer_email,payment_option,status,amount_cents,stripe_checkout_session_id,stripe_payment_intent_id,stripe_charge_id'
    )
    .limit(1);

  if (registrationId) {
    query = query.eq('id', registrationId);
  } else if (checkoutSessionId) {
    query = query.eq('stripe_checkout_session_id', checkoutSessionId);
  } else if (paymentIntentId) {
    query = query.eq('stripe_payment_intent_id', paymentIntentId);
  } else if (chargeId) {
    query = query.eq('stripe_charge_id', chargeId);
  }

  const { data: registration, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!registration) return;

  const { data: league, error: leagueError } = await supabaseAdmin
    .from('leagues')
    .select('id,season_weeks,weekly_fee_cents,prize_pool_percent')
    .eq('id', registration.league_id)
    .single();
  if (leagueError) throw new Error(leagueError.message);

  const paidAt = new Date().toISOString();
  const { error: registrationUpdateError } = await supabaseAdmin
    .from('league_registrations')
    .update({
      status: 'registered',
      stripe_checkout_session_id: checkoutSessionId ?? registration.stripe_checkout_session_id,
      stripe_payment_intent_id: paymentIntentId ?? registration.stripe_payment_intent_id,
      stripe_charge_id: chargeId ?? registration.stripe_charge_id,
      paid_at: paidAt
    })
    .eq('id', registration.id);
  if (registrationUpdateError) throw new Error(registrationUpdateError.message);

  const { data: existingMember, error: memberLookupError } = await supabaseAdmin
    .from('league_members')
    .select('id,team_id,role,profile_id')
    .eq('league_id', registration.league_id)
    .eq('vms_customer_id', registration.vms_customer_id)
    .maybeSingle();
  if (memberLookupError) throw new Error(memberLookupError.message);

  let memberId = existingMember?.id as string | undefined;
  if (existingMember) {
    const { error: memberUpdateError } = await supabaseAdmin
      .from('league_members')
      .update({
        profile_id: existingMember.profile_id ?? registration.profile_id,
        driver_name: registration.driver_name
      })
      .eq('id', existingMember.id);
    if (memberUpdateError) throw new Error(memberUpdateError.message);
  } else {
    const { data: member, error: memberInsertError } = await supabaseAdmin
      .from('league_members')
      .insert({
        league_id: registration.league_id,
        profile_id: registration.profile_id,
        vms_customer_id: registration.vms_customer_id,
        driver_name: registration.driver_name,
        role: 'driver'
      })
      .select('id')
      .single();
    if (memberInsertError) throw new Error(memberInsertError.message);
    memberId = member.id;
  }

  if (!memberId) return;

  const seasonWeeks = Math.max(1, Number(league.season_weeks ?? 8));
  const weeklyFeeCents = Math.max(0, Number(league.weekly_fee_cents ?? 4000));
  const paidRows =
    registration.payment_option === 'full_season'
      ? Array.from({ length: seasonWeeks }, (_, index) => {
          const baseAmount = Math.floor(Number(registration.amount_cents ?? 0) / seasonWeeks);
          const remainder = Number(registration.amount_cents ?? 0) - baseAmount * seasonWeeks;
          return {
            league_id: registration.league_id,
            member_id: memberId,
            week_number: index + 1,
            amount_cents: baseAmount + (index === 0 ? remainder : 0),
            status: 'paid',
            stripe_payment_intent_id: paymentIntentId ?? registration.stripe_payment_intent_id,
            paid_at: paidAt,
            notes: 'Full-season league registration payment'
          };
        })
      : Array.from({ length: seasonWeeks }, (_, index) => ({
          league_id: registration.league_id,
          member_id: memberId,
          week_number: index + 1,
          amount_cents: weeklyFeeCents,
          status: index === 0 ? 'paid' : 'pending',
          stripe_payment_intent_id: index === 0 ? paymentIntentId ?? registration.stripe_payment_intent_id : null,
          paid_at: index === 0 ? paidAt : null,
          notes: index === 0 ? 'Week 1 league registration payment' : 'Future weekly league installment'
        }));

  const { error: duesError } = await supabaseAdmin.from('league_dues').upsert(paidRows, { onConflict: 'member_id,week_number' });
  if (duesError) throw new Error(duesError.message);

  const prizeDescription = `League registration ${registration.id} (${registration.payment_option}) prize-pool contribution`;
  const { data: existingPrize, error: prizeLookupError } = await supabaseAdmin
    .from('league_prize_ledger')
    .select('id')
    .eq('league_id', registration.league_id)
    .eq('description', prizeDescription)
    .maybeSingle();
  if (prizeLookupError) throw new Error(prizeLookupError.message);

  if (!existingPrize) {
    const prizeAmount = Math.round(Number(registration.amount_cents ?? 0) * (Number(league.prize_pool_percent ?? 50) / 100));
    const { error: prizeError } = await supabaseAdmin.from('league_prize_ledger').insert({
      league_id: registration.league_id,
      source_type: 'payment',
      amount_cents: prizeAmount,
      description: prizeDescription
    });
    if (prizeError) throw new Error(prizeError.message);
  }
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
        } else if (paymentIntent.metadata?.source === 'speedtrap_private_event_deposit') {
          await markPrivateEventDepositPaid({
            supabaseAdmin: createSupabaseAdminClient(),
            paymentIntentId: paymentIntent.id,
            chargeId: stripeId(paymentIntent.latest_charge),
            quoteId: paymentIntent.metadata.quote_id
          });
        } else if (paymentIntent.metadata?.source === 'speedtrap_league_registration') {
          await markLeagueRegistrationPaid({
            supabaseAdmin: createSupabaseAdminClient(),
            registrationId: paymentIntent.metadata.registration_id,
            paymentIntentId: paymentIntent.id,
            chargeId: stripeId(paymentIntent.latest_charge)
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
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.refunded) {
          await markPrivateEventDepositRefunded({
            supabaseAdmin: createSupabaseAdminClient(),
            paymentIntentId: stripeId(charge.payment_intent),
            chargeId: charge.id
          });
          await markRaceBookingRefundedFromStripe({
            supabaseAdmin: createSupabaseAdminClient(),
            paymentIntentId: stripeId(charge.payment_intent),
            chargeId: charge.id,
            refundId: typeof charge.refunds?.data?.[0]?.id === 'string' ? charge.refunds.data[0].id : null,
            refundAmountCents: typeof charge.amount_refunded === 'number' ? charge.amount_refunded : null
          });
        }
        break;
      }
      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status === 'succeeded') {
          await markPrivateEventDepositRefunded({
            supabaseAdmin: createSupabaseAdminClient(),
            paymentIntentId: stripeId(refund.payment_intent),
            chargeId: stripeId(refund.charge)
          });
          await markRaceBookingRefundedFromStripe({
            supabaseAdmin: createSupabaseAdminClient(),
            paymentIntentId: stripeId(refund.payment_intent),
            chargeId: stripeId(refund.charge),
            refundId: refund.id,
            refundAmountCents: typeof refund.amount === 'number' ? refund.amount : null
          });
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseAdmin = createSupabaseAdminClient();
        const merchCartMeta = session.metadata?.merch_cart ?? '';

        if (session.mode === 'payment' && session.metadata?.source === 'speedtrap_private_event_deposit') {
          await markPrivateEventDepositPaid({
            supabaseAdmin,
            checkoutSessionId: session.id,
            paymentIntentId: stripeId(session.payment_intent),
            quoteId: session.metadata.quote_id
          });
          break;
        }

        if (session.mode === 'payment' && session.metadata?.source === 'speedtrap_league_registration') {
          await markLeagueRegistrationPaid({
            supabaseAdmin,
            registrationId: session.metadata.registration_id,
            checkoutSessionId: session.id,
            paymentIntentId: stripeId(session.payment_intent)
          });
          break;
        }

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
                membership_free_race_redeemed_at: null,
                membership_monthly_15_race_month: null,
                membership_monthly_15_race_redeemed_at: null
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
        const supabaseAdmin = createSupabaseAdminClient();
        const filters = `stripe_subscription_id.eq.${subscriptionId}${customerId ? `,stripe_customer_id.eq.${customerId}` : ''}`;
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(filters);
        await supabaseAdmin
          .from('profiles')
          .update({
            membership_status: 'inactive',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            membership_current_period_end: unixToIso((subscription as any).current_period_end)
          })
          .or(filters);
        await syncVmsMembershipStatusForProfiles({
          supabaseAdmin,
          profileIds: profiles?.map((profile) => profile.id) ?? [],
          active: false
        });
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
          const supabaseAdmin = createSupabaseAdminClient();
          const { data: profiles } = await supabaseAdmin.from('profiles').select('id').or(filters);
          await supabaseAdmin.from('profiles').update({ membership_status: 'inactive' }).or(filters);
          await syncVmsMembershipStatusForProfiles({
            supabaseAdmin,
            profileIds: profiles?.map((profile) => profile.id) ?? [],
            active: false
          });
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

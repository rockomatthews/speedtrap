import Stripe from 'stripe';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export function unixToIso(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

export function stripeId(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

export function invoiceSubscriptionId(invoice: any) {
  return (
    stripeId(invoice.subscription) ??
    stripeId(invoice.parent?.subscription_details?.subscription) ??
    stripeId(invoice.lines?.data?.[0]?.subscription) ??
    null
  );
}

async function syncVmsMembershipForProfile(input: {
  supabaseAdmin: SupabaseAdmin;
  profileId: string;
  active: boolean;
}) {
  const membershipId = env.VMS_MEMBERSHIP_ID;
  if (!membershipId || !env.VMS_API_KEY) return;

  const { data, error } = await input.supabaseAdmin
    .from('profiles')
    .select('vms_customer_id')
    .eq('id', input.profileId)
    .maybeSingle<{ vms_customer_id: number | null }>();

  if (error) {
    console.error('[membership sync] failed to load profile for VMS sync', error);
    return;
  }
  if (!data?.vms_customer_id) return;

  try {
    const vms = VmsClient.fromEnv();
    await vms.updateCustomer(data.vms_customer_id, {
      membershipId: input.active ? membershipId : null
    });
  } catch (e) {
    // Stripe/Supabase remain the source of truth; VMS can be retried manually if needed.
    console.error('[membership sync] failed to sync VMS membership', e);
  }
}

export async function syncVmsMembershipStatusForProfiles(input: {
  supabaseAdmin: SupabaseAdmin;
  profileIds: string[];
  active: boolean;
}) {
  const uniqueProfileIds = Array.from(new Set(input.profileIds.filter(Boolean)));
  for (const profileId of uniqueProfileIds) {
    await syncVmsMembershipForProfile({
      supabaseAdmin: input.supabaseAdmin,
      profileId,
      active: input.active
    });
  }
}

export async function syncMembershipFromSubscription(input: {
  supabaseAdmin: SupabaseAdmin;
  subscription: Stripe.Subscription;
  resetCredit: boolean;
  profileId?: string | null;
}) {
  const subscriptionAny = input.subscription as any;
  const subscriptionId = input.subscription.id;
  const customerId = stripeId(input.subscription.customer);
  const profileIdFromMeta = input.subscription.metadata?.profile_id ?? null;
  const active = input.subscription.status === 'active' || input.subscription.status === 'trialing';

  let profileId: string | null = input.profileId ?? profileIdFromMeta;
  if (!profileId) {
    const { data } = await input.supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`stripe_subscription_id.eq.${subscriptionId}${customerId ? `,stripe_customer_id.eq.${customerId}` : ''}`)
      .maybeSingle<{ id: string }>();
    profileId = data?.id ?? null;
  }
  if (!profileId) return null;

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
    await syncVmsMembershipForProfile({ supabaseAdmin: input.supabaseAdmin, profileId, active: false });
    return profileId;
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

  await input.supabaseAdmin.from('profiles').update(update).eq('id', profileId);
  await syncVmsMembershipForProfile({ supabaseAdmin: input.supabaseAdmin, profileId, active: true });
  return profileId;
}

export async function syncMembershipFromCheckoutSession(input: {
  supabaseAdmin: SupabaseAdmin;
  stripe: Stripe;
  sessionId: string;
  profileId: string;
}) {
  const session = await input.stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ['subscription']
  });

  if (session.mode !== 'subscription' || session.metadata?.source !== 'speedtrap_membership') {
    throw new Error('This checkout session is not a Speed Trap membership checkout.');
  }

  const sessionProfileId = session.metadata?.profile_id ?? session.client_reference_id ?? null;
  if (sessionProfileId && sessionProfileId !== input.profileId) {
    throw new Error('This checkout session belongs to a different signed-in user.');
  }

  const subscription =
    typeof session.subscription === 'string'
      ? await input.stripe.subscriptions.retrieve(session.subscription)
      : (session.subscription as Stripe.Subscription | null);

  if (subscription) {
    return syncMembershipFromSubscription({
      supabaseAdmin: input.supabaseAdmin,
      subscription,
      resetCredit: true,
      profileId: input.profileId
    });
  }

  if (session.payment_status === 'paid') {
    await input.supabaseAdmin
      .from('profiles')
      .update({
        membership_status: 'active-start',
        stripe_customer_id: stripeId(session.customer),
        stripe_subscription_id: null,
        membership_free_race_month: null,
        membership_free_race_redeemed_at: null
      })
      .eq('id', input.profileId);
    await syncVmsMembershipForProfile({ supabaseAdmin: input.supabaseAdmin, profileId: input.profileId, active: true });
    return input.profileId;
  }

  return null;
}

export async function syncMembershipFromEmail(input: {
  supabaseAdmin: SupabaseAdmin;
  stripe: Stripe;
  email: string;
  profileId: string;
  membershipPriceId: string;
}) {
  const customers = await input.stripe.customers.list({ email: input.email, limit: 10 });
  const activeSubscriptions: Stripe.Subscription[] = [];

  for (const customer of customers.data) {
    const subscriptions = await input.stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });

    for (const subscription of subscriptions.data) {
      const active = subscription.status === 'active' || subscription.status === 'trialing';
      if (!active) continue;

      const subscriptionAny = subscription as any;
      const sourceMatches = subscription.metadata?.source === 'speedtrap_membership';
      const priceMatches = subscription.items.data.some((item) => item.price?.id === input.membershipPriceId);
      if (sourceMatches || priceMatches) {
        activeSubscriptions.push(subscriptionAny);
      }
    }
  }

  const newestSubscription = activeSubscriptions.sort((a, b) => {
    const aEnd = typeof (a as any).current_period_end === 'number' ? (a as any).current_period_end : 0;
    const bEnd = typeof (b as any).current_period_end === 'number' ? (b as any).current_period_end : 0;
    return bEnd - aEnd;
  })[0];

  if (!newestSubscription) return null;

  return syncMembershipFromSubscription({
    supabaseAdmin: input.supabaseAdmin,
    subscription: newestSubscription,
    resetCredit: true,
    profileId: input.profileId
  });
}

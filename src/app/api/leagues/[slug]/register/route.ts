import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/supabase/env';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getStripeEnv } from '@/lib/stripe/env';
import { STRIPE_SALES_TAX_LABEL, salesTaxCents, salesTaxMetadata } from '@/lib/stripe/tax';
import { VmsClient } from '@/lib/vms/client';
import type { VmsCustomerProfile } from '@/lib/vms/types';

export const dynamic = 'force-dynamic';

const registrationSchema = z.object({
  driverName: z.string().trim().min(2).max(80),
  paymentOption: z.enum(['installments', 'full_season'])
});

function originFromRequest(request: Request) {
  return env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

async function getOrCreateVmsCustomer(input: {
  existingCustomerId: number | null;
  driverName: string;
  email: string;
}): Promise<VmsCustomerProfile> {
  const vms = VmsClient.fromEnv();
  let customer: VmsCustomerProfile | null = null;

  if (input.existingCustomerId) {
    customer = await vms.getCustomer(input.existingCustomerId);
  }

  customer ??= await vms.findCustomerByEmail(input.email);

  if (!customer) {
    customer = await vms.createCustomer({
      name: input.driverName,
      email: input.email,
      homeVenueId: env.VMS_HOME_VENUE_ID ?? 1,
      source: 'Website',
      sourceOther: 'Speed Trap league registration',
      ifDuplicateEmailMakeSecondary: true
    });
  } else if (customer.name.trim() !== input.driverName.trim()) {
    try {
      const updated = await vms.updateCustomer(customer.id, { name: input.driverName, email: input.email });
      customer = updated ?? customer;
    } catch {
      // Registration should not fail just because VMS refuses a display-name update.
    }
  }

  if (!customer) throw new Error('VMS did not return a driver profile.');
  return customer;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const authClient = await createRouteHandlerClient();
  const {
    data: { user }
  } = await authClient.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in before registering for a league.' }, { status: 401 });
  }

  const parsed = registrationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id,slug,name,status,visibility,season_weeks,team_count,roster_size,weekly_fee_cents,full_season_fee_cents,prize_pool_percent')
    .eq('slug', slug)
    .maybeSingle();

  if (leagueError) return NextResponse.json({ error: leagueError.message }, { status: 500 });
  if (!league || league.visibility !== 'public' || league.status !== 'active') {
    return NextResponse.json({ error: 'This league is not open for registration yet.' }, { status: 404 });
  }

  const capacity = Number(league.team_count ?? 8) * Number(league.roster_size ?? 4);
  const { data: reservedRows, error: countError } = await supabase
    .from('league_registrations')
    .select('id')
    .eq('league_id', league.id)
    .in('status', ['pending_payment', 'registered']);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((reservedRows?.length ?? 0) >= capacity) {
    return NextResponse.json({ error: 'This league is already full.' }, { status: 409 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,display_name,phone,vms_customer_id')
    .eq('id', user.id)
    .maybeSingle<{ id: string; display_name: string | null; phone: string | null; vms_customer_id: number | null }>();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  let customer: VmsCustomerProfile;
  try {
    customer = await getOrCreateVmsCustomer({
      existingCustomerId: profile?.vms_customer_id ?? null,
      driverName: parsed.data.driverName,
      email: user.email
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'VMS could not create the league driver profile.' },
      { status: 502 }
    );
  }

  await supabase.from('profiles').upsert({
    id: user.id,
    display_name: parsed.data.driverName,
    vms_customer_id: customer.id
  });

  const existingFilters = `profile_id.eq.${user.id},vms_customer_id.eq.${customer.id}`;
  const { data: existingRegistration, error: existingError } = await supabase
    .from('league_registrations')
    .select('id,status')
    .eq('league_id', league.id)
    .or(existingFilters)
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existingRegistration?.status === 'registered') {
    return NextResponse.json({ error: 'You are already registered for this league.' }, { status: 409 });
  }

  const weeklyFeeCents = Number(league.weekly_fee_cents ?? 4000);
  const fullSeasonFeeCents = Number(league.full_season_fee_cents ?? 30000);
  const amountCents = parsed.data.paymentOption === 'full_season' ? fullSeasonFeeCents : weeklyFeeCents;
  const paymentLabel = parsed.data.paymentOption === 'full_season' ? 'Full season registration' : 'Week 1 registration';
  if (amountCents < 50) {
    return NextResponse.json({ error: 'League registration price is not configured correctly.' }, { status: 500 });
  }

  const registrationPayload = {
    league_id: league.id,
    profile_id: user.id,
    vms_customer_id: customer.id,
    driver_name: parsed.data.driverName,
    customer_email: user.email,
    customer_phone: profile?.phone ?? null,
    payment_option: parsed.data.paymentOption,
    status: 'pending_payment',
    amount_cents: amountCents
  };

  const { data: registration, error: registrationError } = existingRegistration
    ? await supabase
        .from('league_registrations')
        .update(registrationPayload)
        .eq('id', existingRegistration.id)
        .select('id')
        .single()
    : await supabase
        .from('league_registrations')
        .insert(registrationPayload)
        .select('id')
        .single();

  if (registrationError) return NextResponse.json({ error: registrationError.message }, { status: 500 });

  const metadata = {
    source: 'speedtrap_league_registration',
    registration_id: registration.id,
    league_id: league.id,
    profile_id: user.id,
    payment_option: parsed.data.paymentOption
  };
  const origin = originFromRequest(request);
  const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
  const taxCents = salesTaxCents(amountCents);
  const taxMetadata = salesTaxMetadata(amountCents);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: {
          name: `${league.name} - ${paymentLabel}`,
          description:
            parsed.data.paymentOption === 'full_season'
              ? `${league.season_weeks ?? 8} week Speed Trap league season`
              : 'Speed Trap league weekly installment'
        }
      }
    }
  ];
  if (taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
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
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { ...metadata, ...taxMetadata },
    payment_intent_data: { metadata: { ...metadata, ...taxMetadata } },
    line_items: lineItems,
    success_url: `${origin}/leagues/${league.slug}?league_registered=success`,
    cancel_url: `${origin}/leagues/${league.slug}?league_registered=cancelled`
  });

  const { error: checkoutError } = await supabase
    .from('league_registrations')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', registration.id);
  if (checkoutError) return NextResponse.json({ error: checkoutError.message }, { status: 500 });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}

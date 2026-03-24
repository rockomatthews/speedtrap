import Stripe from 'stripe';

import { env } from '@/lib/supabase/env';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getStripeEnv } from '@/lib/stripe/env';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CreateCheckoutSessionBody = {
  items?: Array<{ priceId?: string; quantity?: number; size?: string | null }>;
  priceId?: string;
  quantity?: number;
  size?: string | null;
};

type NormalizedCartItem = {
  priceId: string;
  quantity: number;
  size: string | null;
};

function normalizeRequestedItems(body: CreateCheckoutSessionBody | null): NormalizedCartItem[] {
  const requestedItemsRaw =
    Array.isArray(body?.items) && body?.items.length > 0
      ? body.items
      : body?.priceId
        ? [{ priceId: body.priceId, quantity: body.quantity, size: body.size ?? null }]
        : [];
  return requestedItemsRaw.map((it) => ({
    priceId: String(it.priceId ?? '').trim(),
    quantity:
      typeof it.quantity === 'number' && Number.isFinite(it.quantity) ? Math.min(10, Math.max(1, Math.floor(it.quantity))) : 1,
    size: it.size ? String(it.size).trim().toUpperCase() : null
  }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateCheckoutSessionBody | null;

  const normalizedItems = normalizeRequestedItems(body);
  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: 'No cart items provided.' }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  const priceIds = Array.from(new Set(normalizedItems.map((i) => i.priceId).filter(Boolean)));
  if (priceIds.length === 0) {
    return NextResponse.json({ error: 'Invalid cart items.' }, { status: 400 });
  }

  // Validate requested items against active catalog rows in a single query.
  const { data: catalogRows, error: catalogError } = await supabase
    .from('merch_items')
    .select('id,name,price_cents,currency,stripe_price_id,inventory_count,sizes,size_inventory,active')
    .eq('active', true)
    .in('stripe_price_id', priceIds);

  if (catalogError) {
    return NextResponse.json({ error: 'Failed to validate cart items.' }, { status: 500 });
  }

  const catalogByPriceId = new Map<string, any>();
  for (const row of catalogRows ?? []) {
    if (row?.stripe_price_id) catalogByPriceId.set(String(row.stripe_price_id), row);
  }

  const aggregatedQtyByPrice = new Map<string, number>();
  for (const it of normalizedItems) {
    aggregatedQtyByPrice.set(it.priceId, (aggregatedQtyByPrice.get(it.priceId) ?? 0) + it.quantity);
  }

  for (const it of normalizedItems) {
    const row = catalogByPriceId.get(it.priceId);
    if (!row) {
      return NextResponse.json({ error: `Invalid item in cart (${it.priceId}).` }, { status: 400 });
    }

    const availableSizes = Array.isArray(row.sizes) ? row.sizes.map((s: unknown) => String(s).toUpperCase()) : [];
    if (availableSizes.length > 0) {
      if (!it.size) {
        return NextResponse.json({ error: `Please select a size for ${row.name ?? 'this item'}.` }, { status: 400 });
      }
      if (!availableSizes.includes(it.size)) {
        return NextResponse.json({ error: `Invalid size for ${row.name ?? 'item'}.` }, { status: 400 });
      }
    }
  }

  const aggregatedByKey = new Map<string, number>();
  for (const it of normalizedItems) {
    const row = catalogByPriceId.get(it.priceId);
    const itemId = String(row.id);
    const key = `${itemId}::${it.size ?? '-'}`;
    aggregatedByKey.set(key, (aggregatedByKey.get(key) ?? 0) + it.quantity);
  }

  for (const [priceId, qty] of aggregatedQtyByPrice.entries()) {
    const row = catalogByPriceId.get(priceId);
    if (!row) continue;
    const sizes = Array.isArray(row.sizes) ? row.sizes.map((s: unknown) => String(s).toUpperCase()) : [];
    if (sizes.length === 0) {
      if (typeof row.inventory_count === 'number' && row.inventory_count < qty) {
        return NextResponse.json({ error: `${row.name ?? 'Item'} is out of stock.` }, { status: 409 });
      }
      continue;
    }
    for (const size of sizes) {
      const key = `${String(row.id)}::${size}`;
      const requested = aggregatedByKey.get(key) ?? 0;
      if (requested <= 0) continue;
      const sizeInventoryRaw = row.size_inventory && typeof row.size_inventory === 'object' ? row.size_inventory : {};
      const available = Number((sizeInventoryRaw as Record<string, unknown>)[size]);
      const availableQty = Number.isFinite(available) ? Math.max(0, Math.floor(available)) : 0;
      if (availableQty < requested) {
        return NextResponse.json({ error: `${row.name ?? 'Item'} (${size}) is out of stock.` }, { status: 409 });
      }
    }
  }

  // Prefer incoming request origin so custom domains remain the canonical redirect host.
  const origin = new URL(request.url).origin || env.NEXT_PUBLIC_SITE_URL;

  try {
    const stripeEnv = getStripeEnv();
    const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

    const lineItems = normalizedItems.map((it) => ({
      price: it.priceId,
      quantity: it.quantity
    }));

    const metadataPairs = normalizedItems
      .map((it) => {
        const row = catalogByPriceId.get(it.priceId);
        return `${row?.id ?? it.priceId}:${it.quantity}:${it.size ?? '-'}`;
      })
      .join('|')
      .slice(0, 500);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/merch/cancel`,
      metadata: {
        merch_cart: metadataPairs
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to start checkout session.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateCheckoutSessionBody | null;
  const normalizedItems = normalizeRequestedItems(body);
  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: 'No cart items provided.' }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();
  const priceIds = Array.from(new Set(normalizedItems.map((i) => i.priceId).filter(Boolean)));
  const { data: catalogRows, error } = await supabase
    .from('merch_items')
    .select('id,name,price_cents,currency,stripe_price_id,inventory_count,sizes,size_inventory,active')
    .eq('active', true)
    .in('stripe_price_id', priceIds);
  if (error) return NextResponse.json({ error: 'Failed to preview cart.' }, { status: 500 });

  const byPrice = new Map<string, any>();
  for (const row of catalogRows ?? []) byPrice.set(String(row.stripe_price_id), row);

  let subtotalCents = 0;
  for (const it of normalizedItems) {
    const row = byPrice.get(it.priceId);
    if (!row) return NextResponse.json({ error: 'Invalid cart item.' }, { status: 400 });
    const unit = typeof row.price_cents === 'number' ? row.price_cents : 0;
    subtotalCents += unit * it.quantity;
  }

  // Simple pre-checkout estimate (final tax/shipping is finalized at Stripe Checkout).
  const shippingCents = subtotalCents >= 7500 ? 0 : 800;
  const taxCents = Math.round(subtotalCents * 0.085);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const currency = String((catalogRows?.[0] as any)?.currency ?? 'usd');

  return NextResponse.json({
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    currency,
    note: 'Estimate only. Final tax and shipping are calculated at Stripe Checkout.'
  });
}


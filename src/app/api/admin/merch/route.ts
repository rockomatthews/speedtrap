import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStripeEnv } from '@/lib/stripe/env';

export const runtime = 'nodejs';

function toSlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function parsePriceToCents(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function parseInventoryCount(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

const ALLOWED_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL']);
const SIZE_KEYS = ['XS', 'S', 'M', 'L', 'XL'] as const;

function parseSizes(form: FormData) {
  const values = form
    .getAll('sizes')
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => ALLOWED_SIZES.has(v));
  return Array.from(new Set(values));
}

function parseSizeInventory(form: FormData, selectedSizes: string[]) {
  const out: Record<string, number> = {};
  for (const size of selectedSizes) {
    const key = `size_inventory_${size.toLowerCase()}`;
    const raw = String(form.get(key) ?? '0').trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    out[size] = Math.floor(n);
  }
  // Normalize keys so we only store supported sizes.
  const normalized: Record<string, number> = {};
  for (const size of SIZE_KEYS) {
    if (typeof out[size] === 'number') normalized[size] = out[size];
  }
  return normalized;
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
    if (data?.role === 'admin') return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Server misconfigured: missing service role key.' }, { status: 500 })
    };
  }

  {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
}

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('merch_items')
    .select(
      'id,name,description,image_url,price_cents,currency,inventory_count,sizes,size_inventory,stripe_price_id,stripe_product_id,active,created_at'
    )
    .order('created_at', { ascending: true });

  if (!error) {
    return NextResponse.json({ items: data ?? [] });
  }

  // Backward compatibility: if newer columns don't exist yet, fall back to base schema.
  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('merch_items')
    .select('id,name,description,stripe_price_id,active,created_at')
    .order('created_at', { ascending: true });

  if (fallbackError) {
    return NextResponse.json(
      {
        error: `Failed to load merch items: ${fallbackError.message}. Run migrations 0002-0007 in Supabase SQL Editor.`
      },
      { status: 500 }
    );
  }

  const normalized = (fallbackData ?? []).map((it: any) => ({
    ...it,
    image_url: null,
    price_cents: 0,
    currency: 'usd',
    inventory_count: 0,
    sizes: [],
    size_inventory: {},
    stripe_product_id: null
  }));

  return NextResponse.json({ items: normalized });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const form = await request.formData();

  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const price = String(form.get('price') ?? '').trim();
  const inventory = String(form.get('inventory') ?? '').trim();
  const currency = String(form.get('currency') ?? 'usd')
    .trim()
    .toLowerCase();
  const active = String(form.get('active') ?? 'true') !== 'false';
  const sizes = parseSizes(form);
  const sizeInventory = parseSizeInventory(form, sizes);
  const image = form.get('image');
  if (sizeInventory === null) {
    return NextResponse.json({ error: 'Invalid per-size inventory values.' }, { status: 400 });
  }

  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  const priceCents = parsePriceToCents(price);
  if (!priceCents) return NextResponse.json({ error: 'Valid price is required.' }, { status: 400 });
  const inventoryCount = parseInventoryCount(inventory);
  if (inventoryCount === null) return NextResponse.json({ error: 'Valid inventory is required.' }, { status: 400 });

  const itemId = `${toSlug(title) || 'item'}-${randomUUID().slice(0, 8)}`;
  let imageUrl: string | null = null;

  const supabaseAdmin = createSupabaseAdminClient();
  if (image instanceof File && image.size > 0) {
    const ext = (image.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${itemId}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await image.arrayBuffer());

    const upload = await supabaseAdmin.storage.from('merch').upload(path, bytes, {
      contentType: image.type || 'application/octet-stream',
      upsert: false
    });
    if (upload.error) {
      return NextResponse.json({ error: `Image upload failed: ${upload.error.message}` }, { status: 500 });
    }

    const pub = supabaseAdmin.storage.from('merch').getPublicUrl(path);
    imageUrl = pub.data.publicUrl;
  }

  try {
    const stripeEnv = getStripeEnv();
    const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

    const product = await stripe.products.create({
      name: title,
      description: description || undefined,
      images: imageUrl ? [imageUrl] : undefined,
      metadata: { app_merch_item_id: itemId }
    });

    const createdPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: priceCents,
      currency
    });

    const { error } = await supabaseAdmin.from('merch_items').insert({
      id: itemId,
      name: title,
      description: description || null,
      stripe_price_id: createdPrice.id,
      stripe_product_id: product.id,
      image_url: imageUrl,
      price_cents: priceCents,
      inventory_count: inventoryCount,
      sizes,
      size_inventory: sizeInventory,
      currency,
      active
    });
    if (error) {
      return NextResponse.json({ error: `Failed to save merch item: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: itemId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create merch item.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const form = await request.formData();
  const id = String(form.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const price = String(form.get('price') ?? '').trim();
  const inventory = String(form.get('inventory') ?? '').trim();
  const currency = String(form.get('currency') ?? 'usd')
    .trim()
    .toLowerCase();
  const active = String(form.get('active') ?? 'true') !== 'false';
  const sizes = parseSizes(form);
  const sizeInventory = parseSizeInventory(form, sizes);
  const image = form.get('image');
  if (sizeInventory === null) {
    return NextResponse.json({ error: 'Invalid per-size inventory values.' }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('merch_items')
    .select('id,stripe_product_id,price_cents,currency,inventory_count')
    .eq('id', id)
    .maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ error: 'Merch item not found.' }, { status: 404 });
  }

  let imageUrl: string | null | undefined = undefined;
  if (image instanceof File && image.size > 0) {
    const ext = (image.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${id}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await image.arrayBuffer());
    const upload = await supabaseAdmin.storage.from('merch').upload(path, bytes, {
      contentType: image.type || 'application/octet-stream',
      upsert: false
    });
    if (upload.error) {
      return NextResponse.json({ error: `Image upload failed: ${upload.error.message}` }, { status: 500 });
    }
    imageUrl = supabaseAdmin.storage.from('merch').getPublicUrl(path).data.publicUrl;
  }

  const updates: Record<string, unknown> = { active };
  if (title) updates.name = title;
  updates.description = description || null;
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  const parsedInventoryCount = parseInventoryCount(inventory);
  if (parsedInventoryCount === null) {
    return NextResponse.json({ error: 'Valid inventory is required.' }, { status: 400 });
  }
  updates.inventory_count = parsedInventoryCount;
  updates.sizes = sizes;
  updates.size_inventory = sizeInventory;

  const parsedPriceCents = parsePriceToCents(price);
  const priceChanged = Boolean(parsedPriceCents && parsedPriceCents !== existing.price_cents);
  const currencyChanged = currency !== existing.currency;

  try {
    if (priceChanged || currencyChanged) {
      const stripeEnv = getStripeEnv();
      const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);

      const newPrice = await stripe.prices.create({
        product: existing.stripe_product_id ?? undefined,
        unit_amount: parsedPriceCents ?? existing.price_cents,
        currency: currencyChanged ? currency : existing.currency
      });

      updates.stripe_price_id = newPrice.id;
      updates.price_cents = parsedPriceCents ?? existing.price_cents;
      updates.currency = currencyChanged ? currency : existing.currency;
    }

    const { error } = await supabaseAdmin.from('merch_items').update(updates).eq('id', id);
    if (error) {
      return NextResponse.json({ error: `Failed to update merch item: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update merch item.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id?.trim();
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('merch_items').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: `Failed to delete merch item: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


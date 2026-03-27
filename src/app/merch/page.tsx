import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

import { MerchClient } from './ui/MerchClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MerchPage() {
  const supabase = await createSupabaseServerClient();

  const { data: items, error } = await supabase
    .from('merch_items')
    .select('id,name,description,stripe_price_id,image_url,image_urls,price_cents,currency,inventory_count,sizes,size_inventory')
    .eq('active', true)
    .order('created_at', { ascending: true });

  let rows: any[] | null = items ?? null;
  if (error) {
    // Backward compatibility: older schema before image/price/inventory columns.
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('merch_items')
      .select('id,name,description,stripe_price_id')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (fallbackError) {
      return (
        <AppShell>
          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Merch
            </Typography>
            <Typography color="error">
              Failed to load merch catalog: {fallbackError.message}. Run migrations 0002-0007 in Supabase SQL Editor.
            </Typography>
          </Stack>
        </AppShell>
      );
    }

    rows = (fallbackRows ?? []).map((it: any) => ({
      ...it,
      image_url: null,
      image_urls: [],
      price_cents: 0,
      currency: 'usd',
      inventory_count: 0,
      sizes: [],
      size_inventory: {}
    }));
  }

  const merch = (rows ?? []).map((it: any) => ({
    id: String(it.id),
    name: String(it.name ?? ''),
    description: String(it.description ?? ''),
    priceId: String(it.stripe_price_id),
    imageUrl: it.image_url ? String(it.image_url) : null,
    imageUrls: Array.isArray(it.image_urls) ? it.image_urls.map((s: unknown) => String(s)) : [],
    priceCents: typeof it.price_cents === 'number' ? it.price_cents : null,
    currency: it.currency ? String(it.currency) : null,
    inventoryCount: typeof it.inventory_count === 'number' ? it.inventory_count : null,
    sizes: Array.isArray(it.sizes) ? it.sizes.map((s: unknown) => String(s)) : [],
    sizeInventory:
      it.size_inventory && typeof it.size_inventory === 'object'
        ? Object.fromEntries(
            Object.entries(it.size_inventory as Record<string, unknown>).map(([k, v]) => [
              String(k).toUpperCase(),
              Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0
            ])
          )
        : {}
  }));

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Merch
          </Typography>
          <Typography color="text.secondary">Limited-run race gear. One-time purchases via Stripe.</Typography>
        </Stack>

        <MerchClient items={merch} />
      </Stack>
    </AppShell>
  );
}


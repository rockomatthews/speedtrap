import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

import { MerchClient } from './ui/MerchClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MerchPage() {
  const supabase = await createSupabaseServerClient();

  const { data: items, error } = await supabase
    .from('merch_items')
    .select('id,name,description,stripe_price_id,image_url,price_cents,currency')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    // If the table/RLS isn't set up, show a failure rather than an empty merch UI.
    return (
      <AppShell>
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Merch
          </Typography>
          <Typography color="error">
            Failed to load merch catalog. Please contact support.
          </Typography>
        </Stack>
      </AppShell>
    );
  }

  const merch = (items ?? []).map((it: any) => ({
    id: String(it.id),
    name: String(it.name ?? ''),
    description: String(it.description ?? ''),
    priceId: String(it.stripe_price_id),
    imageUrl: it.image_url ? String(it.image_url) : null,
    priceCents: typeof it.price_cents === 'number' ? it.price_cents : null,
    currency: it.currency ? String(it.currency) : null
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


import Link from 'next/link';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Stripe from 'stripe';

import { getStripeEnv } from '@/lib/stripe/env';

import { AppShell } from '@/components/AppShell';

export default async function MerchSuccessPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const sessionIdParam = sp.session_id ?? sp.sessionId;
  const sessionId = typeof sessionIdParam === 'string' ? sessionIdParam : null;

  if (!sessionId) {
    return (
      <AppShell>
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Checkout complete
          </Typography>
          <Typography color="text.secondary">Missing `session_id`.</Typography>
          <Button variant="contained" component={Link} href="/merch">
            Back to Merch
          </Button>
        </Stack>
      </AppShell>
    );
  }

  const stripeEnv = getStripeEnv();
  const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'line_items.data.price.product']
  });

  const lineItems = Array.isArray((session.line_items as any)?.data) ? (session.line_items as any).data : [];

  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Thanks for your purchase
        </Typography>

        <Typography color="text.secondary">
          Status: <span style={{ fontFamily: 'monospace' }}>{session.status}</span>
        </Typography>

        <Stack spacing={1}>
          {lineItems.length === 0 ? (
            <Typography color="text.secondary">No line items found for this checkout session.</Typography>
          ) : (
            lineItems.map((li: any, idx: number) => (
              <Stack key={`${li?.id ?? idx}`} direction="row" justifyContent="space-between">
                <Typography>
                  {li?.price?.product?.name ?? 'Merch item'} x{li?.quantity ?? 1}
                </Typography>
                <Typography color="text.secondary" sx={{ ml: 2 }}>
                  {li?.amount_total ? `${Number(li.amount_total) / 100}` : null}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>

        <Button variant="contained" component={Link} href="/merch">
          Back to Merch
        </Button>
      </Stack>
    </AppShell>
  );
}


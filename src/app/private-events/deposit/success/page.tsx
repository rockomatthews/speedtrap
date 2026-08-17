import Stripe from 'stripe';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

import { AppShell } from '@/components/AppShell';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';
import { stripeId } from '@/lib/stripe/membership-sync';

type PrivateEventDepositSuccessPageProps = {
  searchParams?: Promise<{ session_id?: string | string[] }>;
};

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function PrivateEventDepositSuccessPage({ searchParams }: PrivateEventDepositSuccessPageProps) {
  const params = searchParams ? await searchParams : {};
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  let status: 'ok' | 'missing' | 'error' = sessionId ? 'ok' : 'missing';
  let errorMessage = '';
  let depositAmount = '';
  let paidAmount = '';

  if (sessionId) {
    try {
      const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.source !== 'speedtrap_private_event_deposit') {
        throw new Error('This Stripe session is not a Speed Trap private event deposit.');
      }

      const quoteId = session.metadata.quote_id;
      if (!quoteId) throw new Error('Stripe session is missing quote metadata.');

      const supabaseAdmin = createSupabaseAdminClient();
      const { data: quote, error } = await supabaseAdmin
        .from('private_event_deposit_quotes')
        .select('id,deposit_amount_cents,currency,status')
        .eq('id', quoteId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!quote) throw new Error('Private event deposit quote was not found.');

      depositAmount = money(quote.deposit_amount_cents, quote.currency);
      paidAmount = session.amount_total ? money(session.amount_total, session.currency ?? quote.currency) : depositAmount;

      if (session.payment_status === 'paid' && quote.status !== 'deposit_paid') {
        const { error: updateError } = await supabaseAdmin
          .from('private_event_deposit_quotes')
          .update({
            status: 'deposit_paid',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: stripeId(session.payment_intent),
            deposit_paid_at: new Date().toISOString()
          })
          .eq('id', quote.id)
          .neq('status', 'cancelled');
        if (updateError) throw new Error(updateError.message);
      }
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : 'Failed to confirm private event deposit.';
      console.error('[private event deposit success] sync failed', error);
    }
  }

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>
            Private Event Deposit
          </Typography>
          <Typography color="text.secondary">Thanks for reserving your Speed Trap private event.</Typography>
        </Stack>

        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.65)' }}>
          <CardContent>
            <Stack spacing={2}>
              {status === 'ok' ? (
                <>
                  <Alert severity="success">Payment received{paidAmount ? `: ${paidAmount}` : ''}.</Alert>
                  <Typography variant="h3" sx={{ fontWeight: 950 }}>
                    Your private event deposit is paid.
                  </Typography>
                  <Typography color="text.secondary">
                    Speed Trap has your deposit on file
                    {depositAmount ? ` (${depositAmount} deposit before sales tax)` : ''}. Staff will follow up on any remaining details
                    and balance.
                  </Typography>
                </>
              ) : status === 'missing' ? (
                <Alert severity="warning">Missing Stripe checkout session. If you paid, Speed Trap can still verify your deposit in Stripe.</Alert>
              ) : (
                <Alert severity="warning">
                  Stripe returned you to the site, but the deposit status could not be confirmed automatically: {errorMessage}
                </Alert>
              )}
              <Button component={Link} href="/" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                Back to Speed Trap
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}

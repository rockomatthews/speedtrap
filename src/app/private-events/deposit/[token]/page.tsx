import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { PrivateEventDepositCheckoutButton } from '@/components/private-events/PrivateEventDepositCheckoutButton';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type PrivateEventDepositPageProps = {
  params: Promise<{ token: string }>;
};

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export default async function PrivateEventDepositPage({ params }: PrivateEventDepositPageProps) {
  const { token } = await params;
  const { data: quote, error } = await createSupabaseAdminClient()
    .from('private_event_deposit_quotes')
    .select(
      'public_token,customer_name,event_starts_at,event_duration_minutes,guest_count,sim_count,total_amount_cents,deposit_percent,deposit_amount_cents,currency,notes,status,deposit_paid_at'
    )
    .eq('public_token', token)
    .maybeSingle();

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>
            Private Event Deposit
          </Typography>
          <Typography color="text.secondary">Secure your Speed Trap private event with a 50% deposit.</Typography>
        </Stack>

        {error ? <Alert severity="error">{error.message}</Alert> : null}
        {!quote && !error ? <Alert severity="warning">This private event deposit link was not found.</Alert> : null}

        {quote ? (
          <Card
            variant="outlined"
            sx={{
              borderColor: 'rgba(255,210,0,0.65)',
              background:
                'linear-gradient(130deg, rgba(255,210,0,0.11), rgba(255,22,31,0.09) 48%, rgba(13,13,13,0.96))'
            }}
          >
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                  <Stack spacing={0.5}>
                    <Chip label="50% deposit" color="primary" sx={{ alignSelf: 'flex-start', fontWeight: 950 }} />
                    <Typography variant="h3" sx={{ fontWeight: 950, maxWidth: 780 }}>
                      {quote.customer_name}, your private event deposit is ready.
                    </Typography>
                    <Typography color="text.secondary">
                      This payment reserves the deposit against your full private-event quote.
                    </Typography>
                  </Stack>
                  <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                      Deposit due
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 950, color: 'primary.main' }}>
                      {money(quote.deposit_amount_cents, quote.currency)}
                    </Typography>
                  </Box>
                </Stack>

                <Grid container spacing={1.25}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Full quote
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{money(quote.total_amount_cents, quote.currency)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Event time
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{dateTime(quote.event_starts_at)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Party size
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{quote.guest_count ? `${quote.guest_count} guests` : 'To be confirmed'}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box sx={{ border: '1px solid rgba(255,255,255,0.14)', p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        Sims
                      </Typography>
                      <Typography sx={{ fontWeight: 950 }}>{quote.sim_count ? `${quote.sim_count} sims` : 'To be confirmed'}</Typography>
                    </Box>
                  </Grid>
                </Grid>

                {quote.notes ? <Typography color="text.secondary">{quote.notes}</Typography> : null}

                {quote.status === 'quote_sent' ? (
                  <PrivateEventDepositCheckoutButton token={quote.public_token} />
                ) : quote.status === 'deposit_paid' ? (
                  <Alert severity="success">Deposit received. Speed Trap has your private event deposit on file.</Alert>
                ) : (
                  <Alert severity="warning">This deposit link is {quote.status.replaceAll('_', ' ')} and cannot be paid.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </AppShell>
  );
}

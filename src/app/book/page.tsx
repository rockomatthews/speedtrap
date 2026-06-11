import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { BookingClient } from '@/app/book/ui/BookingClient';
import { AppShell } from '@/components/AppShell';

function parseInitialDuration(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const duration = Number(raw);
  return duration === 30 ? 30 : 15;
}

function validateStripePublishableKey(value: string) {
  const trimmed = value.trim();
  return /^pk_(test|live)_[A-Za-z0-9]/.test(trimmed) ? trimmed : '';
}

const BOOKING_COMING_SOON = true;

export default async function BookPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const rawPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const publishableKey = validateStripePublishableKey(rawPublishableKey);
  const initialDurationMinutes = parseInitialDuration(sp.duration ?? sp.minutes);

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.75}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Book a Race
          </Typography>
          <Typography color="text.secondary">
            Online booking is being tuned up and will be available soon.
          </Typography>
        </Stack>

        {!BOOKING_COMING_SOON && !publishableKey ? (
          <Alert severity="warning">
            Stripe embedded payments need `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel set to a real publishable key that starts with
            `pk_live_` or `pk_test_`.
          </Alert>
        ) : null}

        <Box sx={{ position: 'relative', minHeight: { xs: '62vh', md: '70vh' } }}>
          <Box
            aria-hidden={BOOKING_COMING_SOON ? 'true' : undefined}
            sx={{
              pointerEvents: BOOKING_COMING_SOON ? 'none' : 'auto',
              userSelect: BOOKING_COMING_SOON ? 'none' : 'auto',
              opacity: BOOKING_COMING_SOON ? 0.26 : 1,
              filter: BOOKING_COMING_SOON ? 'grayscale(0.35) blur(1px)' : 'none'
            }}
          >
            <BookingClient stripePublishableKey={publishableKey} initialDurationMinutes={initialDurationMinutes} />
          </Box>

          {BOOKING_COMING_SOON ? (
            <Box
              role="status"
              aria-live="polite"
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                display: 'grid',
                placeItems: 'center',
                minHeight: { xs: '62vh', md: '70vh' },
                border: '1px solid rgba(255, 210, 0, 0.45)',
                borderRadius: 3,
                background:
                  'linear-gradient(135deg, rgba(0,0,0,0.86), rgba(0,0,0,0.72)), repeating-linear-gradient(90deg, rgba(255,210,0,0.08) 0 1px, transparent 1px 18px)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6)'
              }}
            >
              <Stack spacing={1.25} alignItems="center" sx={{ px: 3, textAlign: 'center' }}>
                <Typography
                  component="p"
                  sx={{
                    color: 'primary.main',
                    fontSize: { xs: 14, md: 16 },
                    fontWeight: 950,
                    letterSpacing: 0,
                    textTransform: 'uppercase'
                  }}
                >
                  Online Booking
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '3rem', sm: '4.5rem', md: '6rem' },
                    fontWeight: 950,
                    lineHeight: 0.9,
                    textTransform: 'uppercase'
                  }}
                >
                  Coming Soon
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 560, fontSize: { xs: 18, md: 22 } }}>
                  The online race calendar is almost ready. Check back soon to reserve your sim time.
                </Typography>
              </Stack>
            </Box>
          ) : null}
        </Box>
      </Stack>
    </AppShell>
  );
}

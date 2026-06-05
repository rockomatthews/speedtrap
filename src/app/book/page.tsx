import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { BookingClient } from '@/app/book/ui/BookingClient';
import { AppShell } from '@/components/AppShell';

export default function BookPage() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.75}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Book a Race
          </Typography>
          <Typography color="text.secondary">
            Choose an available time, reserve up to four sims, and pay without leaving Speed Trap.
          </Typography>
        </Stack>

        {!publishableKey ? (
          <Alert severity="warning">Stripe embedded payments need `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel.</Alert>
        ) : null}

        <BookingClient stripePublishableKey={publishableKey} />
      </Stack>
    </AppShell>
  );
}

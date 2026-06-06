import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { BookingClient } from '@/app/book/ui/BookingClient';
import { AppShell } from '@/components/AppShell';

function parseInitialDuration(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const duration = Number(raw);
  return duration === 30 ? 30 : 15;
}

export default async function BookPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const initialDurationMinutes = parseInitialDuration(sp.duration ?? sp.minutes);

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

        <BookingClient stripePublishableKey={publishableKey} initialDurationMinutes={initialDurationMinutes} />
      </Stack>
    </AppShell>
  );
}

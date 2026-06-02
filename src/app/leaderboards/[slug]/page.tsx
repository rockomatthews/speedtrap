import Link from 'next/link';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { LeaderboardDetailClient } from '@/app/leaderboards/[slug]/ui/LeaderboardDetailClient';

export default async function LeaderboardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Leaderboard
            </Typography>
            <Typography color="text.secondary">Fastest eligible laps recorded in VMS.</Typography>
          </Stack>
          <Button component={Link} href="/leaderboards" variant="outlined">
            All leaderboards
          </Button>
        </Stack>
        <EnsureVmsCustomer />
        <LeaderboardDetailClient slug={slug} />
      </Stack>
    </AppShell>
  );
}

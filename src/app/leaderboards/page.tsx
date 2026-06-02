import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { ChallengeList } from '@/components/portal/ChallengeList';

export default async function LeaderboardsPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Leaderboards
          </Typography>
          <Typography color="text.secondary">Fastest-lap challenges recorded by the venue sims through VMS.</Typography>
        </Stack>
        <EnsureVmsCustomer />
        <ChallengeList />
      </Stack>
    </AppShell>
  );
}

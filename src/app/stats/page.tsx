import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { LapTimesClient } from '@/app/stats/ui/LapTimesClient';

export default function StatsPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          My Lap History
        </Typography>
        <EnsureVmsCustomer />
        <Typography color="text.secondary">
          Recent VMS laps and current Speed Trap leaderboard positions for your driver profile.
        </Typography>
        <LapTimesClient />
      </Stack>
    </AppShell>
  );
}


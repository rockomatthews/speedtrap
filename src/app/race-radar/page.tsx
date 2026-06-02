import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { RaceRadarClient } from '@/app/race-radar/ui/RaceRadarClient';

export default function RaceRadarPage() {
  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Race Radar
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            Challenge recaps, setup tips, race-night notes, and stories from the Speed Trap floor.
          </Typography>
        </Stack>
        <RaceRadarClient />
      </Stack>
    </AppShell>
  );
}

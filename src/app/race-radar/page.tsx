import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { RaceRadarClient } from '@/app/race-radar/ui/RaceRadarClient';

export default function RaceRadarPage() {
  return (
    <AppShell>
      <Stack spacing={{ xs: 4, md: 6 }}>
        <Stack spacing={1.5} sx={{ maxWidth: 880, pt: { xs: 1, md: 2 } }}>
          <Box sx={{ width: 68, height: 6, bgcolor: 'secondary.main' }} />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 52, sm: 72, md: 92 },
              fontWeight: 950,
              lineHeight: 0.88,
              textTransform: 'uppercase'
            }}
          >
            Race Radar
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720, fontSize: { xs: 18, md: 22 }, lineHeight: 1.5 }}>
            Fast laps, race-night stories, driver spotlights, and everything happening at Speed Trap.
          </Typography>
        </Stack>
        <RaceRadarClient />
      </Stack>
    </AppShell>
  );
}

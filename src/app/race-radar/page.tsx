import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function RaceRadarPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Race Radar
        </Typography>
        <Typography color="text.secondary">Content coming soon.</Typography>
      </Stack>
    </AppShell>
  );
}



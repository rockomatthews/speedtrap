import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function StatsPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Stats
        </Typography>
        <Typography color="text.secondary">Coming next: lap history + aggregates from the VMS API.</Typography>
      </Stack>
    </AppShell>
  );
}



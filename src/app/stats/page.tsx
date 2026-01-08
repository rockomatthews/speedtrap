import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { LapTimesClient } from '@/app/stats/ui/LapTimesClient';

export default function StatsPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Stats
        </Typography>
        <EnsureVmsCustomer />
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
          }}
        >
          <Box sx={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            GET `/api/vms/lap-times?index=0&count=100`
          </Box>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Next: we’ll render these lap-time results into best-lap + recent sessions views.
          </Typography>
        </Paper>

        <LapTimesClient />
      </Stack>
    </AppShell>
  );
}



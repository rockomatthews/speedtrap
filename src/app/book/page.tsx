import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function BookPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Book
        </Typography>
        <Typography color="text.secondary">Coming next: booking UI backed by the Sim Racing VMS API.</Typography>
      </Stack>
    </AppShell>
  );
}



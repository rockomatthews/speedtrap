import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function AdminPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Admin
        </Typography>
        <Typography color="text.secondary">Coming next: admin portal for customers and bookings.</Typography>
      </Stack>
    </AppShell>
  );
}



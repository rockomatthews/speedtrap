import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function ProfilePage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Profile
        </Typography>
        <Typography color="text.secondary">Coming next: editable profile + VMS customer link.</Typography>
      </Stack>
    </AppShell>
  );
}



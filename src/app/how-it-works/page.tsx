import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function HowItWorksPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          How It Works
        </Typography>
        <Typography color="text.secondary">Content coming soon.</Typography>
      </Stack>
    </AppShell>
  );
}



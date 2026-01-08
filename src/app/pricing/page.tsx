import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';

export default function PricingPage() {
  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Pricing
        </Typography>
        <Typography color="text.secondary">Content coming soon.</Typography>
      </Stack>
    </AppShell>
  );
}



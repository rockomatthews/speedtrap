import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

import { MerchClient } from './ui/MerchClient';
import { merchItems } from './merch-items';

export default function MerchPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Merch
          </Typography>
          <Typography color="text.secondary">Limited-run race gear. One-time purchases via Stripe.</Typography>
        </Stack>

        <MerchClient items={merchItems} />
      </Stack>
    </AppShell>
  );
}


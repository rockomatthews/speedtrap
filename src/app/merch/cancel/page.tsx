import Link from 'next/link';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

export default function MerchCancelPage() {
  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Purchase canceled
        </Typography>
        <Typography color="text.secondary">No charges were made.</Typography>
        <Button variant="contained" component={Link} href="/merch">
          Back to Merch
        </Button>
      </Stack>
    </AppShell>
  );
}


import Link from 'next/link';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

export default function PricingPage() {
  return (
    <AppShell>
      <Stack spacing={3} sx={{ minHeight: '55vh', justifyContent: 'center' }}>
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.35)' }}>
          <CardContent>
            <Stack spacing={2} sx={{ maxWidth: 760 }}>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>
                Pricing
              </Typography>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 950 }}>
                Coming Soon
              </Typography>
              <Typography color="text.secondary">
                Speed Trap Racing is finalizing session, pack, and group racing options. Check back soon for official venue pricing.
              </Typography>
              <Button component={Link} href="/login?redirectTo=/dashboard" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                Join a Hotlap
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}

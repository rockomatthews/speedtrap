import Link from 'next/link';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

export default async function MerchPage() {
  return (
    <AppShell>
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,210,0,0.35)', bgcolor: 'rgba(255,255,255,0.045)' }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={2} sx={{ maxWidth: 760 }}>
            <Typography variant="h3" sx={{ fontWeight: 950 }}>
              Merch Online Coming Soon!
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 18, md: 22 }, lineHeight: 1.45 }}>
              Want to rep the brand today? Grab your official gear in person at our location while you're hitting the track or hanging at
              the bar.
            </Typography>
            <Button component={Link} href="/" variant="contained" sx={{ alignSelf: 'flex-start' }}>
              Back Home
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </AppShell>
  );
}

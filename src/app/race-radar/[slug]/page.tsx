import Link from 'next/link';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { RaceRadarPostClient } from '@/app/race-radar/[slug]/ui/RaceRadarPostClient';

export default async function RaceRadarPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <AppShell>
      <Stack spacing={2}>
        <Button component={Link} href="/race-radar" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
          Race Radar
        </Button>
        <RaceRadarPostClient slug={slug} />
      </Stack>
    </AppShell>
  );
}

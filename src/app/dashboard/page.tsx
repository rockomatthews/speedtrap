import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Link from 'next/link';

import { AppShell } from '@/components/AppShell';
import { ChallengeList } from '@/components/portal/ChallengeList';
import { PaidSessionsList } from '@/components/portal/PaidSessionsList';
import { VmsDriverProfileCard } from '@/components/portal/VmsDriverProfileCard';
import { getAuthedProfile } from '@/lib/supabase/profile';

export default async function DashboardPage() {
  const { user } = await getAuthedProfile();

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Driver Portal
          </Typography>
          <Typography color="text.secondary">Signed in as {user?.email ?? 'unknown'}.</Typography>
        </Stack>

        <VmsDriverProfileCard />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Typography sx={{ fontWeight: 900 }}>1. Join a challenge</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Pick an active hotlap event. Your signup lives here; the actual laps are scored by VMS at the sims.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Typography sx={{ fontWeight: 900 }}>2. Race at the venue</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Run clean laps on the connected rigs. VMS connects your driver profile to the recorded lap data.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', borderColor: 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Typography sx={{ fontWeight: 900 }}>3. Track your place</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Watch the leaderboard update from VMS and look for your highlighted driver row.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button component={Link} href="/leaderboards" variant="contained">
            View Leaderboards
          </Button>
          <Button component={Link} href="/stats" variant="outlined">
            My Lap History
          </Button>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Paid Race Sessions
          </Typography>
          <PaidSessionsList />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Hotlap Challenges
          </Typography>
          <ChallengeList />
        </Stack>
      </Stack>
    </AppShell>
  );
}

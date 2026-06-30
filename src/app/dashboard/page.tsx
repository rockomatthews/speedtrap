import Stripe from 'stripe';

import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Link from 'next/link';

import { AppShell } from '@/components/AppShell';
import { ChallengeList } from '@/components/portal/ChallengeList';
import { DriverPortalHeader } from '@/components/portal/DriverPortalHeader';
import { MemberPassCard } from '@/components/portal/MemberPassCard';
import { PaidSessionsList } from '@/components/portal/PaidSessionsList';
import { RaceBookingsList } from '@/components/portal/RaceBookingsList';
import { VmsProfileForm } from '@/components/portal/VmsProfileForm';
import { membershipState } from '@/lib/membership';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { getStripeMembershipEnv } from '@/lib/stripe/env';
import { syncMembershipFromEmail } from '@/lib/stripe/membership-sync';

export default async function DashboardPage() {
  const { user, profile } = await getAuthedProfile();
  let currentProfile = profile;

  if (user?.email && !membershipState(currentProfile).active) {
    try {
      const stripeEnv = getStripeMembershipEnv();
      const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
      await syncMembershipFromEmail({
        supabaseAdmin: createSupabaseAdminClient(),
        stripe,
        email: user.email,
        profileId: user.id,
        membershipPriceId: stripeEnv.STRIPE_MEMBERSHIP_PRICE_ID
      });
      const refreshed = await getAuthedProfile();
      currentProfile = refreshed.profile ?? currentProfile;
    } catch (error) {
      console.error('[dashboard] membership email sync failed', error);
    }
  }

  return (
    <AppShell>
      <Stack spacing={3}>
        <DriverPortalHeader email={user?.email} />

        <MemberPassCard profile={currentProfile} email={user?.email} />

        <VmsProfileForm />

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
            Online Race Bookings
          </Typography>
          <RaceBookingsList />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Toast Walk-in Sessions
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

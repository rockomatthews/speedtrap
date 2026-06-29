import Stripe from 'stripe';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { MembershipSuccessPanel } from '@/components/membership/MembershipSuccessPanel';
import { membershipState } from '@/lib/membership';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { getStripeMembershipEnv } from '@/lib/stripe/env';
import { syncMembershipFromCheckoutSession, syncMembershipFromEmail } from '@/lib/stripe/membership-sync';

type MembershipSuccessPageProps = {
  searchParams?: Promise<{ session_id?: string | string[] }>;
};

export default async function MembershipSuccessPage({ searchParams }: MembershipSuccessPageProps) {
  const { user, profile } = await getAuthedProfile();
  if (!user) redirect('/login?redirectTo=/membership/success');

  const params = searchParams ? await searchParams : {};
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;
  let currentProfile = profile;

  if (sessionId) {
    try {
      const stripeEnv = getStripeMembershipEnv();
      const stripe = new Stripe(stripeEnv.STRIPE_SECRET_KEY);
      await syncMembershipFromCheckoutSession({
        supabaseAdmin: createSupabaseAdminClient(),
        stripe,
        sessionId,
        profileId: user.id
      });
      const refreshed = await getAuthedProfile();
      currentProfile = refreshed.profile ?? currentProfile;
    } catch (error) {
      console.error('[membership success] checkout sync failed', error);
    }
  }

  if (!membershipState(currentProfile).active && user.email) {
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
      console.error('[membership success] email sync failed', error);
    }
  }

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>
            Membership
          </Typography>
          <Typography color="text.secondary">Your Speed Trap membership status and perks.</Typography>
        </Stack>
        <MembershipSuccessPanel initialProfile={currentProfile} />
      </Stack>
    </AppShell>
  );
}

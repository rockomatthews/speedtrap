import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { MembershipSuccessPanel } from '@/components/membership/MembershipSuccessPanel';
import { getAuthedProfile } from '@/lib/supabase/profile';

export default async function MembershipSuccessPage() {
  const { user, profile } = await getAuthedProfile();
  if (!user) redirect('/login?redirectTo=/membership/success');

  return (
    <AppShell>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>
            Membership
          </Typography>
          <Typography color="text.secondary">Your Speed Trap membership status and perks.</Typography>
        </Stack>
        <MembershipSuccessPanel initialProfile={profile} />
      </Stack>
    </AppShell>
  );
}

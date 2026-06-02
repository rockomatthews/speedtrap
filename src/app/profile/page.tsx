import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';
import { UsernameCard } from '@/components/portal/UsernameCard';
import { getAuthedProfile } from '@/lib/supabase/profile';

export default async function ProfilePage() {
  const { user, profile } = await getAuthedProfile();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Profile
          </Typography>
          <Typography color="text.secondary">Manage your Speed Trap racing identity for {user?.email ?? 'your account'}.</Typography>
        </Stack>
        <UsernameCard initialUsername={profile?.username ?? null} />
      </Stack>
    </AppShell>
  );
}


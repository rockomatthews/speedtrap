import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';

import { AppShell } from '@/components/AppShell';
import { getAuthedProfile } from '@/lib/supabase/profile';

export default async function AdminPage() {
  const { user, profile } = await getAuthedProfile();

  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Admin
        </Typography>
        {profile?.role !== 'admin' ? (
          <Alert severity="warning">
            You are signed in as <b>{user?.email ?? 'unknown'}</b> but your role is not admin yet. Promote yourself in
            Supabase per <code>docs/supabase-setup.md</code>.
          </Alert>
        ) : (
          <Typography color="text.secondary">Admin portal coming next: customers + bookings management.</Typography>
        )}
      </Stack>
    </AppShell>
  );
}



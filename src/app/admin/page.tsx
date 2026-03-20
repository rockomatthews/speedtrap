import Link from 'next/link';

import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

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
          <Stack spacing={1}>
            <Alert severity="warning">
              You are signed in as <b>{user?.email ?? 'unknown'}</b> but your role is not admin yet. Promote yourself in
              Supabase per <code>docs/supabase-setup.md</code>.
            </Alert>
            <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
              user_id={user?.id ?? 'none'} role={profile?.role ?? 'none'}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography color="text.secondary">Admin portal controls for merch management are now available.</Typography>
            <Button component={Link} href="/admin/merch" variant="contained">
              Manage Merch
            </Button>
          </Stack>
        )}
      </Stack>
    </AppShell>
  );
}



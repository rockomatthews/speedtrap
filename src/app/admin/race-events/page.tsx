import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';
import { AdminRaceEventsClient } from '@/app/admin/race-events/ui/AdminRaceEventsClient';

export default async function AdminRaceEventsPage() {
  const { user, role, serviceRoleAvailable } = await getCurrentUserAndAdminRole();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Race Events
            </Typography>
            <Typography color="text.secondary">Create VMS hot-lapping challenges and site leaderboards.</Typography>
          </Stack>
          <Button component={Link} href="/admin" variant="outlined">
            Admin
          </Button>
        </Stack>

        {role !== 'admin' ? (
          <Alert severity="warning">
            You are signed in as <b>{user?.email ?? 'unknown'}</b>, but your role is not admin. service_role=
            {serviceRoleAvailable ? 'ok' : 'missing'}
          </Alert>
        ) : (
          <AdminRaceEventsClient />
        )}
      </Stack>
    </AppShell>
  );
}

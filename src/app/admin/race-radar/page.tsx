import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { AdminRaceRadarClient } from '@/app/admin/race-radar/ui/AdminRaceRadarClient';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

export default async function AdminRaceRadarPage() {
  const { user, role, serviceRoleAvailable } = await getCurrentUserAndAdminRole();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Race Radar
            </Typography>
            <Typography color="text.secondary">Create and publish Speed Trap blog posts.</Typography>
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
          <AdminRaceRadarClient />
        )}
      </Stack>
    </AppShell>
  );
}

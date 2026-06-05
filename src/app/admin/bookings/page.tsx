import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AdminBookingsClient } from '@/app/admin/bookings/ui/AdminBookingsClient';
import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

export default async function AdminBookingsPage() {
  const { role, user } = await getCurrentUserAndAdminRole();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Bookings
            </Typography>
            <Typography color="text.secondary">Manage public booking hours, blackouts, and online/Toast sessions.</Typography>
          </Stack>
          <Button component={Link} href="/admin" variant="outlined">
            Back to Admin
          </Button>
        </Stack>

        {role !== 'admin' ? (
          <Alert severity="warning">You are signed in as {user?.email ?? 'unknown'}, but your role is not admin.</Alert>
        ) : (
          <AdminBookingsClient />
        )}
      </Stack>
    </AppShell>
  );
}

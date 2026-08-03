import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

import { AdminPrivateEventsClient } from './ui/AdminPrivateEventsClient';

export default async function AdminPrivateEventsPage() {
  const { role, user } = await getCurrentUserAndAdminRole();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>
              Private Event Deposits
            </Typography>
            <Typography color="text.secondary">
              Create a custom quote, send the customer a 50% deposit link, and track payment status.
            </Typography>
          </Stack>
          <Button component={Link} href="/admin" variant="outlined">
            Back to Admin
          </Button>
        </Stack>

        {role !== 'admin' ? (
          <Alert severity="warning">You are signed in as {user?.email ?? 'unknown'}, but your role is not admin.</Alert>
        ) : (
          <AdminPrivateEventsClient />
        )}
      </Stack>
    </AppShell>
  );
}

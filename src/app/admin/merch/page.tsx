import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

import { AdminMerchClient } from './ui/AdminMerchClient';

export default async function AdminMerchPage() {
  const { role, serviceRoleAvailable } = await getCurrentUserAndAdminRole();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Admin Merch
        </Typography>

        {role !== 'admin' ? (
          <Alert severity="error">
            Admin role required. {serviceRoleAvailable ? '' : 'SUPABASE_SERVICE_ROLE_KEY is missing in this environment.'}
          </Alert>
        ) : (
          <AdminMerchClient />
        )}
      </Stack>
    </AppShell>
  );
}


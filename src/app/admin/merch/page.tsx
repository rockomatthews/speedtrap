import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { getAuthedProfile } from '@/lib/supabase/profile';

import { AdminMerchClient } from './ui/AdminMerchClient';

export default async function AdminMerchPage() {
  const { profile } = await getAuthedProfile();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Admin Merch
        </Typography>

        {profile?.role !== 'admin' ? (
          <Alert severity="error">Admin role required.</Alert>
        ) : (
          <AdminMerchClient />
        )}
      </Stack>
    </AppShell>
  );
}


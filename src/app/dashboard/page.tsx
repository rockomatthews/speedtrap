import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';

import { AppShell } from '@/components/AppShell';
import { EnsureVmsCustomer } from '@/components/EnsureVmsCustomer';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <AppShell>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Dashboard
        </Typography>
        <EnsureVmsCustomer />
        <Typography color="text.secondary">Signed in as {user?.email ?? 'unknown'}.</Typography>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>Next steps</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            - Your VMS customer mapping will be created automatically.
            <br />- Bookings: `/api/vms/bookings`
            <br />- Lap times: `/api/vms/lap-times`
          </Typography>
        </Paper>
      </Stack>
    </AppShell>
  );
}



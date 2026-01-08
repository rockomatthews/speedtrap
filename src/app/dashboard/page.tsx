import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { AppShell } from '@/components/AppShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <AppShell>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Dashboard
        </Typography>
        <Typography color="text.secondary">Signed in as {user?.email ?? 'unknown'}.</Typography>
      </Stack>
    </AppShell>
  );
}



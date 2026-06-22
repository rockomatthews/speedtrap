import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { AdminRaceRadarClient } from '@/app/admin/race-radar/ui/AdminRaceRadarClient';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';
import { env } from '@/lib/supabase/env';

export default async function AdminRaceRadarPage() {
  const { user, role, serviceRoleAvailable } = await getCurrentUserAndAdminRole();
  const contentfulConfigured = Boolean(
    env.CONTENTFUL_SPACE_ID && (env.CONTENTFUL_DELIVERY_TOKEN || env.CONTENTFUL_ACCESS_TOKEN)
  );

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Race Radar
            </Typography>
            <Typography color="text.secondary">
              {contentfulConfigured ? 'Race Radar is managed in Contentful.' : 'Create and publish fallback Speed Trap blog posts.'}
            </Typography>
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
        ) : contentfulConfigured ? (
          <Alert severity="info">
            Public Race Radar pages are now reading published posts from Contentful. Use Contentful to edit posts, images, and rich text.
          </Alert>
        ) : (
          <AdminRaceRadarClient />
        )}
      </Stack>
    </AppShell>
  );
}

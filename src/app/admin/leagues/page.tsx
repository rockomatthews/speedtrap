import { redirect } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';

import { AdminLeaguesClient } from './ui/AdminLeaguesClient';

export const dynamic = 'force-dynamic';

export default async function AdminLeaguesPage() {
  const { user, role } = await getCurrentUserAndAdminRole();
  if (!user) redirect('/login?redirectTo=/admin/leagues');
  if (role !== 'admin') redirect('/admin');

  return (
    <AppShell>
      <AdminLeaguesClient />
    </AppShell>
  );
}

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUserAndAdminRole() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null as 'admin' | 'customer' | null, serviceRoleAvailable: true };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: 'admin' | 'customer' }>();
    return { user, role: data?.role ?? null, serviceRoleAvailable: true };
  } catch {
    return { user, role: null as 'admin' | 'customer' | null, serviceRoleAvailable: false };
  }
}


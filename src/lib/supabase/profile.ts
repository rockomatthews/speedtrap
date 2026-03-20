import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type Profile = {
  id: string;
  role: 'customer' | 'admin';
  display_name: string | null;
  phone: string | null;
  vms_customer_id: number | null;
};

export async function getAuthedProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null } as const;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, phone, vms_customer_id')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (error) {
    return { supabase, user, profile: null } as const;
  }

  if (!profile) {
    // Self-heal missing profile rows for users created before the trigger existed.
    try {
      const admin = createSupabaseAdminClient();
      await admin.from('profiles').upsert({
        id: user.id,
        role: 'customer',
        display_name: user.user_metadata?.full_name ?? user.email ?? null
      });
    } catch {
      return { supabase, user, profile: null } as const;
    }

    const { data: repairedProfile } = await supabase
      .from('profiles')
      .select('id, role, display_name, phone, vms_customer_id')
      .eq('id', user.id)
      .maybeSingle<Profile>();

    return { supabase, user, profile: repairedProfile ?? null } as const;
  }

  return { supabase, user, profile } as const;
}



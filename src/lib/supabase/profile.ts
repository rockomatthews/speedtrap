import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    .single<Profile>();

  if (error) {
    // Profile row should be created by trigger, but handle edge cases.
    return { supabase, user, profile: null } as const;
  }

  return { supabase, user, profile } as const;
}



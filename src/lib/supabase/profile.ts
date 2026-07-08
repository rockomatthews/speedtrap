import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type Profile = {
  id: string;
  role: 'customer' | 'admin';
  username: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  vms_customer_id: number | null;
  membership_status: 'inactive' | 'active-start' | 'active';
  birthday: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  membership_current_period_start: string | null;
  membership_current_period_end: string | null;
  membership_free_race_month: string | null;
  membership_free_race_redeemed_at: string | null;
  membership_monthly_15_race_month: string | null;
  membership_monthly_15_race_redeemed_at: string | null;
  membership_birthday_30_race_year: number | null;
  membership_birthday_30_race_redeemed_at: string | null;
};

const PROFILE_SELECT =
  'id, role, username, display_name, phone, avatar_url, vms_customer_id, membership_status, birthday, stripe_customer_id, stripe_subscription_id, membership_current_period_start, membership_current_period_end, membership_free_race_month, membership_free_race_redeemed_at, membership_monthly_15_race_month, membership_monthly_15_race_redeemed_at, membership_birthday_30_race_year, membership_birthday_30_race_redeemed_at';
const LEGACY_PROFILE_SELECT = 'id, role, display_name, phone, vms_customer_id';

function withDefaults(
  profile: Partial<Profile> & Pick<Profile, 'id' | 'role' | 'display_name' | 'phone' | 'vms_customer_id'>
): Profile {
  return {
    ...profile,
    username: profile.username ?? null,
    avatar_url: profile.avatar_url ?? null,
    membership_status: profile.membership_status ?? 'inactive',
    birthday: profile.birthday ?? null,
    stripe_customer_id: profile.stripe_customer_id ?? null,
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
    membership_current_period_start: profile.membership_current_period_start ?? null,
    membership_current_period_end: profile.membership_current_period_end ?? null,
    membership_free_race_month: profile.membership_free_race_month ?? null,
    membership_free_race_redeemed_at: profile.membership_free_race_redeemed_at ?? null,
    membership_monthly_15_race_month: profile.membership_monthly_15_race_month ?? null,
    membership_monthly_15_race_redeemed_at: profile.membership_monthly_15_race_redeemed_at ?? null,
    membership_birthday_30_race_year: profile.membership_birthday_30_race_year ?? null,
    membership_birthday_30_race_redeemed_at: profile.membership_birthday_30_race_redeemed_at ?? null
  };
}

export async function getAuthedProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null } as const;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (error) {
    const { data: legacyProfile } = await supabase
      .from('profiles')
      .select(LEGACY_PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle<Omit<Profile, 'username' | 'avatar_url'>>();
    if (legacyProfile) return { supabase, user, profile: withDefaults(legacyProfile) } as const;

    try {
      const admin = createSupabaseAdminClient();
      const { data: adminProfile } = await admin
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .maybeSingle<Profile>();
      return { supabase, user, profile: adminProfile ?? null } as const;
    } catch {
      return { supabase, user, profile: null } as const;
    }
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
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle<Profile>();
    if (repairedProfile) {
      return { supabase, user, profile: repairedProfile } as const;
    }

    // Final fallback: bypass RLS for this exact user profile lookup.
    try {
      const admin = createSupabaseAdminClient();
      const { data: adminProfile } = await admin
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .maybeSingle<Profile>();
      return { supabase, user, profile: adminProfile ?? null } as const;
    } catch {
      return { supabase, user, profile: null } as const;
    }
  }

  return { supabase, user, profile } as const;
}

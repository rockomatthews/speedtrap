import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/supabase/env';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options });
      }
    }
  });
}



import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/supabase/env';

type CookieOptions = {
  domain?: string;
  expires?: number | Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
};

/**
 * For Route Handlers (`app/**/route.ts`) where we need to write auth cookies.
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      }
    }
  });
}



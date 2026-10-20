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

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  function writeCookie(name: string, value: string, options: CookieOptions) {
    try {
      cookieStore.set({ name, value, ...options });
    } catch (error) {
      // Server Components cannot write cookies; middleware persists refreshed sessions.
      if (!(error instanceof Error) || !error.message.includes('Cookies can only be modified')) throw error;
    }
  }

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        writeCookie(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        writeCookie(name, '', options);
      }
    }
  });
}



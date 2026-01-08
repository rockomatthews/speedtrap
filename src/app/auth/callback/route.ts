import { NextResponse } from 'next/server';

import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const redirectTo = url.searchParams.get('redirectTo') ?? '/dashboard';

  if (code) {
    const supabase = await createRouteHandlerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const next = new URL(redirectTo, url.origin);
  return NextResponse.redirect(next);
}



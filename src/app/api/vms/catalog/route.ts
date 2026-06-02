import { NextResponse } from 'next/server';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

export async function GET() {
  const { user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalog = await VmsClient.fromEnv().getCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

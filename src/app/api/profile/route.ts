import { NextResponse } from 'next/server';
import { getAuthedProfile } from '@/lib/supabase/profile';

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const { user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await request.json().catch(() => null);
  return NextResponse.json({ error: 'Use /api/vms/customer-profile to edit VMS-owned driver profile fields.' }, { status: 410 });
}

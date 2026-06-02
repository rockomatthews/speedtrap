import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthedProfile } from '@/lib/supabase/profile';

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{2,19}$/, 'Use 3-20 letters, numbers, underscores, or dashes.');

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const { supabase, user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { username?: string } | null;
  const parsed = usernameSchema.safeParse(body?.username);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid username.' }, { status: 400 });
  }

  const username = parsed.data;
  const { data, error } = await supabase
    .from('profiles')
    .update({ username, display_name: profile?.display_name ?? username })
    .eq('id', user.id)
    .select('id, role, username, display_name, phone, vms_customer_id')
    .single();

  if (error) {
    const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate');
    return NextResponse.json(
      { error: duplicate ? 'That racing username is already taken.' : `Failed to save username: ${error.message}` },
      { status: duplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: data });
}

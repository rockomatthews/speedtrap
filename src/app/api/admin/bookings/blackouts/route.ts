import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const blackoutSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  reason: z.string().trim().max(200).optional()
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const raw = await request.json().catch(() => null);
  const parsed = blackoutSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid blackout.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('venue_blackouts')
    .insert({
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      reason: parsed.data.reason ?? null,
      created_by: admin.user.id
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blackout: data });
}

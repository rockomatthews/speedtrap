import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { racingDiscountSchema } from '@/lib/bookings/discount';
import { getRacingDiscount } from '@/lib/bookings/discount-server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  try {
    return NextResponse.json({ discount: await getRacingDiscount() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load racing discount settings.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const parsed = racingDiscountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid discount.' }, { status: 400 });
  try {
    const { data, error } = await createSupabaseAdminClient().from('racing_discount_settings')
      .update({ ...parsed.data, updated_by: admin.user.id, updated_at: new Date().toISOString() })
      .eq('id', 1).select('enabled,percent').single();
    if (error || !data) throw new Error('Save failed');
    return NextResponse.json({ discount: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Discount was not saved. Please try again.' }, { status: 503 });
  }
}

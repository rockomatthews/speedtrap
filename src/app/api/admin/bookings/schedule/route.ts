import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6),
  opens_at: z.string().regex(/^\d{2}:\d{2}/),
  closes_at: z.string().regex(/^\d{2}:\d{2}/),
  active: z.boolean(),
  max_sims: z.coerce.number().int().min(1).max(4).default(4)
});

const scheduleSchema = z.object({
  rules: z.array(ruleSchema).min(1)
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createSupabaseAdminClient();
  const [rules, blackouts, resources] = await Promise.all([
    supabase.from('venue_schedule_rules').select('*').order('day_of_week').order('opens_at'),
    supabase.from('venue_blackouts').select('*').order('starts_at', { ascending: false }).limit(100),
    supabase.from('booking_resources').select('*').order('display_order')
  ]);
  if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 500 });
  if (blackouts.error) return NextResponse.json({ error: blackouts.error.message }, { status: 500 });
  if (resources.error) return NextResponse.json({ error: resources.error.message }, { status: 500 });
  return NextResponse.json({ rules: rules.data ?? [], blackouts: blackouts.data ?? [], resources: resources.data ?? [] });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const raw = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid schedule.' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const rows = parsed.data.rules.map((rule) => ({
    id: rule.id,
    day_of_week: rule.day_of_week,
    opens_at: rule.opens_at.slice(0, 5),
    closes_at: rule.closes_at.slice(0, 5),
    active: rule.active,
    max_sims: rule.max_sims
  }));

  const { data: existingRules, error: existingError } = await supabase
    .from('venue_schedule_rules')
    .select('id, day_of_week')
    .order('day_of_week')
    .order('opens_at');
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  for (const row of rows) {
    const { id, ...payload } = row;
    const targetId = id ?? existingRules?.find((rule) => rule.day_of_week === row.day_of_week)?.id;
    const result = targetId
      ? await supabase.from('venue_schedule_rules').update(payload).eq('id', targetId)
      : await supabase.from('venue_schedule_rules').insert(payload);

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const { data, error } = await supabase.from('venue_schedule_rules').select('*').order('day_of_week').order('opens_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

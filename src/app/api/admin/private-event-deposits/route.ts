import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const createQuoteSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required.'),
  customerEmail: z.string().trim().email('A valid email is required.'),
  customerPhone: z.string().trim().optional(),
  eventStartsAt: z.string().trim().optional(),
  eventDurationMinutes: z.coerce.number().int().positive().optional(),
  guestCount: z.coerce.number().int().positive().optional(),
  simCount: z.coerce.number().int().min(1).max(4).optional(),
  totalAmount: z.coerce.number().positive('Total event price is required.'),
  notes: z.string().trim().optional()
});

const patchQuoteSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['quote_sent', 'cancelled'])
});

function quoteSelect() {
  return [
    'id',
    'public_token',
    'customer_name',
    'customer_email',
    'customer_phone',
    'event_starts_at',
    'event_duration_minutes',
    'guest_count',
    'sim_count',
    'total_amount_cents',
    'deposit_percent',
    'deposit_amount_cents',
    'currency',
    'notes',
    'status',
    'stripe_checkout_session_id',
    'stripe_payment_intent_id',
    'stripe_charge_id',
    'deposit_paid_at',
    'created_at',
    'updated_at'
  ].join(',');
}

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { data, error } = await createSupabaseAdminClient()
    .from('private_event_deposit_quotes')
    .select(quoteSelect())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotes: data ?? [] });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid quote.' }, { status: 400 });
  }

  const input = parsed.data;
  const totalAmountCents = Math.round(input.totalAmount * 100);
  const depositAmountCents = Math.round(totalAmountCents * 0.5);

  const { data, error } = await createSupabaseAdminClient()
    .from('private_event_deposit_quotes')
    .insert({
      customer_name: input.customerName,
      customer_email: input.customerEmail.toLowerCase(),
      customer_phone: input.customerPhone || null,
      event_starts_at: input.eventStartsAt || null,
      event_duration_minutes: input.eventDurationMinutes ?? null,
      guest_count: input.guestCount ?? null,
      sim_count: input.simCount ?? null,
      total_amount_cents: totalAmountCents,
      deposit_percent: 50,
      deposit_amount_cents: depositAmountCents,
      currency: 'usd',
      notes: input.notes || null,
      created_by: adminCheck.user.id
    })
    .select(quoteSelect())
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = patchQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid quote update.' }, { status: 400 });
  }

  const { data, error } = await createSupabaseAdminClient()
    .from('private_event_deposit_quotes')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .neq('status', 'deposit_paid')
    .select(quoteSelect())
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}

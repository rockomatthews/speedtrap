import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const paymentSchema = z.object({
  receiptReference: z.string().trim().min(1, 'Enter the Toast receipt or check number.').max(120),
  expectedBalanceCents: z.number().int().positive(),
  paymentCollected: z.literal(true)
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: 'Confirm payment was collected and enter a Toast receipt or check number.' }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from('private_event_deposit_quotes')
    .select('id,status,total_amount_cents,deposit_amount_cents,balance_paid_at').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quote) return NextResponse.json({ error: 'Event quote not found.' }, { status: 404 });
  if (quote.status !== 'deposit_paid') {
    return NextResponse.json({ error: 'Only an active event with a paid deposit can have its balance recorded.' }, { status: 409 });
  }
  // Retries must not overwrite the original receipt, recorder or timestamp.
  if (quote.balance_paid_at) return NextResponse.json({ recorded: true });
  const balance = quote.total_amount_cents - quote.deposit_amount_cents;
  if (balance <= 0 || balance !== parsed.data.expectedBalanceCents) {
    return NextResponse.json({ error: 'The balance changed. Refresh the event before recording payment.' }, { status: 409 });
  }
  const { data: updated, error: updateError } = await supabase.from('private_event_deposit_quotes')
    .update({
      balance_paid_at: new Date().toISOString(),
      balance_paid_by: admin.user.id,
      balance_paid_amount_cents: balance,
      toast_receipt_reference: parsed.data.receiptReference
    })
    .eq('id', id).eq('status', 'deposit_paid').is('balance_paid_at', null)
    .eq('total_amount_cents', quote.total_amount_cents).eq('deposit_amount_cents', quote.deposit_amount_cents)
    .select('id').maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'This event changed or payment was already recorded. Refresh to see its current status.' }, { status: 409 });
  return NextResponse.json({ recorded: true });
}

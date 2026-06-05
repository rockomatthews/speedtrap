import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { canAutoCancel } from '@/lib/bookings/confirm';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { getStripeEnv } from '@/lib/stripe/env';
import { VmsClient } from '@/lib/vms/client';

const cancelSchema = z.object({
  email: z.string().email().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await request.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid cancellation request.' }, { status: 400 });

  try {
    const { user, profile } = await getAuthedProfile().catch(() => ({ user: null, profile: null }));
    const supabase = createSupabaseAdminClient();
    const { data: booking, error } = await supabase.from('race_bookings').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    const requesterEmail = parsed.data.email?.toLowerCase() ?? user?.email?.toLowerCase() ?? '';
    const allowed =
      profile?.role === 'admin' ||
      booking.profile_id === user?.id ||
      (requesterEmail.length > 0 && requesterEmail === String(booking.customer_email).toLowerCase());
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['confirmed', 'payment_succeeded_vms_failed'].includes(booking.status)) {
      return NextResponse.json({ error: `Booking cannot be cancelled from status ${booking.status}.` }, { status: 409 });
    }
    if (!canAutoCancel(booking.starts_at)) {
      return NextResponse.json({ error: 'Online cancellation is closed for this booking. Contact staff.' }, { status: 409 });
    }

    let refundId: string | null = null;
    if (booking.stripe_payment_intent_id && booking.amount_cents > 0) {
      const stripe = new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        metadata: { race_booking_id: booking.id }
      });
      refundId = refund.id;
    }

    let vmsError: string | null = null;
    if (booking.vms_booking_id) {
      try {
        await VmsClient.fromEnv().updateBooking(Number(booking.vms_booking_id), { status: 'Cancelled' });
      } catch (error) {
        vmsError = error instanceof Error ? error.message : 'Failed to cancel VMS booking.';
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('race_bookings')
      .update({
        status: refundId ? 'refunded' : 'cancelled',
        stripe_refund_id: refundId,
        error: vmsError
      })
      .eq('id', booking.id)
      .select('*')
      .single();
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to cancel booking.' }, { status: 500 });
  }
}

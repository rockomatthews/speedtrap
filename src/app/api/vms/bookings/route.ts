import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/supabase/env';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const bool01Schema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === '0' || value.toLowerCase() === 'false') return 0;
    if (value === '1' || value.toLowerCase() === 'true') return 1;
    return undefined;
  });

const bookingStatusSchema = z.enum(['Booked', 'Holding', 'Cancelled']);

const bookingSchema = z.object({
  event_name: z.string().trim().min(1).max(180).optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  start_date: z.string().trim().min(8),
  end_date: z.string().trim().min(8),
  status: bookingStatusSchema.default('Booked'),
  venue_id: z.coerce.number().int().positive().optional(),
  event_activity: z.string().trim().max(80).optional(),
  group_size: z.coerce.number().int().min(1).max(200).optional(),
  number_of_pods: z.coerce.number().int().min(1).max(100).optional(),
  specific_pods: z.string().trim().max(240).optional(),
  requested_vehicle_ids: z.array(z.coerce.number().int().positive()).optional(),
  requested_circuit_ids: z.array(z.coerce.number().int().positive()).optional(),
  participant_ids: z.array(z.coerce.number().int().positive()).optional(),
  staffing_notes: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(3000).optional(),
  payment_notes: z.string().trim().max(2000).optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const past = bool01Schema.parse(url.searchParams.get('past') ?? undefined) ?? 1;
  const future = bool01Schema.parse(url.searchParams.get('future') ?? undefined) ?? 1;

  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  try {
    const vms = VmsClient.fromEnv();
    const bookings = await vms.listBookings({ past, future });
    const mine = bookings.filter((booking) => {
      const ownerMatch = booking.customerId === profile.vms_customer_id;
      const participantMatch = booking.participantIds?.includes(profile.vms_customer_id ?? -1);
      return ownerMatch || participantMatch;
    });

    return NextResponse.json({ past, future, results: mine, total: mine.length });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'Missing vms_customer_id. Call POST /api/vms/customers/ensure first.' }, { status: 412 });
  }

  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid VMS booking.' }, { status: 400 });
  }

  const body = parsed.data;
  const ownerId = profile.role === 'admin' && body.customer_id ? body.customer_id : profile.vms_customer_id;
  const groupSize = body.group_size ?? body.number_of_pods ?? body.participant_ids?.length ?? 1;
  const numberOfPods = body.number_of_pods ?? Math.max(1, Math.min(4, groupSize));
  const participantIds = body.participant_ids?.length ? body.participant_ids : [ownerId];

  try {
    const vms = VmsClient.fromEnv();
    const booking = await vms.createBooking({
      eventName: body.event_name ?? 'Speed Trap Race',
      customerId: ownerId,
      startDate: body.start_date,
      endDate: body.end_date,
      status: body.status,
      venueId: body.venue_id ?? env.VMS_HOME_VENUE_ID ?? 1,
      eventActivity: body.event_activity ?? env.VMS_BOOKING_EVENT_ACTIVITY ?? null,
      groupSize,
      numberOfPods,
      specificPods: body.specific_pods,
      requestedVehicleIds: body.requested_vehicle_ids,
      requestedCircuitIds: body.requested_circuit_ids,
      participantIds,
      staffingNotes: body.staffing_notes,
      notes: body.notes,
      paymentNotes: body.payment_notes
    });

    if (!booking?.id) return NextResponse.json({ error: 'VMS did not return a booking id.' }, { status: 502 });
    return NextResponse.json({ booking });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/supabase/env';
import { fetchToastOrder, hasToastApiCredentials } from '@/lib/toast/client';
import {
  extractGuest,
  isPaidOrder,
  isToastOrderEvent,
  localVenueDateTime,
  matchRacingSession,
  sessionStartSource,
  toastConfig,
  type ToastOrder,
  type ToastWebhookPayload,
  verifyToastSignature
} from '@/lib/toast/webhook';
import { VmsClient } from '@/lib/vms/client';

export const runtime = 'nodejs';

type ToastSessionOrderRow = {
  id: string;
  status: string;
  vms_booking_id: number | null;
};

function response(status: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ status, ...extra });
}

function orderTimestamp(order: ToastOrder, payload: ToastWebhookPayload) {
  return sessionStartSource(payload, order);
}

async function upsertProfileIdForVmsCustomer(vmsCustomerId: number) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('profiles').select('id').eq('vms_customer_id', vmsCustomerId).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const config = toastConfig();

  if (!config.webhookSecret) {
    return NextResponse.json({ error: 'Toast webhook is not configured. Set TOAST_WEBHOOK_SECRET in Vercel.' }, { status: 503 });
  }

  let payload: ToastWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ToastWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid Toast webhook JSON.' }, { status: 400 });
  }

  const signature = request.headers.get('Toast-Signature') ?? request.headers.get('toast-signature');
  if (!signature || !payload.timestamp) {
    return NextResponse.json({ error: 'Missing Toast signature or timestamp.' }, { status: 401 });
  }

  if (!verifyToastSignature(rawBody, payload.timestamp, signature, config.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid Toast signature.' }, { status: 401 });
  }

  const eventGuid = payload.guid;
  const order = payload.details?.order;
  const orderGuid = order?.guid;
  const restaurantGuid = payload.details?.restaurantGuid ?? request.headers.get('Toast-Restaurant-External-ID') ?? null;

  if (!eventGuid || !orderGuid || !order) {
    return NextResponse.json({ error: 'Toast order webhook is missing event or order identifiers.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from('toast_session_orders')
    .select('id,status,vms_booking_id')
    .eq('toast_order_guid', orderGuid)
    .maybeSingle<ToastSessionOrderRow>();

  if (existing?.status === 'booked') {
    return response('duplicate', { vmsBookingId: existing.vms_booking_id });
  }

  const baseRow = {
    toast_event_guid: eventGuid,
    toast_order_guid: orderGuid,
    toast_restaurant_guid: restaurantGuid,
    toast_event_type: payload.eventType,
    status: 'processing',
    ignored_reason: null,
    error: null,
    raw_event: payload as any
  };

  const rowResult = existing
    ? await supabase.from('toast_session_orders').update(baseRow).eq('id', existing.id).select('id').single<{ id: string }>()
    : await supabase.from('toast_session_orders').insert(baseRow).select('id').single<{ id: string }>();

  if (rowResult.error || !rowResult.data) {
    return NextResponse.json({ error: rowResult.error?.message ?? 'Failed to record Toast webhook.' }, { status: 500 });
  }

  const rowId = rowResult.data.id;

  async function mark(status: 'ignored' | 'failed' | 'booked', values: Record<string, unknown>) {
    await supabase
      .from('toast_session_orders')
      .update({
        status,
        processed_at: new Date().toISOString(),
        ...values
      })
      .eq('id', rowId);
  }

  try {
    if (!isToastOrderEvent(payload)) {
      await mark('ignored', { ignored_reason: `Unsupported Toast event type: ${payload.eventType ?? 'unknown'}` });
      return response('ignored');
    }

    if (config.restaurantGuid && restaurantGuid && restaurantGuid.toLowerCase() !== config.restaurantGuid.toLowerCase()) {
      await mark('ignored', { ignored_reason: 'Toast restaurant GUID does not match this site configuration.' });
      return response('ignored');
    }

    let workingOrder = order;
    let sessionMatch = matchRacingSession(workingOrder);

    if ((!sessionMatch.matched || !isPaidOrder(workingOrder) || !extractGuest(workingOrder).email) && hasToastApiCredentials()) {
      const hydratedOrder = await fetchToastOrder(orderGuid);
      if (hydratedOrder) {
        workingOrder = hydratedOrder;
        sessionMatch = matchRacingSession(workingOrder);
      }
    }

    if (!sessionMatch.matched) {
      await mark('ignored', { ignored_reason: sessionMatch.reason ?? 'Toast order is not a racing-session order.' });
      return response('ignored');
    }

    if (!isPaidOrder(workingOrder)) {
      await mark('ignored', { ignored_reason: 'Toast racing-session order is not paid yet.' });
      return response('ignored');
    }

    const guest = extractGuest(workingOrder);
    if (!guest.email || !guest.name) {
      await mark('failed', {
        error:
          'Toast racing-session order is paid, but guest name/email was not available. Enable Toast Orders API credentials or require guest contact info for this item.'
      });
      return response('failed');
    }

    const vms = VmsClient.fromEnv();
    const venueId = env.VMS_HOME_VENUE_ID ?? 1;
    const existingCustomer = await vms.findCustomerByEmail(guest.email);
    const customer =
      existingCustomer ??
      (await vms.createCustomer({
        name: guest.name,
        email: guest.email,
        homeVenueId: venueId,
        emailOptin: false,
        source: 'Google/Web',
        sourceOther: 'Toast paid sim session',
        ifDuplicateEmailMakeSecondary: false
      }));

    if (!customer?.id) throw new Error('VMS did not return a customer for the Toast order.');

    const quantity = Math.max(1, sessionMatch.quantity);
    const sessionMinutes = config.sessionMinutes;
    const startAt = orderTimestamp(workingOrder, payload);
    const startDate = localVenueDateTime(startAt);
    const endDate = localVenueDateTime(startAt, sessionMinutes * quantity);
    const profileId = await upsertProfileIdForVmsCustomer(customer.id);

    const booking = await vms.createBooking({
      eventName: `Toast Sim Session - ${customer.name}`,
      customerId: customer.id,
      startDate,
      endDate,
      status: 'Booked',
      venueId,
      eventActivity: 'Hotlapping',
      groupSize: quantity,
      numberOfPods: config.sessionPods,
      participantIds: [customer.id],
      notes: 'Created automatically from a paid Toast racing-session order.',
      paymentNotes: [
        `Toast order: ${orderGuid}`,
        `Toast event: ${eventGuid}`,
        sessionMatch.checkGuid ? `Toast check: ${sessionMatch.checkGuid}` : null,
        sessionMatch.paymentGuid ? `Toast payment: ${sessionMatch.paymentGuid}` : null
      ]
        .filter(Boolean)
        .join('\n')
    });

    if (!booking?.id) throw new Error('VMS did not return a booking for the Toast order.');

    await mark('booked', {
      toast_check_guid: sessionMatch.checkGuid,
      toast_payment_guid: sessionMatch.paymentGuid,
      profile_id: profileId,
      vms_customer_id: customer.id,
      vms_booking_id: booking.id,
      customer_name: customer.name,
      customer_email: customer.email ?? guest.email,
      session_quantity: quantity,
      session_minutes: sessionMinutes
    });

    return response('booked', { vmsBookingId: booking.id, vmsCustomerId: customer.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Toast/VMS processing error.';
    await mark('failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

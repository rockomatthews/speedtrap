import Stripe from 'stripe';

import { allocateBookingResources, assertSlotAvailable } from '@/lib/bookings/availability';
import { BOOKING_CANCELLATION_CUTOFF_HOURS, bookingPackageLabel, normalizeSimCount } from '@/lib/bookings/config';
import { raceRequestDbFields, raceRequestVmsFields } from '@/lib/bookings/race-request';
import { utcToVenueDate, utcToVenueDateTime } from '@/lib/bookings/time';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';

function normalizeVmsName(name: string) {
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

async function redeemMembershipCreditIfNeeded(supabase: any, hold: any) {
  if (!hold.profile_id || !hold.membership_free_race_applied) return;
  const redeemedAt = new Date().toISOString();
  const creditType = hold.membership_credit_type ?? 'monthly_15';
  const update =
    creditType === 'birthday_30'
      ? {
          membership_birthday_30_race_year: hold.membership_credit_year,
          membership_birthday_30_race_redeemed_at: redeemedAt
        }
      : {
          membership_status: 'active',
          membership_free_race_month: hold.membership_free_race_month,
          membership_free_race_redeemed_at: redeemedAt,
          membership_monthly_15_race_month: hold.membership_credit_month ?? hold.membership_free_race_month,
          membership_monthly_15_race_redeemed_at: redeemedAt
        };

  await supabase.from('profiles').update(update).eq('id', hold.profile_id);
}

function raceRequestFromHold(hold: any) {
  return raceRequestDbFields({
    raceRequestType: hold.race_request_type ?? 'none',
    requestedVehicleId: hold.requested_vehicle_id ?? null,
    requestedVehicleName: hold.requested_vehicle_name ?? null,
    requestedCircuitId: hold.requested_circuit_id ?? null,
    requestedCircuitName: hold.requested_circuit_name ?? null,
    requestedHotlapEventId: hold.requested_hotlap_event_id ?? null,
    requestedHotlapEventName: hold.requested_hotlap_event_name ?? null
  });
}

function bookingNotes(base: string, booking: any) {
  const request = raceRequestVmsFields(booking);
  return [base, rotationBookingLine(booking), request.noteLine].filter(Boolean).join('\n');
}

function formatMoneyFromBooking(booking: any) {
  const currency = String(booking.currency ?? 'usd').toUpperCase();
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((booking.amount_cents ?? 0) / 100);
}

function vmsEventName(booking: any) {
  const simCount = bookingSimCount(booking);
  const packageLabel = bookingPackageLabel(booking.duration_minutes, simCount);
  const bookingType = simCount > 1 ? 'Party' : 'Race';
  return `Speed Trap ${bookingType} - ${packageLabel} - ${normalizeVmsName(booking.customer_name)}`;
}

function bookingSimCount(booking: any) {
  return normalizeSimCount(Number(booking.sim_count ?? 1));
}

function bookingPartySize(booking: any) {
  const simCount = bookingSimCount(booking);
  const raw = Number(booking.party_size ?? simCount);
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : simCount;
}

function driverPodLine(booking: any) {
  const partySize = bookingPartySize(booking);
  const simCount = bookingSimCount(booking);
  return `${partySize} drivers / ${simCount} pods`;
}

function rotationBookingLine(booking: any) {
  const partySize = bookingPartySize(booking);
  const simCount = bookingSimCount(booking);
  return partySize > simCount ? `Rotation booking: ${partySize} drivers / ${simCount} pods.` : null;
}

function bookingStaffingNotes(booking: any) {
  const request = raceRequestVmsFields(booking);
  return [rotationBookingLine(booking), request.noteLine].filter(Boolean).join('\n') || undefined;
}

function bookingPaymentNotes(booking: any, lines: Array<string | null | undefined>) {
  return [
    `Package: ${bookingPackageLabel(booking.duration_minutes, bookingSimCount(booking))}`,
    `Drivers/pods: ${driverPodLine(booking)}`,
    `Total charged: ${formatMoneyFromBooking(booking)}`,
    ...lines
  ]
    .filter(Boolean)
    .join('\n');
}

function paymentMethodFromStripeIntent(paymentIntent: Stripe.PaymentIntent) {
  return paymentIntent.metadata?.payment_method_requested === 'crypto' ? 'crypto' : 'card';
}

function paymentMethodNote(paymentMethod: string | null | undefined) {
  if (paymentMethod === 'crypto') return 'Stripe payment method: Crypto stablecoin.';
  if (paymentMethod === 'card') return 'Stripe payment method: Card.';
  if (paymentMethod === 'membership_credit') return 'Stripe payment method: Membership credit.';
  return null;
}

function membershipCreditPaymentNote(booking: any) {
  if (!booking.membership_free_race_applied) return null;
  if (booking.membership_credit_type === 'birthday_30') return 'Birthday membership 30-minute race credit.';
  return 'Monthly membership 15-minute race credit.';
}

async function assertHoldStillFits(supabase: any, hold: any) {
  await assertSlotAvailable(supabase, {
    date: utcToVenueDate(new Date(hold.starts_at)),
    startsAt: hold.starts_at,
    durationMinutes: hold.duration_minutes,
    partySize: hold.party_size ?? hold.sim_count,
    excludeHoldId: hold.id
  });
}

async function refundStalePaidHold(input: { supabase: any; stripe: Stripe; paymentIntent: Stripe.PaymentIntent; hold: any; charge: Stripe.Charge | null }) {
  await input.supabase.from('race_booking_holds').update({ status: 'cancelled' }).eq('id', input.hold.id);
  if (!input.charge?.refunded) {
    await input.stripe.refunds.create({
      payment_intent: input.paymentIntent.id,
      metadata: {
        booking_hold_id: input.hold.id,
        reason: 'booking_capacity_unavailable'
      }
    });
  }
}

export async function confirmRaceBookingFromPaymentIntent(input: {
  supabase: any;
  stripe: Stripe;
  paymentIntentId: string;
  profileId?: string | null;
}) {
  const paymentIntent = await input.stripe.paymentIntents.retrieve(input.paymentIntentId, {
    expand: ['latest_charge']
  });
  if (paymentIntent.status !== 'succeeded') throw new Error(`Payment is not complete (${paymentIntent.status}).`);

  const holdId = paymentIntent.metadata?.booking_hold_id;
  if (!holdId) throw new Error('Stripe payment is missing booking hold metadata.');

  const { data: hold, error: holdError } = await input.supabase
    .from('race_booking_holds')
    .select('*')
    .eq('id', holdId)
    .maybeSingle();
  if (holdError) throw new Error(holdError.message);
  if (!hold) throw new Error('Booking hold was not found.');

  const existingBooking = await input.supabase
    .from('race_bookings')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();
  if (existingBooking.error) throw new Error(existingBooking.error.message);
  if (existingBooking.data) return existingBooking.data;

  const charge = typeof paymentIntent.latest_charge === 'string' ? null : paymentIntent.latest_charge;
  const paymentMethod = paymentMethodFromStripeIntent(paymentIntent);
  try {
    await assertHoldStillFits(input.supabase, hold);
  } catch (error) {
    await refundStalePaidHold({ supabase: input.supabase, stripe: input.stripe, paymentIntent, hold, charge });
    const reason = error instanceof Error ? error.message : 'That slot is no longer available.';
    throw new Error(`${reason} The payment was refunded because the race time was no longer available.`);
  }

  const bookingInsert = await input.supabase
    .from('race_bookings')
    .insert({
      source: 'online_stripe',
      profile_id: input.profileId ?? hold.profile_id ?? null,
      customer_name: hold.customer_name,
      customer_email: hold.customer_email,
      customer_phone: hold.customer_phone,
      sms_consent_at: hold.sms_consent_at,
      duration_minutes: hold.duration_minutes,
      sim_count: hold.sim_count,
      party_size: hold.party_size ?? hold.sim_count,
      starts_at: hold.starts_at,
      ends_at: hold.ends_at,
      buffer_until: hold.buffer_until,
      amount_cents: hold.amount_cents,
      currency: hold.currency,
      status: 'confirmed',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: charge?.id ?? null,
      payment_method: paymentMethod,
      membership_free_race_month: hold.membership_free_race_month ?? null,
      membership_free_race_applied: Boolean(hold.membership_free_race_applied),
      membership_discount_cents: hold.membership_discount_cents ?? 0,
      membership_credit_type: hold.membership_credit_type ?? (hold.membership_free_race_applied ? 'monthly_15' : 'none'),
      membership_credit_month: hold.membership_credit_month ?? hold.membership_free_race_month ?? null,
      membership_credit_year: hold.membership_credit_year ?? null,
      ...raceRequestFromHold(hold)
    })
    .select('*')
    .single();
  if (bookingInsert.error) throw new Error(bookingInsert.error.message);

  const booking = bookingInsert.data;
  await redeemMembershipCreditIfNeeded(input.supabase, hold);

  try {
    await allocateBookingResources(input.supabase, {
      bookingId: booking.id,
      startsAt: booking.starts_at,
      bufferUntil: booking.buffer_until,
      simCount: booking.sim_count
    });
  } catch (error) {
    await input.supabase.from('race_bookings').update({ status: 'payment_succeeded_vms_failed', error: String(error) }).eq('id', booking.id);
    throw error;
  }

  try {
    const vms = VmsClient.fromEnv();
    const venueId = env.VMS_HOME_VENUE_ID ?? 1;
    const existingCustomer = await vms.findCustomerByEmail(booking.customer_email);
    const customer =
      existingCustomer ??
      (await vms.createCustomer({
        name: normalizeVmsName(booking.customer_name),
        email: booking.customer_email,
        homeVenueId: venueId,
        emailOptin: false,
        source: 'Google/Web',
        sourceOther: 'Speed Trap online booking',
        ifDuplicateEmailMakeSecondary: false
      }));
    if (!customer?.id) throw new Error('VMS did not return a customer for this booking.');
    const raceRequest = raceRequestVmsFields(booking);

    const vmsBooking = await vms.createBooking({
      eventName: vmsEventName(booking),
      customerId: customer.id,
      startDate: utcToVenueDateTime(booking.starts_at),
      endDate: utcToVenueDateTime(booking.ends_at),
      status: 'Booked',
      venueId,
      eventActivity: env.VMS_BOOKING_EVENT_ACTIVITY ?? null,
      groupSize: bookingPartySize(booking),
      numberOfPods: bookingSimCount(booking),
      requestedVehicleIds: raceRequest.requestedVehicleIds,
      requestedCircuitIds: raceRequest.requestedCircuitIds,
      participantIds: [customer.id],
      staffingNotes: bookingStaffingNotes(booking),
      notes: bookingNotes('Created automatically from a Speed Trap online booking.', booking),
      paymentNotes: bookingPaymentNotes(booking, [
        `Stripe payment intent: ${paymentIntent.id}`,
        charge?.id ? `Stripe charge: ${charge.id}` : null,
        paymentMethodNote(paymentMethod),
        membershipCreditPaymentNote(booking)
      ])
    });
    if (!vmsBooking?.id) throw new Error('VMS did not return a booking id.');

    const updated = await input.supabase
      .from('race_bookings')
      .update({
        status: 'confirmed',
        vms_customer_id: customer.id,
        vms_booking_id: vmsBooking.id,
        error: null
      })
      .eq('id', booking.id)
      .select('*')
      .single();
    if (updated.error) throw new Error(updated.error.message);

    await input.supabase.from('race_booking_holds').update({ status: 'converted' }).eq('id', hold.id);
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VMS booking failed after payment.';
    await input.supabase
      .from('race_bookings')
      .update({ status: 'payment_succeeded_vms_failed', error: message })
      .eq('id', booking.id);
    await input.supabase.from('race_booking_holds').update({ status: 'converted' }).eq('id', hold.id);
    return { ...booking, status: 'payment_succeeded_vms_failed', error: message };
  }
}

export async function confirmRaceBookingFromHold(input: {
  supabase: any;
  holdId: string;
  profileId?: string | null;
}) {
  const { data: hold, error: holdError } = await input.supabase
    .from('race_booking_holds')
    .select('*')
    .eq('id', input.holdId)
    .eq('status', 'active')
    .maybeSingle();
  if (holdError) throw new Error(holdError.message);
  if (!hold) throw new Error('Booking hold was not found.');
  if (hold.amount_cents !== 0) throw new Error('This booking requires payment.');
  try {
    await assertHoldStillFits(input.supabase, hold);
  } catch (error) {
    await input.supabase.from('race_booking_holds').update({ status: 'cancelled' }).eq('id', hold.id);
    throw error;
  }

  const bookingInsert = await input.supabase
    .from('race_bookings')
    .insert({
      source: 'online_stripe',
      profile_id: input.profileId ?? hold.profile_id ?? null,
      customer_name: hold.customer_name,
      customer_email: hold.customer_email,
      customer_phone: hold.customer_phone,
      sms_consent_at: hold.sms_consent_at,
      duration_minutes: hold.duration_minutes,
      sim_count: hold.sim_count,
      party_size: hold.party_size ?? hold.sim_count,
      starts_at: hold.starts_at,
      ends_at: hold.ends_at,
      buffer_until: hold.buffer_until,
      amount_cents: 0,
      currency: hold.currency,
      status: 'confirmed',
      payment_method: 'membership_credit',
      membership_free_race_month: hold.membership_free_race_month ?? null,
      membership_free_race_applied: Boolean(hold.membership_free_race_applied),
      membership_discount_cents: hold.membership_discount_cents ?? 0,
      membership_credit_type: hold.membership_credit_type ?? (hold.membership_free_race_applied ? 'monthly_15' : 'none'),
      membership_credit_month: hold.membership_credit_month ?? hold.membership_free_race_month ?? null,
      membership_credit_year: hold.membership_credit_year ?? null,
      ...raceRequestFromHold(hold)
    })
    .select('*')
    .single();
  if (bookingInsert.error) throw new Error(bookingInsert.error.message);

  const booking = bookingInsert.data;
  await redeemMembershipCreditIfNeeded(input.supabase, hold);

  try {
    await allocateBookingResources(input.supabase, {
      bookingId: booking.id,
      startsAt: booking.starts_at,
      bufferUntil: booking.buffer_until,
      simCount: booking.sim_count
    });
  } catch (error) {
    await input.supabase.from('race_bookings').update({ status: 'payment_succeeded_vms_failed', error: String(error) }).eq('id', booking.id);
    throw error;
  }

  try {
    const vms = VmsClient.fromEnv();
    const venueId = env.VMS_HOME_VENUE_ID ?? 1;
    const existingCustomer = await vms.findCustomerByEmail(booking.customer_email);
    const customer =
      existingCustomer ??
      (await vms.createCustomer({
        name: normalizeVmsName(booking.customer_name),
        email: booking.customer_email,
        homeVenueId: venueId,
        emailOptin: false,
        source: 'Google/Web',
        sourceOther: 'Speed Trap online booking',
        ifDuplicateEmailMakeSecondary: false
      }));
    if (!customer?.id) throw new Error('VMS did not return a customer for this booking.');
    const raceRequest = raceRequestVmsFields(booking);

    const vmsBooking = await vms.createBooking({
      eventName: vmsEventName(booking),
      customerId: customer.id,
      startDate: utcToVenueDateTime(booking.starts_at),
      endDate: utcToVenueDateTime(booking.ends_at),
      status: 'Booked',
      venueId,
      eventActivity: env.VMS_BOOKING_EVENT_ACTIVITY ?? null,
      groupSize: bookingPartySize(booking),
      numberOfPods: bookingSimCount(booking),
      requestedVehicleIds: raceRequest.requestedVehicleIds,
      requestedCircuitIds: raceRequest.requestedCircuitIds,
      participantIds: [customer.id],
      staffingNotes: bookingStaffingNotes(booking),
      notes: bookingNotes('Created automatically from a Speed Trap online booking.', booking),
      paymentNotes: bookingPaymentNotes(booking, [paymentMethodNote('membership_credit'), membershipCreditPaymentNote(booking)])
    });
    if (!vmsBooking?.id) throw new Error('VMS did not return a booking id.');

    const updated = await input.supabase
      .from('race_bookings')
      .update({
        status: 'confirmed',
        vms_customer_id: customer.id,
        vms_booking_id: vmsBooking.id,
        error: null
      })
      .eq('id', booking.id)
      .select('*')
      .single();
    if (updated.error) throw new Error(updated.error.message);

    await input.supabase.from('race_booking_holds').update({ status: 'converted' }).eq('id', hold.id);
    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VMS booking failed after payment.';
    await input.supabase
      .from('race_bookings')
      .update({ status: 'payment_succeeded_vms_failed', error: message })
      .eq('id', booking.id);
    await input.supabase.from('race_booking_holds').update({ status: 'converted' }).eq('id', hold.id);
    return { ...booking, status: 'payment_succeeded_vms_failed', error: message };
  }
}

export function canAutoCancel(startsAt: string) {
  return new Date(startsAt).getTime() - Date.now() >= BOOKING_CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000;
}

import Stripe from 'stripe';

import { allocateBookingResources } from '@/lib/bookings/availability';
import { BOOKING_CANCELLATION_CUTOFF_HOURS } from '@/lib/bookings/config';
import { raceRequestDbFields, raceRequestVmsFields } from '@/lib/bookings/race-request';
import { utcToVenueDateTime } from '@/lib/bookings/time';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';

function normalizeVmsName(name: string) {
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

async function redeemMembershipCreditIfNeeded(supabase: any, hold: any) {
  if (!hold.profile_id || !hold.membership_free_race_applied) return;
  await supabase
    .from('profiles')
    .update({
      membership_status: 'active',
      membership_free_race_month: hold.membership_free_race_month,
      membership_free_race_redeemed_at: new Date().toISOString()
    })
    .eq('id', hold.profile_id)
    .eq('membership_status', 'active-start');
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
  return [base, request.noteLine].filter(Boolean).join('\n');
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
      starts_at: hold.starts_at,
      ends_at: hold.ends_at,
      buffer_until: hold.buffer_until,
      amount_cents: hold.amount_cents,
      currency: hold.currency,
      status: 'confirmed',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: charge?.id ?? null,
      membership_free_race_month: hold.membership_free_race_month ?? null,
      membership_free_race_applied: Boolean(hold.membership_free_race_applied),
      membership_discount_cents: hold.membership_discount_cents ?? 0,
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
      eventName: `Speed Trap Race - ${normalizeVmsName(booking.customer_name)}`,
      customerId: customer.id,
      startDate: utcToVenueDateTime(booking.starts_at),
      endDate: utcToVenueDateTime(booking.ends_at),
      status: 'Booked',
      venueId,
      eventActivity: 'Hotlapping',
      groupSize: booking.sim_count,
      numberOfPods: booking.sim_count,
      requestedVehicleIds: raceRequest.requestedVehicleIds,
      requestedCircuitIds: raceRequest.requestedCircuitIds,
      participantIds: [customer.id],
      staffingNotes: raceRequest.noteLine,
      notes: bookingNotes('Created automatically from a Speed Trap online booking.', booking),
      paymentNotes: [`Stripe payment intent: ${paymentIntent.id}`, charge?.id ? `Stripe charge: ${charge.id}` : null].filter(Boolean).join('\n')
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
      starts_at: hold.starts_at,
      ends_at: hold.ends_at,
      buffer_until: hold.buffer_until,
      amount_cents: 0,
      currency: hold.currency,
      status: 'confirmed',
      membership_free_race_month: hold.membership_free_race_month ?? null,
      membership_free_race_applied: Boolean(hold.membership_free_race_applied),
      membership_discount_cents: hold.membership_discount_cents ?? 0,
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
      eventName: `Speed Trap Race - ${normalizeVmsName(booking.customer_name)}`,
      customerId: customer.id,
      startDate: utcToVenueDateTime(booking.starts_at),
      endDate: utcToVenueDateTime(booking.ends_at),
      status: 'Booked',
      venueId,
      eventActivity: 'Hotlapping',
      groupSize: booking.sim_count,
      numberOfPods: booking.sim_count,
      requestedVehicleIds: raceRequest.requestedVehicleIds,
      requestedCircuitIds: raceRequest.requestedCircuitIds,
      participantIds: [customer.id],
      staffingNotes: raceRequest.noteLine,
      notes: bookingNotes('Created automatically from a Speed Trap online booking.', booking),
      paymentNotes: 'Monthly membership free race.'
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

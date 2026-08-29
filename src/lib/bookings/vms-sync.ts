import { type SupabaseClient } from '@supabase/supabase-js';

import { BOOKING_BUFFER_MINUTES } from '@/lib/bookings/config';
import { addMinutes, localDateTimeToUtc } from '@/lib/bookings/time';
import { env } from '@/lib/supabase/env';
import { VmsClient } from '@/lib/vms/client';
import { type VmsBooking } from '@/lib/vms/types';

const VMS_IMPORT_EMAIL_DOMAIN = 'speedtrapracing.local';
const DEFAULT_SYNC_FUTURE_DAYS = 90;

type LocalVmsBooking = {
  id: string;
  source: string;
  vms_booking_id: number | null;
};

function parseVmsDate(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (match) return localDateTimeToUtc(match[1], match[2].length === 5 ? `${match[2]}:00` : match[2]);

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampSimCount(value: number | null | undefined) {
  const count = Number(value ?? 1);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(4, Math.ceil(count)));
}

function importedEmailFor(bookingId: number) {
  return `vms-booking-${bookingId}@${VMS_IMPORT_EMAIL_DOMAIN}`;
}

function durationMinutes(start: Date, end: Date) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  return 'confirmed';
}

function isRelevantVenue(booking: VmsBooking) {
  if (!env.VMS_HOME_VENUE_ID) return true;
  return !booking.venueId || booking.venueId === env.VMS_HOME_VENUE_ID;
}

function syncPayloadFor(booking: VmsBooking) {
  const startsAt = parseVmsDate(booking.startDate);
  const endsAt = parseVmsDate(booking.endDate);
  if (!startsAt || !endsAt || endsAt <= startsAt) return null;

  const simCount = clampSimCount(booking.numberOfPods ?? booking.groupSize ?? booking.participantIds?.length);
  const rawPartySize = Number(booking.groupSize ?? booking.participantIds?.length ?? simCount);
  const partySize = Number.isFinite(rawPartySize) ? Math.max(1, Math.ceil(rawPartySize)) : simCount;
  const name = booking.customerName ?? booking.eventName ?? `VMS booking #${booking.id}`;

  return {
    customer_name: name,
    customer_email: importedEmailFor(booking.id),
    duration_minutes: durationMinutes(startsAt, endsAt),
    sim_count: simCount,
    party_size: partySize,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    buffer_until: addMinutes(endsAt, BOOKING_BUFFER_MINUTES).toISOString(),
    amount_cents: 0,
    currency: 'usd',
    status: normalizeStatus(booking.status),
    source: 'vms_import',
    vms_customer_id: booking.customerId ?? null,
    vms_booking_id: booking.id,
    error: booking.status ? `Imported from VMS status: ${booking.status}` : 'Imported from VMS.'
  };
}

export async function syncUpcomingVmsBookings(
  supabase: SupabaseClient,
  options: { futureDays?: number } = {}
) {
  const future = options.futureDays ?? DEFAULT_SYNC_FUTURE_DAYS;
  const vmsBookings = (await VmsClient.fromEnv().listBookings({ past: 0, future }))
    .filter(isRelevantVenue)
    .map((booking) => ({ booking, payload: syncPayloadFor(booking) }))
    .filter((item): item is { booking: VmsBooking; payload: NonNullable<ReturnType<typeof syncPayloadFor>> } => Boolean(item.payload));

  const vmsIds = vmsBookings.map((item) => item.booking.id);
  const existingRes = vmsIds.length
    ? await supabase
        .from('race_bookings')
        .select('id,source,vms_booking_id')
        .in('vms_booking_id', vmsIds)
    : { data: [], error: null };
  if (existingRes.error) throw new Error(existingRes.error.message);

  const existingByVmsId = new Map<number, LocalVmsBooking>();
  for (const row of (existingRes.data ?? []) as LocalVmsBooking[]) {
    if (row.vms_booking_id) existingByVmsId.set(Number(row.vms_booking_id), row);
  }

  let imported = 0;
  let updated = 0;
  let cancelled = 0;

  for (const { booking, payload } of vmsBookings) {
    const existing = existingByVmsId.get(booking.id);

    if (!existing) {
      const insertRes = await supabase.from('race_bookings').insert(payload);
      if (insertRes.error) throw new Error(insertRes.error.message);
      imported += 1;
      continue;
    }

    const updatePayload =
      existing.source === 'vms_import'
        ? payload
        : {
            starts_at: payload.starts_at,
            ends_at: payload.ends_at,
            buffer_until: payload.buffer_until,
            duration_minutes: payload.duration_minutes,
            sim_count: payload.sim_count,
            party_size: payload.party_size,
            status: payload.status,
            vms_customer_id: payload.vms_customer_id,
            error: null
          };

    const updateRes = await supabase.from('race_bookings').update(updatePayload).eq('id', existing.id);
    if (updateRes.error) throw new Error(updateRes.error.message);
    updated += 1;
  }

  const missingImportedRes = await supabase
    .from('race_bookings')
    .select('id,vms_booking_id')
    .eq('source', 'vms_import')
    .in('status', ['confirmed', 'payment_succeeded_vms_failed'])
    .not('vms_booking_id', 'is', null)
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', addMinutes(new Date(), future * 24 * 60).toISOString());
  if (missingImportedRes.error) throw new Error(missingImportedRes.error.message);

  const liveVmsIds = new Set(vmsIds.map((id) => Number(id)));
  const missingImportedIds = (missingImportedRes.data ?? [])
    .filter((booking) => booking.vms_booking_id && !liveVmsIds.has(Number(booking.vms_booking_id)))
    .map((booking) => booking.id);

  if (missingImportedIds.length) {
    const cancelRes = await supabase
      .from('race_bookings')
      .update({
        status: 'cancelled',
        error: 'Cancelled locally because this imported booking is no longer returned by VMS sync.'
      })
      .in('id', missingImportedIds);
    if (cancelRes.error) throw new Error(cancelRes.error.message);

    const releaseRes = await supabase.from('race_booking_resources').delete().in('booking_id', missingImportedIds);
    if (releaseRes.error) throw new Error(releaseRes.error.message);
    cancelled = missingImportedIds.length;
  }

  return { imported, updated, cancelled, skipped: Math.max(0, vmsBookings.length - imported - updated) };
}

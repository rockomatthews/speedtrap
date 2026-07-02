import { type SupabaseClient } from '@supabase/supabase-js';

import {
  BOOKING_BUFFER_MINUTES,
  BOOKING_SLOT_INTERVAL_MINUTES,
  bookingAmountCents,
  supportedBookingDuration
} from '@/lib/bookings/config';
import { addMinutes, dayOfWeekForVenueDate, localDateTimeToUtc, overlaps, utcToVenueTime } from '@/lib/bookings/time';

export type BookingSlot = {
  startsAt: string;
  endsAt: string;
  time: string;
  available: boolean;
  availableSims: number;
  reason: 'available' | 'closed' | 'full' | 'blackout' | 'past';
};

type ScheduleRule = {
  opens_at: string;
  closes_at: string;
  max_sims: number | null;
};

type Occupancy = {
  starts_at: string;
  buffer_until: string;
  sim_count: number;
};

type Blackout = {
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

function timePart(value: string) {
  return value.slice(0, 8);
}

function slotRange(date: string) {
  const start = localDateTimeToUtc(date, '00:00:00');
  const end = localDateTimeToUtc(date, '23:59:59');
  return {
    start,
    end,
    queryStart: addMinutes(start, -24 * 60).toISOString(),
    queryEnd: addMinutes(end, 24 * 60).toISOString()
  };
}

export async function getBookingAvailability(
  supabase: SupabaseClient,
  input: { date: string; durationMinutes: number; simCount: number; excludeHoldId?: string | null }
) {
  if (!supportedBookingDuration(input.durationMinutes)) throw new Error('Unsupported booking duration.');
  const simCount = Math.max(1, Math.min(4, Math.floor(input.simCount)));
  const amountCents = bookingAmountCents(input.durationMinutes, simCount);
  if (!amountCents) throw new Error('Unsupported booking product.');

  const resourcesRes = await supabase
    .from('booking_resources')
    .select('id,name,display_order')
    .eq('active', true)
    .order('display_order', { ascending: true });
  if (resourcesRes.error) throw new Error(resourcesRes.error.message);
  const physicalTotalSims = resourcesRes.data?.length ?? 0;

  const dayOfWeek = dayOfWeekForVenueDate(input.date);
  const scheduleRes = await supabase
    .from('venue_schedule_rules')
    .select('opens_at,closes_at,max_sims')
    .eq('day_of_week', dayOfWeek)
    .eq('active', true)
    .order('opens_at', { ascending: true });
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);
  const schedule = (scheduleRes.data ?? []) as ScheduleRule[];

  const range = slotRange(input.date);
  const [blackoutRes, bookingsRes, holdsRes] = await Promise.all([
    supabase.from('venue_blackouts').select('starts_at,ends_at,reason').lt('starts_at', range.queryEnd).gt('ends_at', range.queryStart),
    supabase
      .from('race_bookings')
      .select('starts_at,buffer_until,sim_count')
      .in('status', ['confirmed', 'payment_succeeded_vms_failed'])
      .lt('starts_at', range.queryEnd)
      .gt('buffer_until', range.queryStart),
    supabase
      .from('race_booking_holds')
      .select('id,starts_at,buffer_until,sim_count')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .lt('starts_at', range.queryEnd)
      .gt('buffer_until', range.queryStart)
  ]);
  if (blackoutRes.error) throw new Error(blackoutRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (holdsRes.error) throw new Error(holdsRes.error.message);

  const blackouts = (blackoutRes.data ?? []) as Blackout[];
  const bookings = (bookingsRes.data ?? []) as Occupancy[];
  const holds = ((holdsRes.data ?? []) as Array<Occupancy & { id: string }>).filter((hold) => hold.id !== input.excludeHoldId);
  const now = new Date();
  const slots: BookingSlot[] = [];
  const dailyPublicSimCap =
    schedule.length > 0 ? Math.max(...schedule.map((rule) => Math.min(physicalTotalSims, Number(rule.max_sims ?? 4)))) : 0;

  for (const rule of schedule) {
    let cursor = localDateTimeToUtc(input.date, timePart(rule.opens_at));
    const close = localDateTimeToUtc(input.date, timePart(rule.closes_at));
    const publicSimCap = Math.min(physicalTotalSims, Number(rule.max_sims ?? 4));

    while (cursor < close) {
      const startsAt = new Date(cursor);
      const endsAt = addMinutes(startsAt, input.durationMinutes);
      const bufferUntil = addMinutes(endsAt, BOOKING_BUFFER_MINUTES);
      let reason: BookingSlot['reason'] = 'available';

      if (startsAt <= now) reason = 'past';
      if (bufferUntil > close) reason = 'closed';

      const blackout = blackouts.some((item) => overlaps(startsAt, bufferUntil, new Date(item.starts_at), new Date(item.ends_at)));
      if (blackout) reason = 'blackout';

      const occupied = [...bookings, ...holds].reduce((count, item) => {
        return overlaps(startsAt, bufferUntil, new Date(item.starts_at), new Date(item.buffer_until)) ? count + Number(item.sim_count ?? 0) : count;
      }, 0);
      const availableSims = Math.max(0, publicSimCap - occupied);
      if (reason === 'available' && availableSims < simCount) reason = 'full';

      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        time: utcToVenueTime(startsAt),
        available: reason === 'available',
        availableSims,
        reason
      });

      cursor = addMinutes(cursor, BOOKING_SLOT_INTERVAL_MINUTES);
    }
  }

  return {
    date: input.date,
    durationMinutes: input.durationMinutes,
    simCount,
    amountCents,
    currency: 'usd',
    totalSims: dailyPublicSimCap,
    slots
  };
}

export async function assertSlotAvailable(
  supabase: SupabaseClient,
  input: { date: string; startsAt: string; durationMinutes: number; simCount: number; excludeHoldId?: string | null }
) {
  const availability = await getBookingAvailability(supabase, {
    date: input.date,
    durationMinutes: input.durationMinutes,
    simCount: input.simCount,
    excludeHoldId: input.excludeHoldId
  });
  const slot = availability.slots.find((item) => item.startsAt === new Date(input.startsAt).toISOString());
  if (!slot?.available) {
    throw new Error(slot ? `That slot is not available (${slot.reason}).` : 'That slot is not available.');
  }
  return { availability, slot };
}

export async function allocateBookingResources(
  supabase: SupabaseClient,
  input: { bookingId: string; startsAt: string; bufferUntil: string; simCount: number }
) {
  const resourcesRes = await supabase
    .from('booking_resources')
    .select('id,name,display_order')
    .eq('active', true)
    .order('display_order', { ascending: true });
  if (resourcesRes.error) throw new Error(resourcesRes.error.message);

  const overlappingRes = await supabase
    .from('race_bookings')
    .select('id,race_booking_resources(resource_id)')
    .in('status', ['confirmed', 'payment_succeeded_vms_failed'])
    .neq('id', input.bookingId)
    .lt('starts_at', input.bufferUntil)
    .gt('buffer_until', input.startsAt);
  if (overlappingRes.error) throw new Error(overlappingRes.error.message);

  const used = new Set<string>();
  for (const booking of overlappingRes.data ?? []) {
    const assigned = (booking as any).race_booking_resources;
    for (const row of Array.isArray(assigned) ? assigned : []) {
      if (row?.resource_id) used.add(String(row.resource_id));
    }
  }

  const selected = (resourcesRes.data ?? []).filter((resource) => !used.has(String(resource.id))).slice(0, input.simCount);
  if (selected.length < input.simCount) throw new Error('Not enough sims are available to assign this booking.');

  const rows = selected.map((resource) => ({ booking_id: input.bookingId, resource_id: resource.id }));
  const insertRes = await supabase.from('race_booking_resources').insert(rows);
  if (insertRes.error) throw new Error(insertRes.error.message);
  return selected;
}

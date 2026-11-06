import { utcToVenueDate } from '@/lib/bookings/time';
import type { MembershipProfile } from '@/lib/membership';

type BookingWindowProfile = (MembershipProfile & { role?: string | null }) | null | undefined;

export function bookingDateWindow(_profile: BookingWindowProfile, now = new Date()) {
  return { minDate: utcToVenueDate(now), maxDate: null, advanceDays: null };
}

export function validateBookingDateWithinWindow(
  date: string,
  profile: BookingWindowProfile,
  now = new Date()
) {
  const window = bookingDateWindow(profile, now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) {
    return { ok: false, ...window, error: 'Choose a valid booking date.' };
  }
  if (date < window.minDate) {
    return {
      ok: false,
      ...window,
      error: 'Choose today or a future booking date.'
    };
  }
  return { ok: true, ...window, error: null };
}

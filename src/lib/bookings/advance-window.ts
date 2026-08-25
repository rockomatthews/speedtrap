import { utcToVenueDate } from '@/lib/bookings/time';
import type { MembershipProfile } from '@/lib/membership';

export const BOOKING_ADVANCE_DAYS = 30;
export const PUBLIC_BOOKING_ADVANCE_DAYS = BOOKING_ADVANCE_DAYS;
export const MEMBER_BOOKING_ADVANCE_DAYS = BOOKING_ADVANCE_DAYS;

type BookingWindowProfile = (MembershipProfile & { role?: 'customer' | 'admin' | string | null }) | null | undefined;

function addDaysToVenueDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return value.toISOString().slice(0, 10);
}

export function bookingAdvanceDaysForProfile(_profile: BookingWindowProfile, _now = new Date()) {
  return BOOKING_ADVANCE_DAYS;
}

export function bookingDateWindow(profile: BookingWindowProfile, now = new Date()) {
  const today = utcToVenueDate(now);
  const advanceDays = bookingAdvanceDaysForProfile(profile, now);
  return {
    minDate: today,
    maxDate: addDaysToVenueDate(today, advanceDays),
    advanceDays
  };
}

export function validateBookingDateWithinWindow(
  date: string,
  profile: BookingWindowProfile,
  now = new Date()
) {
  const window = bookingDateWindow(profile, now);
  if (date < window.minDate) {
    return {
      ok: false,
      ...window,
      error: 'Choose today or a future booking date.'
    };
  }
  if (date > window.maxDate) {
    return {
      ok: false,
      ...window,
      error: `Bookings are available up to ${BOOKING_ADVANCE_DAYS} days in advance.`
    };
  }
  return { ok: true, ...window, error: null };
}

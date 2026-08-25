import { utcToVenueDate } from '@/lib/bookings/time';
import { isMembershipActive, type MembershipProfile } from '@/lib/membership';

export const PUBLIC_BOOKING_ADVANCE_DAYS = 7;
export const MEMBER_BOOKING_ADVANCE_DAYS = 14;

type BookingWindowProfile = (MembershipProfile & { role?: 'customer' | 'admin' | string | null }) | null | undefined;

function addDaysToVenueDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return value.toISOString().slice(0, 10);
}

export function bookingAdvanceDaysForProfile(profile: BookingWindowProfile, now = new Date()) {
  return profile?.role === 'admin' || isMembershipActive(profile, now) ? MEMBER_BOOKING_ADVANCE_DAYS : PUBLIC_BOOKING_ADVANCE_DAYS;
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
      error:
        window.advanceDays === MEMBER_BOOKING_ADVANCE_DAYS
          ? 'Members can book up to 14 days in advance.'
          : 'Public bookings are available up to 7 days in advance. Members can book 14 days out.'
    };
  }
  return { ok: true, ...window, error: null };
}

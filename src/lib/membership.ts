import { BOOKING_TIMEZONE, raceProductForDuration } from '@/lib/bookings/config';

export type MembershipStatus = 'inactive' | 'active-start' | 'active';

export type MembershipProfile = {
  id?: string | null;
  membership_status?: MembershipStatus | null;
  membership_current_period_end?: string | null;
  membership_free_race_month?: string | null;
  membership_free_race_redeemed_at?: string | null;
};

export type MembershipBookingPrice = {
  baseAmountCents: number;
  amountCents: number;
  discountCents: number;
  freeRaceApplied: boolean;
  freeRaceMonth: string | null;
};

export const MEMBERSHIP_DISCOUNT_PERCENT = 10;

export function membershipState(profile: MembershipProfile | null | undefined, now = new Date()) {
  const active = isMembershipActive(profile, now);
  const freeRaceAvailable = hasUnusedMonthlyRace(profile, now);
  return {
    active,
    freeRaceAvailable,
    status: active ? profile?.membership_status ?? 'inactive' : 'inactive',
    label: active ? 'Active Member' : 'Not a Member',
    creditLabel: !active ? 'No member credit' : freeRaceAvailable ? 'Monthly race credit available' : 'Monthly race credit used'
  };
}

export function venueMembershipMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === 'month')?.value ?? String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function isMembershipActive(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile) return false;
  if (profile.membership_status !== 'active-start' && profile.membership_status !== 'active') return false;
  if (!profile.membership_current_period_end) return true;
  return new Date(profile.membership_current_period_end).getTime() > now.getTime();
}

export function hasUnusedMonthlyRace(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!isMembershipActive(profile, now)) return false;
  return profile?.membership_status === 'active-start' && !profile.membership_free_race_redeemed_at;
}

export function membershipBookingPrice(input: {
  durationMinutes: number;
  simCount: number;
  profile?: MembershipProfile | null;
  now?: Date;
}): MembershipBookingPrice | null {
  const product = raceProductForDuration(input.durationMinutes);
  if (!product) return null;

  const baseAmountCents = product.priceCents * input.simCount;
  const now = input.now ?? new Date();
  const freeRaceMonth = venueMembershipMonth(now);

  if (!isMembershipActive(input.profile, now)) {
    return {
      baseAmountCents,
      amountCents: baseAmountCents,
      discountCents: 0,
      freeRaceApplied: false,
      freeRaceMonth: null
    };
  }

  const freeRaceApplied = hasUnusedMonthlyRace(input.profile, now) && input.simCount > 0;
  const freeRaceCreditCents = freeRaceApplied ? product.priceCents : 0;
  const discountableCents = Math.max(0, baseAmountCents - freeRaceCreditCents);
  const discountCents = Math.round(discountableCents * (MEMBERSHIP_DISCOUNT_PERCENT / 100));

  return {
    baseAmountCents,
    amountCents: Math.max(0, discountableCents - discountCents),
    discountCents: freeRaceCreditCents + discountCents,
    freeRaceApplied,
    freeRaceMonth: freeRaceApplied ? freeRaceMonth : null
  };
}

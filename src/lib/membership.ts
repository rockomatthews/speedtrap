import {
  BOOKING_TIMEZONE,
  bookingAmountCents,
} from '@/lib/bookings/config';

export type MembershipStatus = 'inactive' | 'active-start' | 'active';

export type MembershipProfile = {
  id?: string | null;
  membership_status?: MembershipStatus | null;
  membership_current_period_end?: string | null;
  birthday?: string | null;
  membership_free_race_month?: string | null;
  membership_free_race_redeemed_at?: string | null;
  membership_monthly_15_race_month?: string | null;
  membership_monthly_15_race_redeemed_at?: string | null;
  membership_birthday_30_race_year?: number | null;
  membership_birthday_30_race_redeemed_at?: string | null;
};

export type MembershipCreditType = 'none' | 'monthly_15' | 'birthday_30';

export type MembershipBookingPrice = {
  baseAmountCents: number;
  amountCents: number;
  discountCents: number;
  freeRaceApplied: boolean;
  freeRaceMonth: string | null;
  creditType: MembershipCreditType;
  creditMonth: string | null;
  creditYear: number | null;
  creditLabel: string | null;
};

export const MEMBERSHIP_DISCOUNT_PERCENT = 10;
export const MEMBERSHIP_MONTHLY_RACE_MINUTES = 15;
export const MEMBERSHIP_BIRTHDAY_RACE_MINUTES = 30;

export function membershipState(profile: MembershipProfile | null | undefined, now = new Date()) {
  const active = isMembershipActive(profile, now);
  const monthly15Available = active && hasUnusedMonthlyRace(profile, now);
  const birthday30Available = active && hasUnusedBirthdayRace(profile, now);
  const freeRaceAvailable = monthly15Available || birthday30Available;
  return {
    active,
    freeRaceAvailable,
    monthly15Available,
    birthday30Available,
    birthdayOnFile: Boolean(profile?.birthday),
    birthdayMonthActive: isBirthdayMonth(profile, now),
    status: active ? profile?.membership_status ?? 'inactive' : 'inactive',
    label: active ? 'Active Apex Pass' : 'Not an Apex Pass member',
    creditLabel: !active
      ? 'No member credit'
      : freeRaceAvailable
        ? 'Member race credit available'
        : 'Member race credits used'
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

export function venueMembershipYear(date = new Date()) {
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIMEZONE,
    year: 'numeric'
  }).format(date);
  return Number(year);
}

export function venueMembershipMonthNumber(date = new Date()) {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIMEZONE,
    month: '2-digit'
  }).format(date);
  return Number(month);
}

export function isMembershipActive(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile) return false;
  if (profile.membership_status !== 'active-start' && profile.membership_status !== 'active') return false;
  if (!profile.membership_current_period_end) return true;
  return new Date(profile.membership_current_period_end).getTime() > now.getTime();
}

export function hasUnusedMonthlyRace(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile) return false;
  const creditMonth = venueMembershipMonth(now);
  const redeemedMonth = profile?.membership_monthly_15_race_month ?? profile?.membership_free_race_month ?? null;
  const redeemedAt = profile?.membership_monthly_15_race_redeemed_at ?? profile?.membership_free_race_redeemed_at ?? null;
  return redeemedMonth !== creditMonth || !redeemedAt;
}

export function isBirthdayMonth(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile?.birthday) return false;
  const birthdayMonth = Number(String(profile.birthday).slice(5, 7));
  if (!Number.isFinite(birthdayMonth)) return false;
  return birthdayMonth === venueMembershipMonthNumber(now);
}

export function hasUnusedBirthdayRace(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile || !isBirthdayMonth(profile, now)) return false;
  const creditYear = venueMembershipYear(now);
  return profile?.membership_birthday_30_race_year !== creditYear || !profile?.membership_birthday_30_race_redeemed_at;
}

export function membershipBookingPrice(input: {
  durationMinutes: number;
  simCount: number;
  profile?: MembershipProfile | null;
  now?: Date;
  creditDate?: Date;
}): MembershipBookingPrice | null {
  const baseAmountCents = bookingAmountCents(input.durationMinutes, input.simCount);
  if (baseAmountCents === null) return null;

  const now = input.now ?? new Date();
  const creditDate = input.creditDate ?? now;
  const freeRaceMonth = venueMembershipMonth(creditDate);
  const creditYear = venueMembershipYear(creditDate);

  if (!isMembershipActive(input.profile, now)) {
    return {
      baseAmountCents,
      amountCents: baseAmountCents,
      discountCents: 0,
      freeRaceApplied: false,
      freeRaceMonth: null,
      creditType: 'none',
      creditMonth: null,
      creditYear: null,
      creditLabel: null
    };
  }

  let creditType: MembershipCreditType = 'none';
  let creditLabel: string | null = null;
  let freeRaceCreditCents = 0;

  if (input.simCount > 0 && input.durationMinutes >= MEMBERSHIP_BIRTHDAY_RACE_MINUTES && hasUnusedBirthdayRace(input.profile, creditDate)) {
    creditType = 'birthday_30';
    creditLabel = 'birthday 30-minute race';
    freeRaceCreditCents = bookingAmountCents(MEMBERSHIP_BIRTHDAY_RACE_MINUTES, 1) ?? 0;
  } else if (input.simCount > 0 && input.durationMinutes >= MEMBERSHIP_MONTHLY_RACE_MINUTES && hasUnusedMonthlyRace(input.profile, creditDate)) {
    creditType = 'monthly_15';
    creditLabel = 'monthly 15-minute race';
    freeRaceCreditCents = bookingAmountCents(MEMBERSHIP_MONTHLY_RACE_MINUTES, 1) ?? 0;
  }

  const freeRaceApplied = creditType !== 'none';
  const discountableCents = Math.max(0, baseAmountCents - freeRaceCreditCents);
  const discountCents = Math.round(discountableCents * (MEMBERSHIP_DISCOUNT_PERCENT / 100));

  return {
    baseAmountCents,
    amountCents: Math.max(0, discountableCents - discountCents),
    discountCents: freeRaceCreditCents + discountCents,
    freeRaceApplied,
    freeRaceMonth: freeRaceApplied ? freeRaceMonth : null,
    creditType,
    creditMonth: freeRaceApplied ? freeRaceMonth : null,
    creditYear: freeRaceApplied ? creditYear : null,
    creditLabel
  };
}

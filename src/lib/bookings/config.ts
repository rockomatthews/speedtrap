export const BOOKING_TIMEZONE = process.env.VMS_VENUE_TIMEZONE ?? 'America/New_York';
export const BOOKING_BUFFER_MINUTES = 5;
export const BOOKING_HOLD_MINUTES = 10;
export const BOOKING_SLOT_INTERVAL_MINUTES = 15;
export const BOOKING_CANCELLATION_CUTOFF_HOURS = 2;

export const RACE_PRODUCTS = [
  {
    durationMinutes: 15,
    label: '15 min',
    priceCents: 1500,
    description: 'Quick race session'
  },
  {
    durationMinutes: 30,
    label: '30 min',
    priceCents: 2800,
    description: 'Full race session'
  },
  {
    durationMinutes: 60,
    label: '60 min',
    priceCents: 5500,
    description: 'Feature race session'
  }
] as const;

export type RaceDurationMinutes = (typeof RACE_PRODUCTS)[number]['durationMinutes'];
export const MIN_CUSTOM_DURATION_MINUTES = 15;
export const MAX_CUSTOM_DURATION_MINUTES = 240;
export const CUSTOM_DURATION_BLOCK_MINUTES = 30;
export const CUSTOM_DURATION_BLOCK_PRICE_CENTS = 2800;
export const MAX_BOOKING_SIM_COUNT = 4;
export const MAX_NORMAL_BOOKING_PARTY_SIZE = 14;
export const MAX_DRIVERS_PER_POD = 6;
export const ROTATION_BOOKING_MIN_DURATION_MINUTES = 60;

const PACKAGE_PRICES_CENTS: Record<number, Record<number, number>> = {
  1: { 15: 1500, 30: 2800, 60: 5500 },
  2: { 15: 3000, 30: 6000, 60: 11000 },
  3: { 15: 4500, 30: 8800, 60: 16500 },
  4: { 15: 6000, 30: 11500, 60: 22000 }
};

export function raceProductForDuration(durationMinutes: number) {
  return RACE_PRODUCTS.find((product) => product.durationMinutes === durationMinutes) ?? null;
}

export function supportedBookingDuration(durationMinutes: number) {
  return (
    Number.isInteger(durationMinutes) &&
    durationMinutes >= MIN_CUSTOM_DURATION_MINUTES &&
    durationMinutes <= MAX_CUSTOM_DURATION_MINUTES
  );
}

export function normalizeSimCount(value: number | null | undefined) {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(MAX_BOOKING_SIM_COUNT, Math.floor(number)));
}

export function normalizePartySize(value: number | null | undefined) {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(MAX_NORMAL_BOOKING_PARTY_SIZE, Math.floor(number)));
}

export function simCountForPartySize(partySize: number) {
  return normalizeSimCount(Math.min(normalizePartySize(partySize), MAX_BOOKING_SIM_COUNT));
}

export function minimumPodsForPartySize(partySize: number) {
  return Math.ceil(partySize / MAX_DRIVERS_PER_POD);
}

export function resolveBookingSimCount(partySize: number, requestedSimCount?: number) {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_NORMAL_BOOKING_PARTY_SIZE) {
    throw new Error('Online bookings allow 1-14 drivers. Groups of 15 or more should use private events.');
  }
  const pods = requestedSimCount ?? simCountForPartySize(partySize);
  if (!Number.isInteger(pods) || pods < minimumPodsForPartySize(partySize) || pods > MAX_BOOKING_SIM_COUNT) {
    throw new Error('Choose 1-4 pods, with no more than 6 drivers sharing each pod.');
  }
  return pods;
}

export function isRotationBooking(partySize: number, simCount = simCountForPartySize(partySize)) {
  return partySize > simCount;
}

export function assertPartyDurationAllowed(partySize: number, durationMinutes: number, simCount?: number) {
  const pods = resolveBookingSimCount(partySize, simCount);
  if (isRotationBooking(partySize, pods) && durationMinutes < ROTATION_BOOKING_MIN_DURATION_MINUTES) {
    throw new Error('Shared-pod bookings require at least 60 minutes. Choose more pods for a shorter session.');
  }
}

export function packageAmountCents(durationMinutes: number, simCount: number) {
  const sims = normalizeSimCount(simCount);
  return PACKAGE_PRICES_CENTS[sims]?.[durationMinutes] ?? null;
}

export function bookingAmountCents(durationMinutes: number, simCount: number) {
  if (!supportedBookingDuration(durationMinutes) || simCount < 1) return null;
  const sims = normalizeSimCount(simCount);
  const exactPackage = packageAmountCents(durationMinutes, sims);
  if (exactPackage !== null) return exactPackage;

  let remainingMinutes = durationMinutes;
  let amountCents = 0;

  while (remainingMinutes >= 60) {
    amountCents += packageAmountCents(60, sims) ?? 0;
    remainingMinutes -= 60;
  }

  if (remainingMinutes >= 30) {
    amountCents += packageAmountCents(30, sims) ?? 0;
    remainingMinutes -= 30;
  }

  if (remainingMinutes > 0) {
    amountCents += (packageAmountCents(15, sims) ?? 1500 * sims);
  }

  return amountCents;
}

export function bookingPackageLabel(durationMinutes: number, simCount: number) {
  const sims = normalizeSimCount(simCount);
  const podLabel = sims === 1 ? '1 Pod' : sims === 4 ? 'Full Venue / 4 Pods' : `${sims} Pods`;
  return `${podLabel} - ${durationMinutes} min`;
}

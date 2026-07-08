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
    priceCents: 5200,
    description: 'Feature race session'
  }
] as const;

export type RaceDurationMinutes = (typeof RACE_PRODUCTS)[number]['durationMinutes'];
export const MIN_CUSTOM_DURATION_MINUTES = 15;
export const MAX_CUSTOM_DURATION_MINUTES = 240;
export const CUSTOM_DURATION_BLOCK_MINUTES = 30;
export const CUSTOM_DURATION_BLOCK_PRICE_CENTS = 2800;

const PACKAGE_PRICES_CENTS: Record<number, Record<number, number>> = {
  1: { 15: 1500, 30: 2800, 60: 5200 },
  2: { 15: 3000, 30: 6000, 60: 11000 },
  3: { 15: 4500, 30: 8800, 60: 16200 },
  4: { 15: 6000, 30: 11500, 60: 21000 }
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

export function packageAmountCents(durationMinutes: number, simCount: number) {
  const sims = Math.max(1, Math.min(4, Math.floor(simCount)));
  return PACKAGE_PRICES_CENTS[sims]?.[durationMinutes] ?? null;
}

export function bookingAmountCents(durationMinutes: number, simCount: number) {
  if (!supportedBookingDuration(durationMinutes) || simCount < 1) return null;
  const sims = Math.max(1, Math.min(4, Math.floor(simCount)));
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
  const sims = Math.max(1, Math.min(4, Math.floor(simCount)));
  const podLabel = sims === 1 ? 'Solo Driver' : sims === 4 ? 'Full Venue / 4 Pods' : `${sims} Pods`;
  return `${podLabel} - ${durationMinutes} min`;
}

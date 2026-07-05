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
    priceCents: 2600,
    description: 'Full race session'
  }
] as const;

export type RaceDurationMinutes = (typeof RACE_PRODUCTS)[number]['durationMinutes'];
export const MIN_CUSTOM_DURATION_MINUTES = 15;
export const MAX_CUSTOM_DURATION_MINUTES = 240;
export const CUSTOM_DURATION_BLOCK_MINUTES = 30;
export const CUSTOM_DURATION_BLOCK_PRICE_CENTS = 2600;

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

export function bookingAmountCents(durationMinutes: number, simCount: number) {
  const product = raceProductForDuration(durationMinutes);
  const fifteenMinuteProduct = raceProductForDuration(15);
  const fullThirtyMinuteBlocks = Math.floor(durationMinutes / CUSTOM_DURATION_BLOCK_MINUTES);
  const remainingMinutes = durationMinutes % CUSTOM_DURATION_BLOCK_MINUTES;
  const unitCents =
    product?.priceCents ??
    fullThirtyMinuteBlocks * CUSTOM_DURATION_BLOCK_PRICE_CENTS + (remainingMinutes > 0 ? (fifteenMinuteProduct?.priceCents ?? 1500) : 0);
  if (!supportedBookingDuration(durationMinutes) || simCount < 1) return null;
  return unitCents * simCount;
}

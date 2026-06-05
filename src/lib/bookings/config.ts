export const BOOKING_TIMEZONE = process.env.VMS_VENUE_TIMEZONE ?? 'America/Denver';
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

export function raceProductForDuration(durationMinutes: number) {
  return RACE_PRODUCTS.find((product) => product.durationMinutes === durationMinutes) ?? null;
}

export function bookingAmountCents(durationMinutes: number, simCount: number) {
  const product = raceProductForDuration(durationMinutes);
  if (!product) return null;
  return product.priceCents * simCount;
}

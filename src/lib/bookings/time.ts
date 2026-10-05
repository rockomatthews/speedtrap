import { BOOKING_TIMEZONE } from '@/lib/bookings/config';

function partsFor(date: Date, timeZone = BOOKING_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateTimeToUtc(date: string, time: string, timeZone = BOOKING_TIMEZONE) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute = 0, second = 0] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(desired);
  const actualParts = partsFor(guess, timeZone);
  const actual = Date.UTC(
    Number(actualParts.year),
    Number(actualParts.month) - 1,
    Number(actualParts.day),
    Number(actualParts.hour),
    Number(actualParts.minute),
    Number(actualParts.second)
  );
  return new Date(guess.getTime() + desired - actual);
}

export function utcToVenueDateTime(date: string | Date, timeZone = BOOKING_TIMEZONE) {
  const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function utcToVenueDate(date: string | Date, timeZone = BOOKING_TIMEZONE) {
  const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function utcToVenueTime(date: string | Date, timeZone = BOOKING_TIMEZONE) {
  const parts = partsFor(typeof date === 'string' ? new Date(date) : date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function dayOfWeekForVenueDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

/** Customer-facing booking times always use the venue timezone, never the device timezone. */
export function formatVenueBookingTime(value: string | Date, timeZone = BOOKING_TIMEZONE) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(date);
}

export function formatVenueBookingRange(start: string, end?: string | null, timeZone = BOOKING_TIMEZONE) {
  const startLabel = formatVenueBookingTime(start, timeZone);
  if (!end) return startLabel;
  if (utcToVenueDate(start, timeZone) !== utcToVenueDate(end, timeZone)) {
    return `${startLabel} – ${formatVenueBookingTime(end, timeZone)}`;
  }
  const endLabel = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(end));
  return `${startLabel} – ${endLabel}`;
}

/** VMS wall-clock timestamps without an offset are venue-local, unlike stored UTC bookings. */
export function formatVmsBookingTime(value?: string | null) {
  if (!value) return 'Time pending';
  const local = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?$)/);
  const date = local ? localDateTimeToUtc(local[1], local[2]) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time pending' : formatVenueBookingTime(date);
}

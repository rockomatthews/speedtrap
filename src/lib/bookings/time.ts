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

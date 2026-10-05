const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');
const time = loader({ '@/lib/bookings/config': { BOOKING_TIMEZONE: 'America/New_York' } })('src/lib/bookings/time.ts');

for (const deviceZone of ['America/Los_Angeles', 'America/Denver', 'America/New_York', 'UTC']) {
  test(`October 11 session stays 12:30–2:30 PM Eastern on a ${deviceZone} device`, () => {
    const previous = process.env.TZ;
    process.env.TZ = deviceZone;
    try {
      const start = time.localDateTimeToUtc('2026-10-11', '12:30').toISOString();
      assert.equal(start, '2026-10-11T16:30:00.000Z');
      assert.equal(time.formatVenueBookingRange(start, '2026-10-11T18:30:00Z'), 'Oct 11, 2026, 12:30 PM EDT – 2:30 PM EDT');
      assert.equal(time.utcToVenueDateTime(start), '2026-10-11 12:30:00');
      assert.equal(time.formatVmsBookingTime('2026-10-11 12:30:00'), 'Oct 11, 2026, 12:30 PM EDT');
      assert.equal(time.formatVmsBookingTime('2026-10-11T16:30:00Z'), 'Oct 11, 2026, 12:30 PM EDT');
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  });
}

test('winter uses EST; midnight ranges include both venue dates', () => {
  assert.equal(time.formatVenueBookingTime('2026-12-11T17:30:00Z'), 'Dec 11, 2026, 12:30 PM EST');
  assert.equal(time.formatVenueBookingRange('2026-10-12T03:30:00Z', '2026-10-12T04:30:00Z'), 'Oct 11, 2026, 11:30 PM EDT – Oct 12, 2026, 12:30 AM EDT');
  assert.equal(time.formatVmsBookingTime(null), 'Time pending');
});

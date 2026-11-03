const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');
const { applyRacingDiscount, racingDiscountSchema } = loader()('src/lib/bookings/discount.ts');
const { bookingAmountCents } = loader()('src/lib/bookings/config.ts');
const { membershipBookingPrice } = loader()('src/lib/membership.ts');
const { salesTaxCents } = loader()('src/lib/stripe/tax.ts');
const OFF = { enabled: false, percent: 25 }, ON = { enabled: true, percent: 25 };
const TODAY = '2027-01-11';
const { utcToVenueDate } = loader()('src/lib/bookings/time.ts');
test.beforeEach(t => t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-11T18:00:00Z') }));
const id = '11111111-1111-4111-8111-111111111111';

function database(initial = {}) {
  const tables = { profiles: [], race_booking_holds: [], race_bookings: [], racing_discount_settings: [{ id: 1, ...OFF }], ...initial };
  return { tables, from(table) {
    let filters = [], op = 'select', payload, columns = '*';
    const query = {
      order() { return query; },
      select(c = '*') { columns = c; return query; },
      eq(k, v) { filters.push(row => row[k] === v); return query; },
      gt(k, v) { filters.push(row => row[k] > v); return query; },
      lt(k, v) { filters.push(row => row[k] < v); return query; },
      in(k, v) { filters.push(row => v.includes(row[k])); return query; },
      insert(value) { op = 'insert'; payload = value; return query; },
      update(value) { op = 'update'; payload = value; return query; },
      delete() { op = 'delete'; return query; },
      run(single = false) {
        let rows = tables[table].filter(row => filters.every(fn => fn(row)));
        if (op === 'insert') { const row = { id, status: 'active', ...payload }; tables[table].push(row); rows = [row]; }
        if (op === 'update') rows.forEach(row => Object.assign(row, payload));
        if (op === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
        rows = rows.map(row => columns === '*' ? { ...row } : Object.fromEntries(columns.split(',').map(k => [k, row[k]])));
        return { data: single ? rows[0] ?? null : rows, error: null };
      },
      single() { return Promise.resolve(query.run(true)); }, maybeSingle() { return Promise.resolve(query.run(true)); },
      then(resolve, reject) { return Promise.resolve(query.run()).then(resolve, reject); }
    }; return query;
  } };
}

const request = (body) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const body = { customerName: 'Test Driver', customerEmail: 'driver@example.invalid', startsAt: '2027-01-11T18:00:00Z', durationMinutes: 30, partySize: 1 };
function holdRoute(db, discount = ON, user = null, checkAvailability = async () => {}) {
  return loader({
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/supabase/route-handler': { createRouteHandlerClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/rewards/server': { rewardsRpc: async()=>({}) },
    '@/lib/bookings/discount-server': { getRacingDiscount: async () => { if (discount instanceof Error) throw discount; return discount; } },
    '@/lib/bookings/advance-window': { validateBookingDateWithinWindow: () => ({ ok: true }) },
    '@/lib/bookings/availability': { assertSlotAvailable: checkAvailability },
    '@/lib/bookings/vms-sync': { syncUpcomingVmsBookings: async () => { throw new Error('VMS unavailable'); } },
    '@/lib/bookings/race-request': { validateRaceRequest: async () => ({}), raceRequestDbFields: () => ({}) }
  })('src/app/api/bookings/hold/route.ts');
}

test('off restores exact regular prices; on applies to solo, group, and extended packages before tax', () => {
  for (const minutes of [15, 30, 60, 45, 90, 240]) for (const pods of [1, 2, 3, 4]) {
    const base = bookingAmountCents(minutes, pods);
    assert.equal(applyRacingDiscount(base, OFF, TODAY, TODAY).amountCents, base);
    const quote = applyRacingDiscount(base, ON, TODAY, TODAY);
    assert.equal(quote.amountCents, base - Math.round(base / 4));
    assert.equal(quote.discountCents + quote.amountCents, base);
    assert.equal(applyRacingDiscount(base, ON, TODAY, TODAY, true).amountCents, base);
  }
  const quote = applyRacingDiscount(1500, { enabled: true, percent: 33 }, TODAY, TODAY);
  assert.equal(quote.amountCents, 1005);
  assert.equal(salesTaxCents(quote.amountCents), 80);
  assert.equal(applyRacingDiscount(1500, { enabled: true, percent: 95 }, TODAY, TODAY).amountCents, 75);
});

test('validates percentage bounds, enabled zero, decimals, nonnumbers and forged extra settings', () => {
  for (const percent of [-1, 96, 100, 101, 3.5, NaN, Infinity, '20', null]) {
    assert.equal(racingDiscountSchema.safeParse({ enabled: true, percent }).success, false);
  }
  assert.equal(racingDiscountSchema.safeParse({ enabled: true, percent: 0 }).success, false);
  assert.equal(racingDiscountSchema.safeParse({ enabled: false, percent: 0 }).success, true);
  assert.equal(racingDiscountSchema.safeParse({ enabled: true, percent: 20, category: 'merch' }).success, false);
});

test('hold recalculates trusted price, ignores submitted amounts, and snapshots discounts', async () => {
  for (const partySize of [1, 2, 4]) {
    const db = database();
    const response = await holdRoute(db).POST(request({ ...body, partySize, amountCents: 1, discountPercent: 100 }));
    assert.equal(response.status, 200);
    const { hold } = await response.json();
    const base = bookingAmountCents(30, Math.min(partySize, 4));
    const subtotal = base - Math.round(base * .25);
    assert.equal(hold.subtotal_cents, subtotal);
    assert.equal(hold.amount_cents, subtotal + salesTaxCents(subtotal));
    assert.equal(hold.racing_discount_percent, 25);
    assert.equal(db.tables.race_booking_holds[0].racing_discount_cents, base - subtotal);
    assert.equal(db.tables.race_booking_holds[0].sim_count, Math.min(partySize, 4));
  }
});

test('disabled discount and failed settings lookup cannot create a discounted hold', async () => {
  const db = database();
  let response = await holdRoute(db, OFF).POST(request(body));
  assert.equal((await response.json()).hold.amount_cents, 3024);
  assert.equal(db.tables.race_booking_holds[0].racing_discount_percent, 0);
  const failed = database();
  response = await holdRoute(failed, new Error('Prices unavailable')).POST(request(body));
  assert.equal(response.status, 409);
  assert.equal(failed.tables.race_booking_holds.length, 0);
});

test('member benefits and free credits stay exactly unchanged while discount mode is enabled', async () => {
  for (const durationMinutes of [15, 30, 60]) {
    const profile = { id, membership_status: 'active', membership_current_period_end: '2030-01-01T00:00:00Z' };
    const db = database({ profiles: [profile] });
    const response = await holdRoute(db, ON, { id, email: body.customerEmail }).POST(request({ ...body, durationMinutes }));
    assert.equal(response.status, 200);
    const { hold } = await response.json();
    const existing = membershipBookingPrice({ durationMinutes, simCount: 1, profile, creditDate: new Date(body.startsAt) });
    assert.equal(hold.subtotal_cents, existing.amountCents);
    assert.equal(hold.membership_discount_cents, existing.discountCents);
    assert.equal(hold.racing_discount_percent, 0);
    assert.equal(hold.racing_discount_cents, 0);
    assert.equal(hold.membership_free_race_applied, existing.freeRaceApplied);
  }
});

test('member benefits cannot be claimed by changing the booking email', async () => {
  const db = database({ profiles: [{ id, membership_status: 'active' }] });
  const response = await holdRoute(db, ON, { id, email: 'different@example.invalid' }).POST(request(body));
  const { hold } = await response.json();
  assert.equal(hold.membership_discount_cents, 0);
  assert.equal(hold.racing_discount_percent, 25);
});

test('admin settings reject signed-out and non-admin users; authorized updates validate and persist', async () => {
  const db = database();
  for (const status of [401, 403]) {
    const route = loader({
      '@/lib/auth/require-admin': { requireAdmin: async () => ({ ok: false, response: new Response('Denied', { status }) }) },
      '@/lib/supabase/admin': { createSupabaseAdminClient: () => { throw Error('Must not reach database'); } },
      '@/lib/bookings/discount-server': { getRacingDiscount: () => { throw Error('Must not read settings'); } }
    })('src/app/api/admin/racing-discount/route.ts');
    assert.equal((await route.GET()).status, status);
    assert.equal((await route.PATCH(request(ON))).status, status);
  }
  const route = loader({
    '@/lib/auth/require-admin': { requireAdmin: async () => ({ ok: true, user: { id } }) },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/bookings/discount-server': { getRacingDiscount: async () => OFF }
  })('src/app/api/admin/racing-discount/route.ts');
  assert.equal((await route.PATCH(request({ enabled: true, percent: 500 }))).status, 400);
  assert.equal(db.tables.racing_discount_settings[0].enabled, false);
  const response = await route.PATCH(request(ON));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).discount, ON);
  assert.equal(db.tables.racing_discount_settings[0].updated_by, id);
});

for (const method of ['card', 'crypto']) test(`${method} uses held total even after discount mode changes; receipt metadata preserved`, async () => {
  const db = database();
  await holdRoute(db).POST(request(body));
  const hold = db.tables.race_booking_holds[0];
  hold.expires_at = '2030-01-01T00:00:00Z';
  let captured;
  const stripe = { paymentIntents: { create: async (payload) => { captured = payload; return { id: 'pi_test', client_secret: 'test_secret' }; } } };
  const route = loader({
    stripe: function Stripe() { return stripe; },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/stripe/env': { getStripeEnv: () => ({ STRIPE_SECRET_KEY: 'test' }), stripeCryptoPaymentsEnabled: () => true },
    '@/lib/bookings/confirm': { confirmRaceBookingFromHold: async () => { throw Error('Not free'); } }
  })('src/app/api/bookings/payment-intent/route.ts');
  // No settings dependency at payment time: existing 10-minute quote is immutable.
  const response = await route.POST(request({ holdId: id, paymentMethod: method, amountCents: 1 }));
  assert.equal(response.status, 200);
  assert.equal(captured.amount, 2268);
  assert.equal(captured.metadata.racing_discount_percent, '25');
  assert.equal(captured.metadata.racing_discount_cents, '700');
  assert.deepEqual(captured.payment_method_types, [method]);
  const { formatVenueBookingRange } = loader()('src/lib/bookings/time.ts');
  assert.ok(captured.description.includes(formatVenueBookingRange(hold.starts_at, hold.ends_at)));
  assert.match(captured.description, /E[DS]T/);
  assert.equal((await response.json()).amountCents, 2268);
});

test('confirmation and webhook retries preserve discount and create only one booking', async () => {
  const db = database();
  await holdRoute(db).POST(request(body));
  const vmsBookings = [];
  const route = loader({
    '@/lib/supabase/env': { env: {} },
    '@/lib/bookings/availability': { assertSlotAvailable: async () => {}, allocateBookingResources: async () => {} },
    '@/lib/vms/client': { VmsClient: { fromEnv: () => ({ findCustomerByEmail: async () => ({ id: 1 }), createBooking: async value => { vmsBookings.push(value); return { id: 42 }; } }) } }
  })('src/lib/bookings/confirm.ts');
  const stripe = { paymentIntents: { retrieve: async () => ({ id: 'pi_test', status: 'succeeded', amount_received:2268, currency:'usd', metadata: { booking_hold_id: id }, latest_charge: { id: 'ch_test' } }) } };
  const input = { supabase: db, stripe, paymentIntentId: 'pi_test' };
  const booking = await route.confirmRaceBookingFromPaymentIntent(input);
  assert.equal(booking.amount_cents, 2268);
  assert.equal(booking.racing_discount_percent, 25);
  assert.equal(booking.racing_discount_cents, 700);
  assert.match(vmsBookings[0].paymentNotes, /Racing discount: 25%/);
  await route.confirmRaceBookingFromPaymentIntent(input);
  assert.equal(db.tables.race_bookings.length, 1);
  assert.equal(vmsBookings.length, 1);
});

test('legacy holds without discount fields still confirm with zero discount', async () => {
  const db = database({ race_booking_holds: [{ id, ...body, customer_name: body.customerName, customer_email: body.customerEmail, starts_at: body.startsAt, duration_minutes: 30, sim_count: 1, amount_cents: 3024, currency:'usd', status: 'active' }] });
  const route = loader({
    '@/lib/supabase/env': { env: {} },
    '@/lib/bookings/availability': { assertSlotAvailable: async () => {}, allocateBookingResources: async () => {} },
    '@/lib/vms/client': { VmsClient: { fromEnv: () => ({ findCustomerByEmail: async () => ({ id: 1 }), createBooking: async () => ({ id: 42 }) }) } }
  })('src/lib/bookings/confirm.ts');
  const stripe = { paymentIntents: { retrieve: async () => ({ id: 'pi_legacy', status: 'succeeded', amount_received:3024, currency:'usd', metadata: { booking_hold_id: id }, latest_charge: null }) } };
  const result = await route.confirmRaceBookingFromPaymentIntent({ supabase: db, stripe, paymentIntentId: 'pi_legacy' });
  assert.equal(result.racing_discount_percent, 0);
  assert.equal(result.racing_discount_cents, 0);
  assert.equal(result.amount_cents, 3024);
});

test('public price settings are uncached and fail closed if lookup fails', async () => {
  let fail = false;
  const route = loader({ '@/lib/bookings/discount-server': { getRacingDiscountForDisplay: async () => { if (fail) throw Error('DB unavailable'); return ON; } } })('src/app/api/bookings/discount/route.ts');
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { discount: ON });
  fail = true;
  assert.equal((await route.GET()).status, 503);
});

test('discounted expired holds cannot start a payment', async () => {
  const db = database({ race_booking_holds: [{ id, status: 'active', expires_at: '2000-01-01T00:00:00Z', amount_cents: 2268, racing_discount_percent: 25 }] });
  const route = loader({
    stripe: function Stripe() { throw Error('Should not create a payment'); },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/stripe/env': {}, '@/lib/bookings/confirm': {}
  })('src/app/api/bookings/payment-intent/route.ts');
  assert.equal((await route.POST(request({ holdId: id }))).status, 410);
});

test('free member booking still uses the existing no-payment confirmation path', async () => {
  let confirmed = false;
  const db = database({ race_booking_holds: [{ id, status: 'active', expires_at: '2030-01-01T00:00:00Z', amount_cents: 0, currency: 'usd', racing_discount_percent: 0 }] });
  const route = loader({
    stripe: function Stripe() { throw Error('Free member must not reach Stripe'); },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
    '@/lib/stripe/env': { stripeCryptoPaymentsEnabled: () => false },
    '@/lib/bookings/confirm': { confirmRaceBookingFromHold: async () => { confirmed = true; return { id: 'free' }; } }
  })('src/app/api/bookings/payment-intent/route.ts');
  const response = await route.POST(request({ holdId: id }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).freeBooking, true);
  assert.equal(confirmed, true);
});


test('Monday discount cannot reduce Friday four-driver bookings, even with forged date and savings', async () => {
  const db = database();
  const response = await holdRoute(db).POST(request({ ...body, partySize: 4,
    startsAt: '2027-01-15T18:00:00Z', venueDate: '2027-01-15', discountPercent: 25, amountCents: 1 }));
  assert.equal(response.status, 200);
  const { hold } = await response.json();
  assert.equal(hold.subtotal_cents, bookingAmountCents(30, 4));
  assert.equal(hold.amount_cents, bookingAmountCents(30, 4) + salesTaxCents(bookingAmountCents(30, 4)));
  assert.equal(hold.racing_discount_percent, 0);
  assert.equal(hold.racing_discount_cents, 0);
});

test('venue calendar dates control eligibility across UTC midnight, local midnight and DST', () => {
  const price = (start, now) => applyRacingDiscount(2800, ON,
    utcToVenueDate(start, 'America/New_York'), utcToVenueDate(now, 'America/New_York')).amountCents;
  assert.equal(price('2027-01-12T04:30:00Z', '2027-01-11T23:00:00Z'), 2100); // Both Monday in venue.
  assert.equal(price('2027-01-12T05:30:00Z', '2027-01-12T04:59:59Z'), 2800); // Same UTC date, different venue days.
  assert.equal(price('2027-01-12T05:30:00Z', '2027-01-12T05:00:00Z'), 2100);
  assert.equal(price('2027-03-15T03:30:00Z', '2027-03-14T06:00:00Z'), 2100); // Spring DST day.
  assert.equal(price('2027-11-08T04:30:00Z', '2027-11-07T05:30:00Z'), 2100); // Fall DST day.
  assert.equal(applyRacingDiscount(2800, ON, '2027-01-15', TODAY).amountCents, 2800);
  assert.equal(applyRacingDiscount(2800, ON, '', '').amountCents, 2800);
});

test('hold eligibility changes at venue midnight using server time', async t => {
  t.mock.timers.setTime(new Date('2027-01-12T04:59:59Z').getTime());
  const future = { ...body, startsAt: '2027-01-12T18:00:00Z' };
  let response = await holdRoute(database()).POST(request(future));
  assert.equal((await response.json()).hold.racing_discount_percent, 0);
  t.mock.timers.setTime(new Date('2027-01-12T05:00:00Z').getTime());
  response = await holdRoute(database()).POST(request(future));
  assert.equal((await response.json()).hold.racing_discount_percent, 25);
});


test('checkout does not wait for VMS, but still rejects occupied capacity', async () => {
  const open = database(); let checked = false;
  const success = await holdRoute(open, OFF, null, async () => { checked = true; }).POST(request(body));
  assert.equal(success.status, 200); assert.equal(checked, true);
  assert.equal(open.tables.race_booking_holds.length, 1);
  const full = database();
  const rejected = await holdRoute(full, OFF, null, async () => { throw new Error('That slot is no longer available.'); }).POST(request(body));
  assert.equal(rejected.status, 409); assert.equal(full.tables.race_booking_holds.length, 0);
});


test('shared pods price and reserve the selected pods, not the number of drivers', async () => {
  for (const [partySize, simCount] of [[4, 1], [8, 2], [9, 3], [4, 4]]) {
    const db = database();
    let checked;
    const response = await holdRoute(db, OFF, null, async (_db, input) => { checked = input; }).POST(request({ ...body, durationMinutes: 60, partySize, simCount }));
    assert.equal(response.status, 200);
    const stored = db.tables.race_booking_holds[0];
    const subtotal = bookingAmountCents(60, simCount);
    assert.equal(checked.simCount, simCount);
    assert.equal(stored.sim_count, simCount);
    assert.equal(stored.party_size, partySize);
    assert.equal(stored.amount_cents, subtotal + salesTaxCents(subtotal));
  }
});

test('invalid group capacity, short shared sessions, and event-sized parties cannot create holds', async () => {
  for (const [partySize, simCount, durationMinutes] of [[5, 1, 60], [9, 2, 60], [4, 1, 30], [8, 2, 15], [10, 3, 60]]) {
    const db = database();
    const response = await holdRoute(db, OFF).POST(request({ ...body, partySize, simCount, durationMinutes }));
    assert.ok(response.status >= 400);
    assert.equal(db.tables.race_booking_holds.length, 0);
  }
});


test('shared groups use actual remaining pod capacity', async () => {
  const db = database({
    booking_resources: [1,2,3,4].map(id => ({id:String(id),active:true})),
    venue_schedule_rules: [{day_of_week:1,opens_at:'12:00',closes_at:'20:00',max_sims:4,active:true}],
    venue_blackouts: [],
    race_bookings: [{status:'confirmed',starts_at:'2027-01-11T19:00:00Z',buffer_until:'2027-01-11T20:05:00Z',sim_count:2}]
  });
  const {getBookingAvailability} = loader()('src/lib/bookings/availability.ts');
  for (const [partySize,simCount,expected] of [[4,1,true],[8,2,true],[9,3,false],[4,4,false]]) {
    const result = await getBookingAvailability(db,{date:TODAY,durationMinutes:60,partySize,simCount});
    const slot=result.slots.find(s=>s.startsAt==='2027-01-11T19:00:00.000Z');
    assert.equal(slot.availableSims,2);
    assert.equal(slot.available,expected);
  }
});

test('confirmation preserves shared and pre-change group holds and sends distinct drivers and pods to VMS', async () => {
  for (const [partySize,simCount,durationMinutes] of [[4,1,60],[8,2,60],[9,3,60],[8,4,30]]) {
    const total=bookingAmountCents(durationMinutes,simCount)+salesTaxCents(bookingAmountCents(durationMinutes,simCount));
    const db=database({race_booking_holds:[{id,customer_name:'Group test',customer_email:body.customerEmail,starts_at:body.startsAt,duration_minutes:durationMinutes,party_size:partySize,sim_count:simCount,amount_cents:total,currency:'usd',status:'active'}]});
    let checked,allocated,vms;
    const route=loader({
      '@/lib/supabase/env':{env:{}},
      '@/lib/bookings/availability':{assertSlotAvailable:async (_db,input)=>{checked=input;},allocateBookingResources:async (_db,input)=>{allocated=input;}},
      '@/lib/vms/client':{VmsClient:{fromEnv:()=>({findCustomerByEmail:async()=>({id:1}),createBooking:async input=>{vms=input;return {id:42};}})}}
    })('src/lib/bookings/confirm.ts');
    const stripe={paymentIntents:{retrieve:async()=>({id:'pi_group',status:'succeeded',amount_received:total,currency:'usd',metadata:{booking_hold_id:id},latest_charge:null})}};
    const result=await route.confirmRaceBookingFromPaymentIntent({supabase:db,stripe,paymentIntentId:'pi_group'});
    assert.equal(result.party_size,partySize);
    assert.equal(result.sim_count,simCount);
    assert.equal(result.amount_cents,total);
    assert.equal(checked.simCount,simCount);
    assert.equal(allocated.simCount,simCount);
    assert.equal(vms.groupSize,partySize);
    assert.equal(vms.numberOfPods,simCount);
  }
});

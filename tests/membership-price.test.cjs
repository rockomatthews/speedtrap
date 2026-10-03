const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const validPrice = { id: 'price_twenty_five', active: true, currency: 'usd', unit_amount: 2500, recurring: { interval: 'month', interval_count: 1 } };
function setup(price = validPrice, signedIn = true) {
  let checkout;
  const route = loader({
    stripe: function Stripe() { return {
      prices: { retrieve: async () => price },
      checkout: { sessions: { create: async input => { checkout = input; return { url: 'https://checkout.stripe.com/test' }; } } }
    }; },
    '@/lib/supabase/env': { env: { NEXT_PUBLIC_SITE_URL: 'https://www.speedtrapracing.com' } },
    '@/lib/stripe/env': { getStripeMembershipEnv: () => ({ STRIPE_SECRET_KEY: 'test-placeholder', STRIPE_MEMBERSHIP_PRICE_ID: 'price_twenty_five' }) },
    '@/lib/supabase/route-handler': { createRouteHandlerClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'member', email: 'member@example.invalid' } : null } }) } }) },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }
  })('src/app/api/stripe/membership/checkout/route.ts');
  return { route, checkout: () => checkout };
}
const request = () => new Request('https://www.speedtrapracing.com/api/stripe/membership/checkout', { method: 'POST', body: '{}' });

test('$25 monthly membership checkout includes the existing $2.00 recurring tax', async () => {
  const ctx = setup();
  assert.equal((await ctx.route.POST(request())).status, 200);
  const session = ctx.checkout();
  assert.deepEqual(session.line_items[0], { price: 'price_twenty_five', quantity: 1 });
  assert.equal(session.line_items[1].price_data.unit_amount, 200);
  assert.deepEqual(session.line_items[1].price_data.recurring, { interval: 'month', interval_count: 1 });
  assert.equal(session.subscription_data.metadata.total_cents, '2700');
});

test('old $45 and $20, inactive, annual, multi-month or non-USD prices cannot start checkout', async () => {
  for (const change of [
    { unit_amount: 4500 }, { unit_amount: 2000 }, { active: false }, { currency: 'eur' },
    { recurring: { interval: 'year', interval_count: 1 } },
    { recurring: { interval: 'month', interval_count: 2 } }, { recurring: null }
  ]) {
    const ctx = setup({ ...validPrice, ...change });
    assert.equal((await ctx.route.POST(request())).status, 500);
    assert.equal(ctx.checkout(), undefined);
  }
});

test('signed-out requests cannot start membership checkout', async () => {
  const ctx = setup(validPrice, false);
  assert.equal((await ctx.route.POST(request())).status, 401);
  assert.equal(ctx.checkout(), undefined);
});

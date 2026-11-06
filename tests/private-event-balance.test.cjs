const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');
const id = '00000000-0000-4000-8000-000000000001';
function fixture(overrides = {}, authorized = true) {
  const row = { id, status: 'deposit_paid', total_amount_cents: 27500, deposit_amount_cents: 13750, balance_paid_at: null, ...overrides };
  let writes = 0;
  let filters = [];
  const db = { from() {
    let update = null;
    const conditions = [];
    const q = {
      select() { return q; },
      eq(k,v) { conditions.push([k,v]); return q; },
      is(k,v) { conditions.push([k,v]); return q; },
      update(v) { update = v; return q; },
      async maybeSingle() {
        if (!update) return { data: {...row}, error: null };
        filters = conditions;
        if (!conditions.every(([k,v]) => row[k] === v)) return {data:null,error:null};
        Object.assign(row, update); writes++; return {data:{id},error:null};
      }
    }; return q;
  }};
  const { POST } = loader({
    '@/lib/auth/require-admin': { requireAdmin: async () => authorized ? {ok:true,user:{id:'staff-id'}} : {ok:false,response:Response.json({}, {status:403})} },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => db }
  })('src/app/api/admin/private-event-deposits/[id]/balance/route.ts');
  return { row, writes:()=>writes, filters:()=>filters,
    submit: (body = {}) => POST(new Request('https://example.test', {method:'POST',body:JSON.stringify({receiptReference:'TOAST-123',expectedBalanceCents:13750,paymentCollected:true,...body})}), {params:Promise.resolve({id})}) };
}
test('record Toast payment with audit fields without changing Stripe deposit status', async () => {
  const f=fixture(); assert.equal((await f.submit()).status,200);
  assert.equal(f.row.balance_paid_amount_cents,13750); assert.equal(f.row.balance_paid_by,'staff-id');
  assert.equal(f.row.toast_receipt_reference,'TOAST-123'); assert.ok(f.row.balance_paid_at);
  assert.equal(f.row.status,'deposit_paid'); assert.equal(f.row.deposit_amount_cents,13750);
  assert.ok(f.filters().some(([k,v])=>k==='balance_paid_at'&&v===null));
  assert.ok(f.filters().some(([k,v])=>k==='status'&&v==='deposit_paid'));
});
test('retry preserves original receipt and timestamp', async () => {
  const f=fixture(); await f.submit(); const original={...f.row};
  assert.equal((await f.submit({receiptReference:'DIFFERENT'})).status,200);
  assert.deepEqual(f.row,original); assert.equal(f.writes(),1);
});
test('reject unauthorised users and incomplete payment confirmation', async () => {
  assert.equal((await fixture({},false).submit()).status,403);
  for(const body of [{paymentCollected:false},{receiptReference:'  '},{expectedBalanceCents:0},{extra:'field'}]) {
    const f=fixture();assert.equal((await f.submit(body)).status,400);assert.equal(f.writes(),0);
  }
});
test('reject unpaid, refunded and cancelled events and changed balances', async () => {
  for (const status of ['quote_sent','refunded','cancelled']) {
    const f=fixture({status});assert.equal((await f.submit()).status,409);assert.equal(f.writes(),0);
  }
  const f=fixture({total_amount_cents:30000});assert.equal((await f.submit()).status,409);assert.equal(f.writes(),0);
});

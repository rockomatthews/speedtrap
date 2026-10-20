const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs');
const { installmentDues, leagueRegistrationAmount, WINTER_SERIES_SLUG } = load()('src/lib/leagues/winter-series.ts');
const league = { slug: WINTER_SERIES_SLUG, weekly_fee_cents: 4000, full_season_fee_cents: 32000 };
test('Winter checkout charges $50 credited deposit or $320 full season, preserving other leagues', () => {
 assert.equal(leagueRegistrationAmount(league, 'installments'), 5000);
 assert.equal(leagueRegistrationAmount(league, 'full_season'), 32000);
 assert.equal(leagueRegistrationAmount({...league, slug:'old-season',full_season_fee_cents:30000}, 'installments'), 4000);
 assert.equal(leagueRegistrationAmount({...league, slug:'old-season',full_season_fee_cents:30000}, 'full_season'), 30000);
});
test('$50 deposit pays week one, credits $10 to week two, leaves exactly $270', () => {
 const dues=installmentDues(8,4000,5000);
 assert.equal(dues.length,8);assert.equal(dues[0].status,'paid');assert.equal(dues[0].amount_cents,4000);
 assert.equal(dues[1].status,'pending');assert.equal(dues[1].amount_cents,3000);assert.match(dues[1].notes,/10.00/);
 assert.equal(dues.filter(d=>d.status==='pending').reduce((sum,d)=>sum+d.amount_cents,0),27000);
 assert.deepEqual(installmentDues(8,4000,5000),dues);
});
test('legacy $40 registration keeps seven full weekly dues',()=>{
 const dues=installmentDues(8,4000,4000);assert.equal(dues.filter(d=>d.status==='paid').length,1);assert.equal(dues[1].amount_cents,4000);
});

test('registration endpoint sends the authoritative deposit and full-season prices to Stripe', async()=>{
 for(const [paymentOption,expected] of [['installments',5000],['full_season',32000]]) {
  let checkout;
  const db={from(table){let inserted=false;const q={select(){return q},eq(){return q},in(){return q},or(){return q},limit(){return q},update(){return q},upsert(){return q},insert(){inserted=true;return q},single(){return Promise.resolve({data:{id:'reg'},error:null})},maybeSingle(){return Promise.resolve({data:table==='leagues'?{...league,id:'league',name:'Winter',status:'active',visibility:'public',season_weeks:8,team_count:8,roster_size:4}:table==='profiles'?{id:'user',vms_customer_id:1}:null,error:null})},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};
  class Stripe {checkout={sessions:{create:async value=>{checkout=value;return{id:'checkout-test',url:'https://example.invalid/checkout'}}}}}
  const {POST}=load({
   stripe:Stripe,
   '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},
   '@/lib/supabase/env':{env:{NEXT_PUBLIC_SITE_URL:'https://example.invalid'}},
   '@/lib/supabase/route-handler':{createRouteHandlerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user',email:'test@example.invalid'}}})}})},
   '@/lib/stripe/env':{getStripeEnv:()=>({STRIPE_SECRET_KEY:'test-only'})},
   '@/lib/vms/client':{VmsClient:{fromEnv:()=>({getCustomer:async()=>({id:1,name:'Test Driver'})})}}
  })('src/app/api/leagues/[slug]/register/route.ts');
  const response=await POST(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({driverName:'Test Driver',paymentOption,amountCents:1})}),{params:Promise.resolve({slug:league.slug})});
  assert.equal(response.status,200);assert.equal(checkout.line_items[0].price_data.unit_amount,expected);
  assert.equal(checkout.line_items[1].price_data.unit_amount,Math.round(expected*.08));
 }
});

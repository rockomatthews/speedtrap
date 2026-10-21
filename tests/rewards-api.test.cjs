const test=require('node:test');
const assert=require('node:assert/strict');
const loader=require('./load-ts.cjs');
const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.invalid'};
const request=body=>new Request('https://example.invalid/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function routes(who=user,session={}){
 const calls=[];
 const load=loader({
  '@/lib/supabase/route-handler':{createRouteHandlerClient:async()=>({auth:{getUser:async()=>({data:{user:who}})}})},
  '@/lib/supabase/admin':{createSupabaseAdminClient:()=>({})},
  '@/lib/rewards/server':{rewardsRpc:async(...args)=>calls.push(args),walletSnapshot:async id=>({id}),syncWalletPayment:async(...args)=>calls.push(args)},
  '@/lib/stripe/env':{getStripeEnv:()=>({STRIPE_SECRET_KEY:'test'})},
  stripe:class{checkout={sessions:{retrieve:async()=>session}}}
 });
 return {route:load('src/app/api/rewards/route.ts'),calls};
}
test('wallet API denies anonymous reads and mutations',async()=>{const {route,calls}=routes(null);assert.equal((await route.GET()).status,401);assert.equal((await route.POST(request({action:'redeem',key:user.id}))).status,401);assert.equal(calls.length,0);});
test('redemption uses verified owner, never submitted profile ID',async()=>{const {route,calls}=routes();const r=await route.POST(request({action:'redeem',key:user.id,profileId:'attacker'}));assert.equal(r.status,200);assert.equal(calls[0][2].p_profile,user.id);assert.deepEqual(await r.json(),{id:user.id});});
test('topup confirmation rejects another customer and unpaid sessions',async()=>{
 let x=routes(user,{metadata:{profile_id:'other',source:'speedtrap_wallet_topup'},payment_status:'paid',payment_intent:'pi_fake'});assert.equal((await x.route.POST(request({action:'confirm_topup',sessionId:'cs_fake'}))).status,403);assert.equal(x.calls.length,0);
 x=routes(user,{metadata:{profile_id:user.id,source:'speedtrap_wallet_topup'},payment_status:'unpaid',payment_intent:'pi_fake'});assert.equal((await x.route.POST(request({action:'confirm_topup',sessionId:'cs_fake'}))).status,409);assert.equal(x.calls.length,0);
});
test('admin API rejects nonadmins before accessing ledger',async()=>{
 let touched=false;const route=loader({'@/lib/auth/require-admin':{requireAdmin:async()=>({ok:false,response:new Response(null,{status:403})})},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>{touched=true;}},'@/lib/rewards/server':{rewardsRpc:()=>{touched=true;}}})('src/app/api/admin/rewards/route.ts');
 assert.equal((await route.GET(new Request('https://example.invalid/api'))).status,403);assert.equal((await route.POST(request({action:'adjust'}))).status,403);assert.equal(touched,false);
});
test('credit package values are server-controlled and require authentication',async()=>{
 const load=who=>loader({'@/lib/supabase/route-handler':{createRouteHandlerClient:async()=>({auth:{getUser:async()=>({data:{user:who}})}})},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>{throw Error('Must not reach database');}},'@/lib/stripe/env':{},'@/lib/supabase/env':{env:{}}})('src/app/api/rewards/topup/route.ts');
 assert.equal((await load(null).POST(request({amountCents:2500,key:user.id}))).status,401);assert.equal((await load(user).POST(request({amountCents:1,key:user.id}))).status,400);
});
test('retrying a completed credit purchase never creates another charge',async()=>{
 let creates=0;
 const db={from:table=>{const result={eq(){return result;},select(){return result;},upsert:async()=>({error:null}),single:async()=>({data:table==='reward_settings'?{wallet_sales_enabled:true}:{id:user.id,profile_id:user.id,amount_cents:2500,status:'paid'}})};return result;}};
 const route=loader({'@/lib/supabase/route-handler':{createRouteHandlerClient:async()=>({auth:{getUser:async()=>({data:{user}})}})},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},'@/lib/stripe/env':{getStripeEnv:()=>({STRIPE_SECRET_KEY:'test'})},'@/lib/supabase/env':{env:{}},stripe:class{checkout={sessions:{create:async()=>{creates++;}}}}})('src/app/api/rewards/topup/route.ts');
 assert.equal((await route.POST(request({amountCents:2500,key:user.id}))).status,409);assert.equal(creates,0);
});

test('automatic rewards cron requires secret and still awards when hold reconciliation fails',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='cron-test';let awards=0,holds=0;
 const route=loader({'@/lib/supabase/admin':{createSupabaseAdminClient:()=>({})},'@/lib/rewards/server':{rewardsRpc:async(db,name)=>{assert.equal(name,'rewards_complete_due');awards++;return 2;},releaseExpiredWalletHolds:async()=>{holds++;throw Error('Stripe unavailable');}}})('src/app/api/cron/rewards/route.ts');
 try {
  assert.equal((await route.GET(new Request('https://example.invalid'))).status,401);assert.equal(awards,0);assert.equal(holds,0);
  const response=await route.GET(new Request('https://example.invalid',{headers:{authorization:'Bearer cron-test'}}));
  assert.equal(response.status,500);assert.equal((await response.json()).completed,2);assert.equal(awards,1);assert.equal(holds,1);
 }finally{if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});

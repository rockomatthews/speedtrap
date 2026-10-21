// Opt-in real Stripe TEST-mode integration. Never loads the site's environment.
// Start, complete the printed hosted Checkout URL with Stripe's test card, then
// visit /verify to run remaining API/payment/refund tests. No live services used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {rewardsTestDb} from './support/rewards-test-db.mjs';
const require=createRequire(import.meta.url),loader=require('./load-ts.cjs');
const config=fs.readFileSync(process.env.HOME+'/.config/stripe/config.toml','utf8');
const stripeProfile=config.match(/\[default\]([\s\S]*?)(?=\n\[|$)/)?.[1]??'';
const key=stripeProfile.split('\n').find(l=>l.trim().startsWith('test_mode_api_key'))?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g,'');
assert.match(key??'',/^(sk|rk)_test_/,'A Stripe test credential is required');
const stripe=new Stripe(key),account=await stripe.accounts.retrieve();
assert.equal(account.id,'acct_1QAK9gRrm3SnxLCw','Wrong Stripe account');
const {db,pg,query}=await rewardsTestDb();
const user={id:randomUUID(),email:'rewards-test@example.invalid'},staff=randomUUID();
await query('insert into profiles(id,display_name) values($1,$2),($3,$4)',[user.id,'Isolated test racer',staff,'Isolated staff']);
await query('update reward_settings set enabled=true,wallet_sales_enabled=true');
let resources=0,vmsId=100,failCapacity=false;
const webhookSecret='whsec_'+randomUUID();
const load=loader({
 '@/lib/supabase/admin':{createSupabaseAdminClient:()=>db},
 '@/lib/supabase/route-handler':{createRouteHandlerClient:async()=>({auth:{getUser:async()=>({data:{user}})}})},
 '@/lib/supabase/profile':{getAuthedProfile:async()=>({user,profile:{id:user.id,role:'admin'}})},
 '@/lib/supabase/env':{env:{NEXT_PUBLIC_SITE_URL:'http://localhost:4327',VMS_HOME_VENUE_ID:1}},
 '@/lib/stripe/env':{getStripeEnv:()=>({STRIPE_SECRET_KEY:key}),getStripeWebhookEnv:()=>({STRIPE_SECRET_KEY:key,STRIPE_WEBHOOK_SECRET:webhookSecret}),stripeCryptoPaymentsEnabled:()=>false},
 '@/lib/bookings/availability':{assertSlotAvailable:async()=>{if(failCapacity)throw Error('Test capacity conflict');},allocateBookingResources:async()=>{resources++;},releaseBookingResources:async()=>{resources--; }},
 '@/lib/bookings/race-request':{raceRequestDbFields:()=>({}),raceRequestVmsFields:()=>({})},
 '@/lib/vms/client':{VmsClient:{fromEnv:()=>({findCustomerByEmail:async()=>({id:1}),createBooking:async()=>({id:++vmsId}),updateBooking:async()=>({})})}},
 '@/lib/stripe/membership-sync':{stripeId:x=>typeof x==='string'?x:x?.id??null}
});
const topupRoute=load('src/app/api/rewards/topup/route.ts');
const payRoute=load('src/app/api/bookings/payment-intent/route.ts');
const cancelRoute=load('src/app/api/bookings/[id]/cancel/route.ts');
const rewards=load('src/lib/rewards/server.ts');
const confirm=load('src/lib/bookings/confirm.ts');
const webhook=load('src/app/api/stripe/webhook/route.ts');
const request=body=>new Request('http://localhost:4327/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const check=async response=>{const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
const rpc=async(name,args)=>rewards.rewardsRpc(db,name,args);
const wallet=async()=>(await query('select * from racing_wallets where profile_id=$1',[user.id]))[0];
const evidence={account:account.id,mode:'test',startedAt:new Date().toISOString(),checks:[],stripeObjects:[]};
function pass(label){evidence.checks.push(label);console.log('PASS: '+label);}
async function deliver(type,object,eventId='evt_test_'+randomUUID()){
 const payload=JSON.stringify({id:eventId,type,livemode:false,data:{object}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret:webhookSecret});
 return webhook.POST(new Request('http://localhost:4327/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}));
}
const topupId=randomUUID();
const checkout=await check(await topupRoute.POST(request({amountCents:2500,key:topupId})));
const topup=(await query('select * from racing_wallet_topups where id=$1',[topupId]))[0];
const session=await stripe.checkout.sessions.retrieve(topup.stripe_checkout_session_id);assert.equal(session.livemode,false);assert.equal(session.amount_total,2500);
const retry=await check(await topupRoute.POST(request({amountCents:2500,key:topupId})));assert.equal(retry.url,checkout.url);
assert.equal((await query('select count(*)::int as n from racing_wallet_ledger'))[0].n,0);
pass('Hosted checkout created by actual top-up route, retry reuses session, unpaid purchase grants no credits');
evidence.stripeObjects.push({checkout:session.id});
console.log('CHECKOUT_URL='+checkout.url);
async function newHold(subtotal,usePurchased=true,useRewards=false){
 const h=randomUUID(),start=new Date(Date.now()+3*86400000),end=new Date(start.getTime()+3600000);
 await query(`insert into race_booking_holds(id,profile_id,customer_name,customer_email,customer_phone,duration_minutes,sim_count,party_size,starts_at,ends_at,buffer_until,amount_cents) values($1,$2,'Isolated test racer',$3,'',60,1,1,$4,$5,$5,$6)`,[h,user.id,user.email,start.toISOString(),end.toISOString(),subtotal+Math.round(subtotal*.08)]);
 await rpc('rewards_prepare_hold',{p_hold:h,p_profile:user.id,p_use_purchased:usePurchased,p_use_rewards:useRewards,p_subtotal:subtotal});return h;
}
async function paymentFor(h){const result=await check(await payRoute.POST(request({holdId:h})));const row=(await query('select * from race_booking_holds where id=$1',[h]))[0];return {result,row};}
async function verify(){
 const paid=await stripe.checkout.sessions.retrieve(session.id);assert.equal(paid.payment_status,'paid','Complete hosted test checkout first');assert.equal(paid.livemode,false);
 const pi=await stripe.paymentIntents.retrieve(paid.payment_intent);assert.equal(pi.livemode,false);assert.equal(pi.amount_received,2500);
 await check(await deliver('checkout.session.completed',paid));await check(await deliver('checkout.session.completed',paid));await check(await deliver('payment_intent.succeeded',pi));
 assert.equal(Number((await wallet()).purchased_cents),2500);assert.equal(Number((await wallet()).points_units),0);pass('Hosted test payment completed; signed checkout and payment webhooks credit $25 exactly once');
 assert.equal((await topupRoute.POST(request({amountCents:2500,key:topupId}))).status,409);pass('Paid top-up cannot create another checkout');
 const h=await newHold(4000);const {row}=await paymentFor(h);assert.equal(row.wallet_purchased_cents,2500);assert.equal(row.amount_cents,1820);
 const mixed=await stripe.paymentIntents.confirm(row.stripe_payment_intent_id,{payment_method:'pm_card_visa'});assert.equal(mixed.livemode,false);assert.equal(mixed.status,'succeeded');
 await check(await deliver('payment_intent.succeeded',mixed));await check(await deliver('payment_intent.succeeded',mixed));
 const booking=(await query('select * from race_bookings where wallet_hold_id=$1',[h]))[0];assert.equal(booking.status,'confirmed');assert.equal(booking.wallet_purchased_cents,2500);assert.equal(resources,1);assert.equal(Number((await wallet()).purchased_cents),0);pass('Mixed checkout: $25 credits + $18.20 Stripe test card; duplicate webhook creates one booking');
 const cancelled=await check(await cancelRoute.POST(request({}),{params:Promise.resolve({id:booking.id})}));assert.equal(cancelled.booking.status,'refunded');const mixedAfter=await stripe.paymentIntents.retrieve(mixed.id,{expand:['latest_charge']});assert.equal(mixedAfter.latest_charge.amount_refunded,1820);await rewards.syncRewardRefund(stripe,mixed.id);assert.equal(Number((await wallet()).purchased_cents),2500);assert.equal(resources,0);pass('Actual cancellation route refunds $18.20 test card, restores $25 credits, releases resources once');
 const wh=await newHold(1000);const wp=await paymentFor(wh);assert.equal(wp.result.freeBooking,true);assert.equal(wp.result.booking.payment_method,'wallet');assert.equal(wp.row.stripe_payment_intent_id,null);assert.equal(Number((await wallet()).purchased_cents),1420);await check(await cancelRoute.POST(request({}),{params:Promise.resolve({id:wp.result.booking.id})}));assert.equal(Number((await wallet()).purchased_cents),2500);pass('Wallet-only checkout confirms without Stripe charge; cancellation restores $10.80');
 const declineHold=await newHold(4000);const dp=await paymentFor(declineHold);
 await assert.rejects(stripe.paymentIntents.confirm(dp.row.stripe_payment_intent_id,{payment_method:'pm_card_chargeDeclined'}),e=>e.type==='StripeCardError');assert.equal((await query('select count(*)::int as n from race_bookings where wallet_hold_id=$1',[declineHold]))[0].n,0);await stripe.paymentIntents.cancel(dp.row.stripe_payment_intent_id);await rpc('rewards_release_hold',{p_hold:declineHold});assert.equal(Number((await wallet()).purchased_cents),2500);pass('Declined test card creates no booking; cancelled payment releases reserved credit');
 const partialHold=await newHold(4000,false);const pp=await paymentFor(partialHold);const ppi=await stripe.paymentIntents.confirm(pp.row.stripe_payment_intent_id,{payment_method:'pm_card_visa'});await check(await deliver('payment_intent.succeeded',ppi));const pb=(await query('select * from race_bookings where wallet_hold_id=$1',[partialHold]))[0];
 await query("update race_bookings set ends_at=now()-interval '1 minute' where id=$1",[pb.id]);await rpc('rewards_complete',{p_booking:pb.id,p_actor:staff});assert.equal(Number((await wallet()).points_units),4000);
 await stripe.refunds.create({payment_intent:ppi.id,amount:1080});await rewards.syncRewardRefund(stripe,ppi.id);await rewards.syncRewardRefund(stripe,ppi.id);assert.equal(Number((await wallet()).points_units),3000);await stripe.refunds.create({payment_intent:ppi.id});await rewards.syncRewardRefund(stripe,ppi.id);assert.equal(Number((await wallet()).points_units),0);pass('Completed racing earns 40 points; real partial/full Stripe test refunds reverse 10 then 30 points once');
 await stripe.refunds.create({payment_intent:pi.id});await rewards.syncWalletPayment(stripe,pi.id);await rewards.syncWalletPayment(stripe,pi.id);assert.equal(Number((await wallet()).purchased_cents),0);pass('Original $25 test credit purchase refund removes purchased balance exactly once');
 const bad=await webhook.POST(new Request('http://localhost:4327/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'invalid'},body:'{}'}));assert.equal(bad.status,400);pass('Invalid webhook signature rejected');
 evidence.stripeObjects.push({topupPayment:pi.id,mixedPayment:mixed.id,partialRefundPayment:ppi.id,declinedPayment:dp.row.stripe_payment_intent_id});evidence.finishedAt=new Date().toISOString();evidence.finalWallet=await wallet();
 fs.writeFileSync('/tmp/speedtrap-rewards-stripe-verification.json',JSON.stringify(evidence,null,2));console.log('VERIFICATION_COMPLETE');return evidence;
}
let verified;
const server=http.createServer(async(req,res)=>{try{
 if(req.url==='/verify'){verified??=verify();const result=await verified;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
 else if(req.url?.startsWith('/dashboard/rewards')){res.setHeader('Content-Type','text/html');res.end('<h1>Stripe test checkout returned</h1><p>Isolated SpeedTrap verification. No production balance was changed.</p>');}
 else{res.statusCode=404;res.end('Not found');}
 }catch(e){console.error('TEST_FAILED',e.message);res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
server.listen(4327,'127.0.0.1',()=>console.log('Isolated verifier listening on http://127.0.0.1:4327'));

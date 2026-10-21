// Run with REWARDS_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/rewards-postgres.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID as id} from 'node:crypto';
const {PGlite}=await import(process.env.REWARDS_PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table profiles(id uuid primary key,email text);
create table race_booking_holds(id uuid primary key,profile_id uuid,amount_cents integer,status text default 'active',expires_at timestamptz default now()+interval '1 hour',starts_at timestamptz default now()-interval '2 hours',racing_discount_percent integer default 0,payment_method_requested text default 'card');
create table race_bookings(id uuid primary key,profile_id uuid,customer_email text,amount_cents integer,status text default 'confirmed',starts_at timestamptz default now()-interval '2 hours',ends_at timestamptz default now()-interval '1 hour',payment_method text);
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261021174410_racing_rewards_wallet.sql',import.meta.url),'utf8'));
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const rpc=async(name,args)=>q(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args);
const user=id(),other=id(),staff=id();
for(const u of [user,other,staff])await q('insert into profiles values($1,$2)',[u,u+'@example.invalid']);
const post=(u,bucket,amount,key)=>rpc('rewards_post',[u,bucket,amount,key,'test',staff]);
const wallet=async(u=user)=>(await q('select * from racing_wallets where profile_id=$1',[u]))[0];
const hold=async(u,subtotal,discount=0)=>{const h=id();await q('insert into race_booking_holds(id,profile_id,amount_cents,racing_discount_percent) values($1,$2,$3,$4)',[h,u,subtotal+Math.round(subtotal*.08),discount]);return h;};
const prepare=(h,u,paid,promo,subtotal)=>rpc('rewards_prepare_hold',[h,u,paid,promo,subtotal]);
const book=async(h,u)=>{const b=id();await q(`insert into race_bookings(id,profile_id,customer_email,amount_cents,wallet_hold_id) select $1,$2,$3,amount_cents,id from race_booking_holds where id=$4`,[b,u,u+'@example.invalid',h]);return b;};
await db.exec('update reward_settings set enabled=true');
await post(user,'purchased',5000,'seed');await post(user,'purchased',5000,'seed');assert.equal(Number((await wallet()).purchased_cents),5000);
await assert.rejects(post(other,'purchased',5000,'seed'),/conflict/);
await post(user,'points',10000,'points');await rpc('rewards_convert',[user,'11111111-1111-4111-8111-111111111111']);await rpc('rewards_convert',[user,'11111111-1111-4111-8111-111111111111']);assert.equal(Number((await wallet()).promo_cents),500);assert.equal(Number((await wallet()).points_units),0);
const h=await hold(user,4000);await prepare(h,user,true,true,4000);
let row=(await q('select * from race_booking_holds where id=$1',[h]))[0];assert.equal(row.amount_cents,0);assert.equal(row.wallet_purchased_cents,3780);assert.equal(row.wallet_promo_cents,500);assert.equal(row.rewards_subtotal_cents,3500);
await assert.rejects(prepare(h,user,true,true,4000),/already/);
await assert.rejects(rpc('rewards_lock_payment',[h,other,'card']),/unavailable/);
await rpc('rewards_lock_payment',[h,user,'card']);
const b=await book(h,user);await assert.rejects(book(h,user),/no longer|duplicate/);
await rpc('rewards_complete',[b,staff]);await rpc('rewards_complete',[b,staff]);assert.equal(Number((await wallet()).points_units),3500);
await q("update race_bookings set status='cancelled' where id=$1",[b]);assert.equal(Number((await wallet()).purchased_cents),5000);assert.equal(Number((await wallet()).promo_cents),500);assert.equal(Number((await wallet()).points_units),0);
await rpc('rewards_refund',[b,0,true]);assert.equal(Number((await wallet()).purchased_cents),5000);
const expired=await hold(user,1000);await prepare(expired,user,true,false,1000);await rpc('rewards_release_hold',[expired]);await rpc('rewards_release_hold',[expired]);assert.equal(Number((await wallet()).purchased_cents),5000);await assert.rejects(book(expired,user),/no longer/);
const discount=await hold(user,2000,25);await assert.rejects(prepare(discount,user,false,true,2000),/discount mode/);
const forged=await hold(user,2000);await assert.rejects(prepare(forged,user,true,false,1),/Invalid quote/);
// Concurrent reservations never exceed the account balance.
const h1=await hold(user,4000),h2=await hold(user,4000);await Promise.all([prepare(h1,user,true,false,4000),prepare(h2,user,true,false,4000)]);
const amounts=await q('select sum(purchased_cents) as total from racing_wallet_reservations where hold_id in ($1,$2)',[h1,h2]);assert.equal(Number(amounts[0].total),5000);assert.equal(Number((await wallet()).purchased_cents),0);
await rpc('rewards_release_hold',[h1]);await rpc('rewards_release_hold',[h2]);
// Fractional-card remainder leaves at least 50 cents; no invented wallet funds.
await post(other,'purchased',1079,'tiny');const tiny=await hold(other,1000);await prepare(tiny,other,true,false,1000);row=(await q('select * from race_booking_holds where id=$1',[tiny]))[0];assert.equal(row.amount_cents,50);assert.equal(row.wallet_purchased_cents,1030);await rpc('rewards_release_hold',[tiny]);
// Partial refunds use cumulative refunded total, repeated/out-of-order events cannot over-reverse.
const partial=await hold(user,4000);await prepare(partial,user,false,false,4000);const pb=await book(partial,user);await rpc('rewards_complete',[pb,staff]);
await rpc('rewards_refund',[pb,1080,false]);assert.equal(Number((await wallet()).points_units),3000);await rpc('rewards_refund',[pb,1080,false]);await rpc('rewards_refund',[pb,540,false]);assert.equal(Number((await wallet()).points_units),3000);
await rpc('rewards_refund',[pb,2160,false]);assert.equal(Number((await wallet()).points_units),2000);
// Refund after points are spent records debt and blocks further reward redemption.
await post(user,'points',8000,'extra');await rpc('rewards_convert',[user,id()]);await rpc('rewards_refund',[pb,4320,true]);assert.equal(Number((await wallet()).points_units),-2000);
const debt=await hold(user,4000);await assert.rejects(prepare(debt,user,false,true,4000),/resolve/);
// Purchased top-ups are validated, idempotent, and refund in their own bucket.
const topup=id();await q('insert into racing_wallet_topups(id,profile_id,amount_cents) values($1,$2,2500)',[topup,other]);const before=Number((await wallet(other)).purchased_cents);
await assert.rejects(rpc('rewards_topup_paid',[topup,'pi_test',100,0]),/mismatch/);await rpc('rewards_topup_paid',[topup,'pi_test',2500,0]);await rpc('rewards_topup_paid',[topup,'pi_test',2500,0]);assert.equal(Number((await wallet(other)).purchased_cents),before+2500);
await rpc('rewards_topup_paid',[topup,'pi_test',2500,1000]);await rpc('rewards_topup_paid',[topup,'pi_test',2500,500]);assert.equal(Number((await wallet(other)).purchased_cents),before+1500);
// Promotion checks the scheduled session, and rescheduling removes the bonus.
await q("insert into reward_promotions(name,starts_at,ends_at) values('Double',now()-interval '3 hours',now()-interval '1 hour')");
const promo=await hold(other,3000);await prepare(promo,other,false,false,3000);const promoBooking=await book(promo,other);row=(await q('select * from race_bookings where id=$1',[promoBooking]))[0];assert.equal(row.rewards_rate,2);
await q("update race_bookings set starts_at=now()+interval '1 day' where id=$1",[promoBooking]);row=(await q('select * from race_bookings where id=$1',[promoBooking]))[0];assert.equal(row.rewards_rate,1);
// Pausing earning preserves balances and allows redemption.
await db.exec('update reward_settings set enabled=false');const off=await hold(other,1000);await prepare(off,other,false,false,1000);assert.equal((await q('select rewards_rate from race_booking_holds where id=$1',[off]))[0].rewards_rate,0);
// Free and future sessions cannot generate spend rewards; refunded sessions cannot be completed later.
const free=await hold(other,0);await prepare(free,other,false,false,0);const fb=await book(free,other);const pointBefore=Number((await wallet(other)).points_units);await rpc('rewards_complete',[fb,staff]);assert.equal(Number((await wallet(other)).points_units),pointBefore);
const future=await hold(other,3000);await prepare(future,other,false,false,3000);const fub=await book(future,other);await q("update race_bookings set ends_at=now()+interval '1 day' where id=$1",[fub]);await assert.rejects(rpc('rewards_complete',[fub,staff]),/finished/);
const refundFirst=await hold(other,3000);await prepare(refundFirst,other,false,false,3000);const rfb=await book(refundFirst,other);await rpc('rewards_refund',[rfb,3240,true]);await assert.rejects(rpc('rewards_complete',[rfb,staff]),/Refunded/);
// Referral eligibility, first-session threshold, duplicate completion, cap, and reversal.
await db.exec('update reward_settings set enabled=true,referrals_enabled=true');
const referrer=id();await q('insert into profiles values($1,$2)',[referrer,'ref@example.invalid']);await post(referrer,'points',0,'ref-init');const code=(await wallet(referrer)).referral_code;
await assert.rejects(rpc('rewards_refer',[referrer,code,'ref@example.invalid']),/Invalid/);
const referredBookings=[];
for(let i=0;i<6;i++){const u=id();await q('insert into profiles values($1,$2)',[u,u+'@example.invalid']);await rpc('rewards_refer',[u,code,u+'@example.invalid']);await assert.rejects(rpc('rewards_refer',[u,code,u+'@example.invalid']),/already/);const h=await hold(u,3000);await prepare(h,u,false,false,3000);const b=await book(h,u);await rpc('rewards_complete',[b,staff]);await rpc('rewards_complete',[b,staff]);referredBookings.push(b);}
assert.equal(Number((await wallet(referrer)).points_units),50000);
await rpc('rewards_refund',[referredBookings[0],108,false]);assert.equal(Number((await wallet(referrer)).points_units),40000);await rpc('rewards_refund',[referredBookings[0],108,false]);assert.equal(Number((await wallet(referrer)).points_units),40000);
// Browser roles cannot mutate or inspect wallets or call any wallet functions.
for(const role of ['anon','authenticated']) {
 await db.exec('set role '+role);
 await assert.rejects(q('select * from racing_wallets'),/permission denied/);
 await assert.rejects(rpc('rewards_post',[user,'purchased',100000,'attack','attack']),/permission denied/);
 await assert.rejects(rpc('rewards_report',[]),/permission denied/);
 await db.exec('reset role');
}
for(const u of [user,other]) {const w=await wallet(u);for(const [bucket,col] of [['purchased','purchased_cents'],['promo','promo_cents'],['points','points_units']]){const sum=(await q('select coalesce(sum(amount),0) as n from racing_wallet_ledger where profile_id=$1 and bucket=$2',[u,bucket]))[0].n;assert.equal(Number(sum),Number(w[col]));}}
console.log('PASS: real PostgreSQL migration, wallet ledger, retries, concurrency, refunds, reward debt, promotions, rescheduling and access control');
await db.close();

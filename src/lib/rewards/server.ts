import Stripe from 'stripe';
import { formatVenueBookingRange } from '@/lib/bookings/time';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripeEnv } from '@/lib/stripe/env';

export async function rewardsRpc(db: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function walletSnapshot(profileId: string) {
  const db = createSupabaseAdminClient();
  const inserted = await db.from('racing_wallets').upsert({profile_id:profileId},{onConflict:'profile_id',ignoreDuplicates:true});
  if (inserted.error) throw inserted.error;
  const results = await Promise.all([
    db.from('racing_wallets').select('*').eq('profile_id',profileId).single(),
    db.from('racing_wallet_ledger').select('id,bucket,amount,reason,created_at').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(50),
    db.from('reward_settings').select('enabled,wallet_sales_enabled,referrals_enabled,points_per_dollar,redemption_points,reward_cents').eq('id',1).single(),
    db.from('race_bookings').select('id,starts_at,rewards_subtotal_cents,rewards_rate').eq('profile_id',profileId).is('rewards_completed_at',null).gt('rewards_rate',0).in('status',['confirmed','payment_succeeded_vms_failed']).limit(100)
  ]);
  for (const result of results) if (result.error) throw result.error;
  return {wallet:results[0].data,ledger:results[1].data,settings:results[2].data,pending:results[3].data};
}
export async function syncWalletPayment(stripe: Stripe, intentId: string) {
  const pi = await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']});
  if (pi.metadata?.source !== 'speedtrap_wallet_topup' || pi.status !== 'succeeded') return;
  if (pi.currency !== 'usd') throw new Error('Unexpected wallet currency');
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  await rewardsRpc(createSupabaseAdminClient(),'rewards_topup_paid',{
    p_topup:pi.metadata.topup_id,p_intent:pi.id,p_amount:pi.amount_received,p_refunded:charge?.amount_refunded ?? 0
  });
}
export async function syncRewardRefund(stripe: Stripe, intentId: string) {
  const pi = await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']});
  if (pi.metadata?.source === 'speedtrap_wallet_topup') { await syncWalletPayment(stripe,intentId); return; }
  if (pi.metadata?.source !== 'speedtrap_online_booking') return;
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  if (!charge?.amount_refunded) return;
  const db = createSupabaseAdminClient();
  const {data:booking,error}=await db.from('race_bookings').select('id,wallet_hold_id').eq('stripe_payment_intent_id',pi.id).maybeSingle();
  if(error) throw error;
  if(booking?.wallet_hold_id) await rewardsRpc(db,'rewards_refund',{p_booking:booking.id,p_refunded:charge.amount_refunded,p_full:charge.refunded});
}
// Reconcile expired reservations only after Stripe can no longer accept their payment.
export async function releaseExpiredWalletHolds(profileId?: string) {
  const db=createSupabaseAdminClient();
  let query=db.from('race_booking_holds').select('id,profile_id,stripe_payment_intent_id,wallet_purchased_cents,wallet_promo_cents,rewards_subtotal_cents,amount_cents,customer_email,starts_at,ends_at,duration_minutes,party_size,sim_count,currency,racing_discount_percent,racing_discount_cents,sms_consent_at,payment_method_requested,racing_wallet_reservations!inner(state)')
    .in('racing_wallet_reservations.state',['reserved','payment']).not('rewards_subtotal_cents','is',null).in('status',['active','expired','cancelled']).lt('expires_at',new Date(Date.now()-60_000).toISOString()).order('expires_at').limit(30);
  if(profileId) query=query.eq('profile_id',profileId);
  const {data:holds,error}=await query;
  if(error) throw error;
  if(!holds?.length) return;
  const stripe=new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
  const failures: string[]=[];
  for(const hold of holds) {
   try {
    const {data:r,error:rError}=await db.from('racing_wallet_reservations').select('state').eq('hold_id',hold.id).maybeSingle();
    if(rError) throw rError;
    if(!r || !['reserved','payment'].includes(r.state)) continue;
    if(r.state==='payment' && hold.amount_cents>0) {
      // Creation is idempotent: recovers an intent even if a prior request crashed before saving its ID.
      const pi=hold.stripe_payment_intent_id ? await stripe.paymentIntents.retrieve(hold.stripe_payment_intent_id) : await createWalletBookingIntent(stripe,hold);
      if(pi.status==='succeeded') {
        const {confirmRaceBookingFromPaymentIntent}=await import('@/lib/bookings/confirm');
        await confirmRaceBookingFromPaymentIntent({supabase:db,stripe,paymentIntentId:pi.id});
        continue;
      }
      if(pi.status==='processing') continue;
      if(pi.status!=='canceled') await stripe.paymentIntents.cancel(pi.id);
    }
    await rewardsRpc(db,'rewards_release_hold',{p_hold:hold.id});
   } catch { failures.push(hold.id); }
  }
  if(failures.length) throw new Error(`Wallet reconciliation failed for holds: ${failures.join(', ')}`);
}
export function createWalletBookingIntent(stripe: Stripe,hold: any) {
  return stripe.paymentIntents.create({amount:hold.amount_cents,currency:'usd',receipt_email:hold.customer_email,
    description:`Speed Trap racing · ${hold.duration_minutes} minutes · ${formatVenueBookingRange(hold.starts_at,hold.ends_at)}`,payment_method_types:(hold.payment_method_requested==='crypto'?['crypto']:['card']) as any,
    metadata:{source:'speedtrap_online_booking',booking_hold_id:hold.id,payment_method_requested:hold.payment_method_requested || 'card',wallet_purchased_cents:String(hold.wallet_purchased_cents),wallet_promo_cents:String(hold.wallet_promo_cents)}
  },{idempotencyKey:`wallet-booking:${hold.id}`});
}

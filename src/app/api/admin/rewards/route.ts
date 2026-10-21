import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {rewardsRpc} from '@/lib/rewards/server';
const settings=z.object({enabled:z.boolean(),wallet_sales_enabled:z.boolean(),referrals_enabled:z.boolean(),points_per_dollar:z.number().int().min(1).max(5),redemption_points:z.number().int().min(100).max(10000),reward_cents:z.number().int().min(100).max(5000)}).refine(s=>s.points_per_dollar*s.reward_cents/s.redemption_points<=10,'Base reward rate cannot exceed 10%.');
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('settings'),settings}),
 z.object({action:z.literal('complete'),bookingId:z.string().uuid()}),
 z.object({action:z.literal('adjust'),profileId:z.string().uuid(),bucket:z.enum(['points','promo','purchased']),amount:z.number().int().min(-100000).max(100000).refine(x=>x!==0),reason:z.string().trim().min(5).max(250),key:z.string().uuid()}),
 z.object({action:z.literal('promotion'),name:z.string().trim().min(3).max(100),startsAt:z.string().datetime(),endsAt:z.string().datetime()}),
 z.object({action:z.literal('stop_promotion'),id:z.string().uuid()})
]);
export async function GET(request:Request) {
 const admin=await requireAdmin();if(!admin.ok) return admin.response;
 try {
  const db=createSupabaseAdminClient();const profileId=new URL(request.url).searchParams.get('profileId');
  const queries=await Promise.all([
   db.from('reward_settings').select('*').eq('id',1).single(),
   db.from('reward_promotions').select('*').order('starts_at',{ascending:false}).limit(50),
   db.from('race_bookings').select('id,customer_name,customer_email,profile_id,starts_at,ends_at,rewards_subtotal_cents,rewards_rate').gt('rewards_rate',0).gt('rewards_subtotal_cents',0).is('rewards_completed_at',null).in('status',['confirmed','payment_succeeded_vms_failed']).lt('ends_at',new Date().toISOString()).order('ends_at').limit(100),
   db.from('racing_wallets').select('*,profiles:profiles!racing_wallets_profile_id_fkey(display_name)').order('created_at',{ascending:false}).limit(100),
   db.from('racing_wallet_ledger').select('*').order('created_at',{ascending:false}).limit(100),
   db.rpc('rewards_report')
  ]);
  for(const q of queries) if(q.error) throw q.error;
  let customer=null;
  if(profileId) {
   if(!z.string().uuid().safeParse(profileId).success) throw new Error('Invalid customer ID');
   const {data,error}=await db.from('racing_wallet_ledger').select('*').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(200);if(error) throw error;customer=data;
  }
  return NextResponse.json({settings:queries[0].data,promotions:queries[1].data,pending:queries[2].data,wallets:queries[3].data,ledger:queries[4].data,report:queries[5].data,customer},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Rewards admin read failed',e);return NextResponse.json({error:'Unable to load rewards administration.'},{status:503});}
}
export async function POST(request:Request) {
 const admin=await requireAdmin();if(!admin.ok) return admin.response;
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});
 try {
  const db=createSupabaseAdminClient();const a=parsed.data;
  if(a.action==='settings') {
   const {error}=await db.from('reward_settings').update({...a.settings,updated_by:admin.user.id,updated_at:new Date().toISOString()}).eq('id',1);if(error) throw error;
  }
  if(a.action==='complete') await rewardsRpc(db,'rewards_complete',{p_booking:a.bookingId,p_actor:admin.user.id});
  if(a.action==='adjust') await rewardsRpc(db,'rewards_post',{p_profile:a.profileId,p_bucket:a.bucket,p_amount:a.amount,p_key:`staff:${a.key}`,p_reason:a.reason,p_actor:admin.user.id});
  if(a.action==='promotion') {
   if(Date.parse(a.endsAt)<=Date.parse(a.startsAt)) throw new Error('Promotion end must follow its start.');
   const {error}=await db.from('reward_promotions').insert({name:a.name,starts_at:a.startsAt,ends_at:a.endsAt,created_by:admin.user.id});if(error) throw error;
  }
  if(a.action==='stop_promotion') {const {error}=await db.from('reward_promotions').update({enabled:false}).eq('id',a.id);if(error) throw error;}
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Rewards update failed.'},{status:409});}
}

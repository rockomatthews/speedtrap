import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rewardsRpc, walletSnapshot, syncWalletPayment } from '@/lib/rewards/server';
import Stripe from 'stripe';
import { getStripeEnv } from '@/lib/stripe/env';
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('redeem'),key:z.string().uuid()}),
 z.object({action:z.literal('refer'),code:z.string().regex(/^[a-f0-9]{32}$/)}),
 z.object({action:z.literal('confirm_topup'),sessionId:z.string().startsWith('cs_')})
]);
export async function GET() {
 const auth=await createRouteHandlerClient();const {data:{user}}=await auth.auth.getUser();
 if(!user) return NextResponse.json({error:'Sign in to view rewards.'},{status:401});
 try {return NextResponse.json(await walletSnapshot(user.id),{headers:{'Cache-Control':'no-store'}});}
 catch {return NextResponse.json({error:'Rewards are temporarily unavailable.'},{status:503});}
}
export async function POST(request:Request) {
 const auth=await createRouteHandlerClient();const {data:{user}}=await auth.auth.getUser();
 if(!user) return NextResponse.json({error:'Sign in to use rewards.'},{status:401});
 const parsed=action.safeParse(await request.json().catch(()=>null));
 if(!parsed.success) return NextResponse.json({error:'Invalid rewards request.'},{status:400});
 try {
  const db=createSupabaseAdminClient(); const a=parsed.data;
  if(a.action==='redeem') await rewardsRpc(db,'rewards_convert',{p_profile:user.id,p_key:a.key});
  if(a.action==='refer') await rewardsRpc(db,'rewards_refer',{p_profile:user.id,p_code:a.code,p_email:user.email});
  if(a.action==='confirm_topup') {
   const stripe=new Stripe(getStripeEnv().STRIPE_SECRET_KEY);const s=await stripe.checkout.sessions.retrieve(a.sessionId);
   if(s.metadata?.profile_id!==user.id || s.metadata?.source!=='speedtrap_wallet_topup') return NextResponse.json({error:'Not your credit purchase.'},{status:403});
   if(s.payment_status!=='paid') throw new Error('Payment is not complete yet.');
   if(typeof s.payment_intent==='string') await syncWalletPayment(stripe,s.payment_intent);
  }
  return NextResponse.json(await walletSnapshot(user.id));
 } catch(e) {return NextResponse.json({error:e instanceof Error?e.message:'Rewards request failed.'},{status:409});}
}

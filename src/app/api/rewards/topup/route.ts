import {NextResponse} from 'next/server';
import {z} from 'zod';
import Stripe from 'stripe';
import {createRouteHandlerClient} from '@/lib/supabase/route-handler';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripeEnv} from '@/lib/stripe/env';
import {env} from '@/lib/supabase/env';
export async function POST(request:Request) {
 const auth=await createRouteHandlerClient();const {data:{user}}=await auth.auth.getUser();
 if(!user) return NextResponse.json({error:'Sign in to buy credits.'},{status:401});
 const parsed=z.object({amountCents:z.union([z.literal(2500),z.literal(5000),z.literal(10000),z.literal(20000)]),key:z.string().uuid()}).safeParse(await request.json().catch(()=>null));
 if(!parsed.success) return NextResponse.json({error:'Select a credit package.'},{status:400});
 try {
  const db=createSupabaseAdminClient();const {data:s,error:se}=await db.from('reward_settings').select('wallet_sales_enabled').eq('id',1).single();
  if(se || !s?.wallet_sales_enabled) return NextResponse.json({error:'Credit purchases are not open yet.'},{status:409});
  const {error}=await db.from('racing_wallet_topups').upsert({id:parsed.data.key,profile_id:user.id,amount_cents:parsed.data.amountCents},{onConflict:'id',ignoreDuplicates:true});if(error) throw error;
  const {data:t}=await db.from('racing_wallet_topups').select('*').eq('id',parsed.data.key).single();
  if(t?.profile_id!==user.id || t.amount_cents!==parsed.data.amountCents) throw new Error('Credit purchase conflict.');
  const stripe=new Stripe(getStripeEnv().STRIPE_SECRET_KEY);
  const metadata={source:'speedtrap_wallet_topup',topup_id:t.id,profile_id:user.id};
  const origin=env.NEXT_PUBLIC_SITE_URL || 'https://www.speedtrapracing.com';
  const session=await stripe.checkout.sessions.create({mode:'payment',customer_email:user.email,payment_method_types:['card'],
   line_items:[{price_data:{currency:'usd',unit_amount:t.amount_cents,product_data:{name:`$${t.amount_cents/100} SpeedTrap racing credits`,description:'Prepaid racing balance. Tax is applied when booking racing. No points are earned on this purchase.'}},quantity:1}],
   metadata,payment_intent_data:{metadata},success_url:`${origin}/dashboard/rewards?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/dashboard/rewards`
  },{idempotencyKey:`wallet-topup:${t.id}`});
  const saved=await db.from('racing_wallet_topups').update({stripe_checkout_session_id:session.id}).eq('id',t.id);if(saved.error) throw saved.error;
  return NextResponse.json({url:session.url});
 }catch {return NextResponse.json({error:'Unable to start credit purchase. Please retry.'},{status:503});}
}

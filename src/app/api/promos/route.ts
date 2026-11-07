import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getAuthedProfile} from '@/lib/supabase/profile';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {bookingAmountCents,supportedBookingDuration} from '@/lib/bookings/config';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('membership'),code:z.string().trim().min(6).max(40)}),
 z.object({action:z.literal('quote'),code:z.string().trim().min(6).max(40),durationMinutes:z.number().int().refine(supportedBookingDuration),pods:z.number().int().min(1).max(4)})
]);
export async function POST(request:Request){const {user}=await getAuthedProfile();if(!user)return NextResponse.json({error:'Sign in to use a promo code.'},{status:401});const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Enter a valid code and session.'},{status:400});const x=p.data;const {data,error}=await createSupabaseAdminClient().rpc(x.action==='membership'?'promo_redeem_membership':'promo_racing_quote',x.action==='membership'?{p_code:x.code,p_profile:user.id}:{p_code:x.code,p_profile:user.id,p_duration:x.durationMinutes,p_pods:x.pods,p_subtotal:bookingAmountCents(x.durationMinutes,x.pods)});if(error)return NextResponse.json({error:error.message},{status:409});if(x.action==='quote' && data.subtotal_cents>0 && data.subtotal_cents+Math.round(data.subtotal_cents*.08)<50)return NextResponse.json({error:'This code leaves a payment below the card minimum. Choose a longer session or a different code.'},{status:409});return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}

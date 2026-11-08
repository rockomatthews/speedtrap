import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin} from '@/lib/auth/require-admin';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {runRacingShadow} from '@/lib/racing-engagement/server';
import {recordLostPreview} from '@/lib/racing-engagement/model';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request) {
 const auth=await requireAdmin(); if(!auth.ok)return auth.response;
 const offset=Number(new URL(request.url).searchParams.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return NextResponse.json({error:'Invalid offset'},{status:400});
 const db=createSupabaseAdminClient();
 const [s,e]=await Promise.all([db.from('racing_shadow_sources').select('*'),db.from('racing_shadow_events').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(offset,offset+49)]);
 if(s.error||e.error)return NextResponse.json({error:'Shadow storage is not ready. Apply the branch migration to the review environment.'},{status:503,headers});
 const driverIds=[...new Set((e.data||[]).map(x=>Number(x.recipient_driver_id)).filter(Number.isSafeInteger))];
 const profiles=driverIds.length?await db.from('profiles').select('id,vms_customer_id').in('vms_customer_id',driverIds):{data:[],error:null};
 if(profiles.error)return NextResponse.json({error:'Driver linking could not be checked.'},{status:503,headers});
 return NextResponse.json({mode:'shadow',sendingEnabled:false,enabled:process.env.RACING_ENGAGEMENT_SHADOW_ENABLED==='true',sources:s.data,total:e.count,events:e.data?.map(x=>({...x,identityLinked:profiles.data?.filter(p=>String(p.vms_customer_id)===x.recipient_driver_id).length===1,preview:recordLostPreview(x.payload)}))},{headers});
}
export async function POST() {
 const auth=await requireAdmin();if(!auth.ok)return auth.response;
 try{return NextResponse.json(await runRacingShadow(),{headers});}catch {return NextResponse.json({error:'Sync failed or another worker advanced the cursor. Prior data is retained; retry shortly.'},{status:502,headers});}
}
export async function PATCH(request:Request) {
 const auth=await requireAdmin();if(!auth.ok)return auth.response;
 const parsed=z.object({id:z.string().uuid(),decision:z.enum(['correct','incorrect']),note:z.string().trim().max(1000).default('')}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Invalid review'},{status:400});
 const {data,error}=await createSupabaseAdminClient().from('racing_shadow_events').update({review_decision:parsed.data.decision,review_note:parsed.data.note,reviewed_by:auth.user.id,reviewed_at:new Date().toISOString()}).eq('id',parsed.data.id).select('id').maybeSingle();
 return error?NextResponse.json({error:'Review could not be saved'},{status:500}):data?NextResponse.json({ok:true},{headers}):NextResponse.json({error:'Event not found'},{status:404});
}
export const maxDuration=60;

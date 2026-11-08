import {client,session,sameOrigin} from '../../../lib/auth';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){
 if(!await session())return Response.json({error:'Staff sign-in required'},{status:401,headers});
 const offset=Number(new URL(req.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return Response.json({error:'Invalid page'},{status:400});
 const db=client(true);const [s,e]=await Promise.all([db.from('racing_shadow_sources').select('*'),db.from('racing_shadow_events').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(offset,offset+49)]);
 if(s.error||e.error)return Response.json({error:'Review data unavailable'},{status:503,headers});
 return Response.json({mode:'shadow',sendingEnabled:false,sources:s.data,events:e.data,total:e.count},{headers});
}
export async function PATCH(req:Request){
 if(!sameOrigin(req))return Response.json({error:'Forbidden'},{status:403});
 const user=await session();if(!user)return Response.json({error:'Staff sign-in required'},{status:401});
 const b=await req.json().catch(()=>null);
 if(!b||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id)||!['correct','incorrect'].includes(b.decision)||typeof b.note!=='string'||b.note.length>1000||Object.keys(b).some(k=>!['id','decision','note'].includes(k)))return Response.json({error:'Invalid review'},{status:400});
 const {data,error}=await client(true).from('racing_shadow_events').update({review_decision:b.decision,review_note:b.note,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',b.id).select('id').maybeSingle();
 return Response.json(error?{error:'Review save failed'}:data?{ok:true}:{error:'Alert not found'},{status:error?500:data?200:404,headers});
}

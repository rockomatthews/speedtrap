import {cookies} from 'next/headers';
import {client,session,staff,sameOrigin,saveSession,clearSession} from '../../../lib/auth';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){try{const user=await session();return Response.json({signedIn:!!user,email:user?.email||null},{headers});}catch{return Response.json({error:'Review sign-in unavailable'},{status:503,headers});}}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'Forbidden'},{status:403});
 const body=await req.json().catch(()=>null);if(!body||!['login','setup','logout','refresh'].includes(body.action))return Response.json({error:'Invalid request'},{status:400});
 try{
 const c=client();
 if(body.action==='logout'){
 const jar=await cookies();const access=jar.get('shadow-access')?.value,refresh=jar.get('shadow-refresh')?.value;
 if(access&&refresh){await c.auth.setSession({access_token:access,refresh_token:refresh});await c.auth.signOut({scope:'local'});}
 await clearSession();return Response.json({ok:true},{headers});
 }
 if(body.action==='refresh'){
 const token=(await cookies()).get('shadow-refresh')?.value;if(!token)return Response.json({error:'Sign in again'},{status:401});
 const {data,error}=await c.auth.refreshSession({refresh_token:token});
 if(error||!data.session||!data.user||!await staff(data.user.id)){await clearSession();return Response.json({error:'Sign in again'},{status:401});}
 await saveSession(data.session);return Response.json({ok:true},{headers});
 }
 if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)return Response.json({error:'Use a password between 12 and 128 characters'},{status:400});
 const result=body.action==='setup'
 ? await c.auth.verifyOtp({token_hash:typeof body.token==='string'?body.token:'',type:'recovery'})
 : await c.auth.signInWithPassword({email:typeof body.email==='string'?body.email:'',password:body.password});
 if(result.error||!result.data.user||!result.data.session||!await staff(result.data.user.id)){
 if(result.data.session)await c.auth.signOut({scope:'local'});
 return Response.json({error:'Sign-in failed or setup link expired. Contact the review administrator.'},{status:401,headers});
 }
 if(body.action==='setup'){
 const changed=await c.auth.updateUser({password:body.password});
 if(changed.error){await c.auth.signOut({scope:'local'});return Response.json({error:'Password could not be set'},{status:400});}
 }
 await saveSession(result.data.session);return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'Review sign-in unavailable'},{status:503,headers});}
}

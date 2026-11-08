import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
export const REVIEW_URL='https://kzymywpamdmfwnlwxzfj.supabase.co';
export function client(admin=false){
 if(process.env.SHADOW_SUPABASE_URL!==REVIEW_URL)throw Error('Review database mismatch');
 const key=admin?process.env.SHADOW_SERVICE_ROLE_KEY:process.env.SHADOW_ANON_KEY;
 if(!key)throw Error('Review configuration missing');
 return createClient(REVIEW_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export async function staff(userId:string){const {data,error}=await client(true).from('profiles').select('role').eq('id',userId).maybeSingle();return !error&&data?.role==='admin';}
export async function session(){
 const jar=await cookies();const token=jar.get('shadow-access')?.value;
 if(!token)return null;
 const {data,error}=await client().auth.getUser(token);
 if(error||!data.user||!await staff(data.user.id))return null;
 return data.user;
}
export async function saveSession(s:{access_token:string;refresh_token:string;expires_in?:number}){
 const jar=await cookies();const options={httpOnly:true,secure:true,sameSite:'strict' as const,path:'/'};
 jar.set('shadow-access',s.access_token,{...options,maxAge:s.expires_in||3600});
 jar.set('shadow-refresh',s.refresh_token,{...options,maxAge:8*3600});
}
export async function clearSession(){const jar=await cookies();jar.delete('shadow-access');jar.delete('shadow-refresh');}

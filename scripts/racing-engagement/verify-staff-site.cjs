// Exercises only the isolated review project with a temporary, deleted QA account.
const {spawnSync}=require('node:child_process');const {randomBytes,randomUUID}=require('node:crypto');const {createClient}=require('@supabase/supabase-js');const assert=require('node:assert/strict');
const ref='kzymywpamdmfwnlwxzfj';const origin=process.argv[2];if(!origin||(!new URL(origin).hostname.startsWith('speedtrap-shadow-review')&&origin!=='http://localhost:3108'))throw Error('Review URL required');
const r=spawnSync('supabase',['branches','get','racing-engagement-shadow','--project-ref','ispveopmovavssktnbfu','-o','json'],{encoding:'utf8'});if(r.status!==0)throw Error('Credentials unavailable');const c=JSON.parse(r.stdout);assert.equal(c.SUPABASE_URL,`https://${ref}.supabase.co`);
const db=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const email=`shadow-qa-${randomUUID()}@example.invalid`;let uid;const source=`qa:${randomUUID()}`;const event=randomUUID();let cookie='';
async function call(path,method='GET',body,sendOrigin=origin){const res=await fetch(origin+path,{method,redirect:'manual',headers:{origin:sendOrigin,'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});const set=res.headers.getSetCookie();if(set.length)cookie=set.map(s=>s.split(';')[0]).join('; ');return {status:res.status,data:await res.json(),set};}
(async()=>{try{
 assert.equal((await call('/api/review')).status,401);
 const created=await db.auth.admin.createUser({email,password:randomBytes(36).toString('base64url'),email_confirm:true});if(created.error)throw created.error;uid=created.data.user.id;
 let q=await db.from('profiles').insert({id:uid,role:'admin'});if(q.error)throw q.error;
 const link=await db.auth.admin.generateLink({type:'recovery',email});if(link.error)throw link.error;
 const password=randomBytes(36).toString('base64url');const setup=await call('/api/auth','POST',{action:'setup',token:link.data.properties.hashed_token,password});assert.equal(setup.status,200,JSON.stringify(setup.data));assert(setup.set.some(s=>s.includes('HttpOnly')&&s.includes('Secure')&&s.includes('SameSite=strict')));
 assert.equal((await call('/api/auth')).data.signedIn,true);assert.equal((await call('/api/review')).status,200);
 q=await db.from('racing_shadow_sources').insert({source_id:source,baseline_through:0});if(q.error)throw q.error;
 q=await db.from('racing_shadow_events').insert({id:event,source_id:source,board_key:'QA FIXTURE',recipient_driver_id:'QA',previous_lap_id:1,new_lap_id:2,payload:{boardLabel:'QA FIXTURE',recipientName:'QA',previousMs:60000,newMs:59000}});if(q.error)throw q.error;
 assert.equal((await call('/api/review','PATCH',{id:event,decision:'correct',note:'Automated isolated verification'})).status,200);
 assert.equal((await db.from('racing_shadow_events').select('reviewed_by').eq('id',event).single()).data.reviewed_by,uid);
 assert.equal((await call('/api/review','PATCH',{id:event,decision:'correct',note:''},'https://untrusted.example')).status,403);
 assert.equal((await call('/api/auth','POST',{action:'refresh'})).status,200);
 assert.equal((await call('/api/auth','POST',{action:'logout'})).status,200);assert.equal((await call('/api/review')).status,401);
 const direct=await createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{auth:{persistSession:false}}).auth.signInWithPassword({email,password});if(direct.error)console.log({authErrorCode:direct.error.code,authError:direct.error.message});
 assert.equal((await call('/api/auth','POST',{action:'login',email,password})).status,200);
 await db.from('profiles').update({role:'customer'}).eq('id',uid);assert.equal((await call('/api/review')).status,401);
 await call('/api/auth','POST',{action:'logout'});assert.equal((await call('/api/auth','POST',{action:'login',email,password})).status,401);
 const publicClient=createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const reset=await publicClient.auth.resetPasswordForEmail(email);assert(reset.error&&/disabled in shadow review/i.test(reset.error.message),'Auth email hook did not block delivery');
 const signup=await publicClient.auth.signUp({email:`not-invited-${randomUUID()}@example.invalid`,password});assert(signup.error,'Public signup must be disabled');
 console.log(JSON.stringify({setup:true,staffLogin:true,reviewRead:true,reviewWrite:true,refresh:true,logout:true,crossOriginDenied:true,roleRevocation:true,nonStaffDenied:true,emailBlocked:true,signupDisabled:true}));
 }finally{
 await db.from('racing_shadow_events').delete().eq('id',event);await db.from('racing_shadow_sources').delete().eq('source_id',source);
 if(uid){await db.from('profiles').delete().eq('id',uid);await db.auth.admin.deleteUser(uid);}console.log('Temporary QA records removed');
 }})().catch(e=>{console.error(e.stack);process.exit(1)});

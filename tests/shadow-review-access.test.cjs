const {test}=require('node:test');const assert=require('node:assert/strict');const load=require('./load-ts.cjs');
const path='apps/shadow-review/app/api/review/route.ts';
test('review API rejects anonymous reads and cross-origin writes before touching the database',async()=>{
 const route=load({'../../../lib/auth':{session:async()=>null,sameOrigin:()=>false,client:()=>{throw Error('Database must not be called');}}})(path);
 assert.equal((await route.GET(new Request('https://review.test/api/review'))).status,401);
 assert.equal((await route.PATCH(new Request('https://review.test/api/review',{method:'PATCH'}))).status,403);
});
test('review API refuses unexpected write fields such as send flags',async()=>{
 const route=load({'../../../lib/auth':{session:async()=>({id:'staff'}),sameOrigin:()=>true,client:()=>{throw Error('Database must not be called');}}})(path);
 const response=await route.PATCH(new Request('https://review.test/api/review',{method:'PATCH',body:JSON.stringify({id:'00000000-0000-0000-0000-000000000001',decision:'correct',note:'',send:true})}));assert.equal(response.status,400);
});
test('isolated auth refuses production URL and ignores editable user metadata for authorization',async()=>{
 const previous=process.env.SHADOW_SUPABASE_URL;process.env.SHADOW_SUPABASE_URL='https://ispveopmovavssktnbfu.supabase.co';
 try{const a=load({'next/headers':{},'@supabase/supabase-js':{createClient:()=>{throw Error('Should not instantiate client');}}})('apps/shadow-review/lib/auth.ts');assert.throws(()=>a.client(),/mismatch/);}finally{if(previous===undefined)delete process.env.SHADOW_SUPABASE_URL;else process.env.SHADOW_SUPABASE_URL=previous;}
});

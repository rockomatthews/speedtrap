const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs');
test('league session refresh reaches the page and persists every cookie chunk without requiring login', async () => {
 for (const user of [null, {id:'member'}]) {
  const stored = new Map();
  const request = {nextUrl:{pathname:'/leagues/winter-series-2026-27'},cookies:{get:name=>({value:stored.get(name)}),set:(name,value)=>stored.set(name,value)}};
  const {middleware}=load({
   'next/server':{NextResponse:{next:()=>{const values=new Map();return {cookies:{set:cookie=>values.set(cookie.name,cookie),getAll:()=>[...values.values()]}}}}},
   '@/lib/supabase/env':{env:{}},
   '@supabase/ssr':{createServerClient:(url,key,{cookies})=>({auth:{getUser:async()=>{cookies.set('session.0','fresh0',{});cookies.set('session.1','fresh1',{});return {data:{user}}}}})}
  })('src/middleware.ts');
  const response=await middleware(request);
  assert.equal(stored.get('session.0'),'fresh0');assert.equal(stored.get('session.1'),'fresh1');
  assert.equal(response.cookies.getAll().length,2);
 }
});
test('server rendering tolerates read-only cookies but does not swallow other failures',async()=>{
 let failure=new Error('Cookies can only be modified in a Server Action or Route Handler.');
 const {createSupabaseServerClient}=load({
  'next/headers':{cookies:async()=>({get:()=>null,set:()=>{throw failure}})},
  '@/lib/supabase/env':{env:{}},
  '@supabase/ssr':{createServerClient:(url,key,{cookies})=>cookies}
 })('src/lib/supabase/server.ts');
 const cookies=await createSupabaseServerClient();
 assert.doesNotThrow(()=>cookies.set('session','value',{}));
 failure=new Error('Unexpected failure');
 assert.throws(()=>cookies.set('session','value',{}),/Unexpected failure/);
});

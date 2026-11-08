const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
function worker(env){let handler;const source=fs.readFileSync('supabase/functions/racing-shadow/index.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');new Function('Deno','XMLParser','XMLValidator','createClient',source)({env:{get:k=>env[k]},serve:h=>{handler=h}},class {},{},()=>{throw Error('Database must not be contacted');});return handler;}
test('review worker refuses production, unauthorized callers and disabled collection',async()=>{
 const env={SUPABASE_URL:'https://ispveopmovavssktnbfu.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key',SHADOW_JOB_TOKEN:'test-token'};
 const req=()=>new Request('https://example.test',{method:'POST',headers:{'x-shadow-token':'test-token'}});
 assert.equal((await worker(env)(req())).status,503);
 env.SUPABASE_URL='https://kzymywpamdmfwnlwxzfj.supabase.co';
 assert.equal((await worker(env)(new Request('https://example.test',{method:'POST'}))).status,401);
 assert.deepEqual(await (await worker(env)(req())).json(),{mode:'shadow',enabled:false,sendingEnabled:false});
});

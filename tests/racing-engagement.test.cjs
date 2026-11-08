const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const load=require('./load-ts.cjs')({'@/lib/vms/client':{VmsClient:{}}});
const {parseVmsLapPage}=load('src/lib/racing-engagement/vms-source.ts');
test('parser rejects malformed pages and excludes unsafe laps',()=>{
 assert.throws(()=>parseVmsLapPage('<error/>','vms:1',1));
 assert.deepEqual(parseVmsLapPage('<laps><lap_results>0</lap_results></laps>','vms:1',1),[]);
 const row=parseVmsLapPage('<laps><lap_results>1</lap_results><lap><id>1</id><venue_id>1</venue_id><customer_id>2</customer_id><circuit_id>3</circuit_id><vehicle_id>4</vehicle_id><transmission>manual</transmission><time_ms>60000</time_ms><date>2026-11-07 12:00:00</date><invalid>0</invalid></lap></laps>','vms:1',1)[0];
 assert.equal(row.valid,true);assert.equal(row.occurredAt,'2026-11-07T17:00:00.000Z');
});
test('SQL baseline, record loss, idempotency, correction and private access',async()=>{
 const {PGlite}=await import(process.env.RACING_PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
 try{await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table profiles(id uuid primary key);');
 await db.exec(fs.readFileSync('supabase/migrations/20261108040608_racing_engagement_shadow.sql','utf8'));
 await db.exec("insert into racing_shadow_sources(source_id,baseline_through,started_at) values('vms:1',1,now()-interval '1 hour')");
 const lap=(id,driver,ms,valid=true)=>({sourceId:'vms:1',lapId:id,driverId:driver,driverName:driver,boardKey:'board',boardLabel:'Car at track',timeMs:ms,occurredAt:new Date().toISOString(),valid,exclusion:null});
 let version=0,last=0;
 const apply=async(rows,repair=false)=>{const r=await db.query('select racing_shadow_apply($1,$2,$3,$4,true,$5) as state',['vms:1',version,repair?0:last,JSON.stringify(rows),repair]);version=r.rows[0].state.version;last=r.rows[0].state.last_id;};
 const events=async()=>(await db.query('select * from racing_shadow_events')).rows;
 await apply([lap(1,'a',60000)]);assert.equal((await events()).length,0);
 await apply([lap(2,'a',59000)]);assert.equal((await events()).length,0);
 await apply([lap(3,'b',58000)]);assert.equal((await events()).length,1);assert.equal((await events())[0].recipient_driver_id,'a');
 await assert.rejects(db.query("select racing_shadow_apply('vms:1',0,0,'[]',true,false)"));assert.equal((await events()).length,1);
 await apply([lap(1,'a',60000),lap(2,'a',59000),lap(3,'b',58000,false)],true);assert.equal((await events())[0].status,'superseded');

 // Equal records do not alert; a subsequent faster driver notifies both prior holders.
 await apply([lap(4,'c',59000)]);assert.equal((await events()).length,1);
 await apply([lap(5,'d',57000)]);assert.equal((await events()).length,3);
 assert.equal((await events()).filter(e=>e.new_lap_id===5 && e.recipient_driver_id==='a')[0].status,'suppressed');
 assert.equal((await events()).filter(e=>e.new_lap_id===5 && e.recipient_driver_id==='c')[0].status,'review');
 // A different comparison key and a late imported historical lap never emit a loss.
 await apply([{...lap(6,'e',1000),boardKey:'different'}, {...lap(7,'f',56000),occurredAt:'2020-01-01T00:00:00Z'}]);assert.equal((await events()).length,3);
 // Repair a deleted lap and changed identity without creating retrospective alerts.
 await apply([lap(1,'a',60000),lap(2,'a',59000),lap(3,'b',58000,false),lap(4,'c',59000),{...lap(6,'e',1000),boardKey:'different'},{...lap(7,'f',56000),occurredAt:'2020-01-01T00:00:00Z'}],true);
 assert.equal((await db.query('select removed from racing_shadow_laps where lap_id=5')).rows[0].removed,true);
 assert.equal((await events()).filter(e=>e.new_lap_id===5).every(e=>e.status==='superseded'),true);
 await db.exec('set role anon');await assert.rejects(db.query('select * from racing_shadow_events'));await db.exec('reset role');
 }finally{await db.close();}
});
test('cron authentication and disabled-by-default collection',async()=>{
 let calls=0;const l=require('./load-ts.cjs')({'@/lib/racing-engagement/server':{runRacingShadow:async()=>{calls++;return {mode:'shadow'};}}});
 const route=l('src/app/api/cron/racing-engagement/route.ts');const saved=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only-secret';
 try{assert.equal((await route.GET(new Request('http://localhost'))).status,401);assert.equal(calls,0);assert.equal((await route.GET(new Request('http://localhost',{headers:{authorization:'Bearer test-only-secret'}}))).status,200);assert.equal(calls,1);}finally{if(saved===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=saved;}
 const prev=process.env.RACING_ENGAGEMENT_SHADOW_ENABLED;delete process.env.RACING_ENGAGEMENT_SHADOW_ENABLED;
 try{const server=require('./load-ts.cjs')({'@/lib/supabase/admin':{createSupabaseAdminClient:()=>{throw Error('Must not contact database');}},'@/lib/racing-engagement/vms-source':{},'@/lib/racing-engagement/sync':{}})('src/lib/racing-engagement/server.ts');assert.deepEqual(await server.runRacingShadow(),{mode:'shadow',enabled:false});}finally{if(prev!==undefined)process.env.RACING_ENGAGEMENT_SHADOW_ENABLED=prev;}
});

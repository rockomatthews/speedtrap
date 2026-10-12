const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');
function db(rows) {
  const tables={race_bookings:structuredClone(rows),race_booking_resources:rows.map(r=>({booking_id:r.id}))};
  return {tables,from(name){let filters=[],mode='select',values;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},not(k,op,v){filters.push(r=>r[k]!==v);return q},gte(k,v){filters.push(r=>r[k]>=v);return q},lte(k,v){filters.push(r=>r[k]<=v);return q},update(v){mode='update';values=v;return q},insert(v){mode='insert';values=v;return q},delete(){mode='delete';return q},then(resolve){const matches=r=>filters.every(f=>f(r));let data=tables[name].filter(matches);if(mode==='update')data.forEach(r=>Object.assign(r,values));if(mode==='delete')tables[name]=tables[name].filter(r=>!matches(r));if(mode==='insert')tables[name].push(values);return Promise.resolve({data,error:null}).then(resolve)}};return q}};
}
const start=new Date(Date.now()+5*86400000).toISOString();
const end=new Date(Date.now()+5*86400000+3600000).toISOString();
const imported={id:'party',source:'vms_import',vms_booking_id:392,status:'confirmed',starts_at:start,ends_at:end};
function sync(list){return loader({'@/lib/supabase/env':{env:{}},'@/lib/vms/client':{VmsClient:{fromEnv:()=>({listBookings:async()=>{if(list instanceof Error)throw list;return list}})}}})('src/lib/bookings/vms-sync.ts').syncUpcomingVmsBookings;}
test('deleted staff party frees capacity even when VMS list is empty; paid bookings retained',async()=>{
 const d=db([imported,{...imported,id:'paid',source:'website',vms_booking_id:500}]);const result=await sync([])(d);
 assert.equal(result.cancelled,1);assert.equal(d.tables.race_bookings[0].status,'cancelled');assert.equal(d.tables.race_bookings[1].status,'confirmed');assert.deepEqual(d.tables.race_booking_resources,[{booking_id:'paid'}]);
});
test('moving a party updates its existing website reservation',async()=>{
 const d=db([imported]);const moved=new Date(Date.now()+7*86400000).toISOString();await sync([{id:392,startDate:moved,endDate:new Date(Date.parse(moved)+3600000).toISOString(),numberOfPods:4,status:'Booked'}])(d);
 assert.equal(d.tables.race_bookings.length,1);assert.equal(d.tables.race_bookings[0].starts_at,moved);
});
test('VMS outage or invalid dates do not imply a deleted reservation',async()=>{
 const d=db([imported]);await assert.rejects(sync(new Error('offline'))(d));assert.equal(d.tables.race_bookings[0].status,'confirmed');
 await sync([{id:392,startDate:'invalid',endDate:'invalid'}])(d);assert.equal(d.tables.race_bookings[0].status,'confirmed');
});
test('explicit VMS cancellation releases assigned resources',async()=>{const d=db([imported]);await sync([{id:392,startDate:start,endDate:end,status:'Cancelled'}])(d);assert.equal(d.tables.race_booking_resources.length,0)});
test('cron rejects unauthorized requests and runs the sync for the scheduler',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only';let calls=0;
 try{const {GET}=loader({'@/lib/supabase/admin':{createSupabaseAdminClient:()=>({})},'@/lib/bookings/vms-sync':{syncUpcomingVmsBookings:async()=>{calls++;return{cancelled:1}}}})('src/app/api/cron/vms-bookings/route.ts');
 assert.equal((await GET(new Request('https://example.invalid'))).status,401);assert.equal(calls,0);
 const response=await GET(new Request('https://example.invalid',{headers:{authorization:'Bearer test-only'}}));assert.equal(response.status,200);assert.equal(calls,1);assert.equal(response.headers.get('cache-control'),'no-store');
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old}
});
test('malformed VMS response cannot be interpreted as an empty list',async()=>{
 const {VmsClient}=loader({'@/lib/supabase/env':{env:{}}})('src/lib/vms/client.ts');const client=new VmsClient('unused');client.getParsed=async()=>({error:'temporarily unavailable'});await assert.rejects(client.listBookings(),/invalid booking list/);client.getParsed=async()=>({bookings:''});assert.deepEqual(await client.listBookings(),[]);
});

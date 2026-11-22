import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { handle } from "../competition/lib/api.mjs";
import { handleDesk } from "../competition/lib/cloud-desk.mjs";

const remote=process.env.RACE_TEST_URL;
const admin=process.env.RACE_ADMIN_KEY;
const configured=!!(admin && (remote || process.env.RACE_DATABASE_URL));
async function call(prefix,path,key,data,expected=200) {
  const req=new Request((remote??"http://localhost")+"/api/"+prefix+"/"+path,{
    method:data===undefined?"GET":"POST",
    headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},
    ...(data===undefined?{}:{body:JSON.stringify(data)})
  });
  const response=remote?await fetch(req):await (prefix==="v1"?handle:handleDesk)(req,path.split("/"));
  const result=response.status===204?null:await response.json();
  assert.equal(response.status,expected,JSON.stringify(result));
  return result;
}
test("serverless rFactor practice pairs 4 rigs and starts the clock only after Drive", {skip:!configured},async()=>{
  const suffix=randomUUID().slice(0,8);
  const make=provider=>call("v1","venues",admin,{name:"Cloud Desk QA "+provider+" "+suffix,provider},201);
  const venue=await make("desk");
  const other=await call("v1","venues",admin,{name:"Cloud Desk QA other "+suffix,provider:"desk"},201);
  const partner=await make("partner");
  const desk=(path,key,data,status)=>call("desk/v1",path,key,data,status);
  try {
    await desk("state",partner.key,undefined,403);
    const rigs=[];
    for(let i=1;i<=4;i++) {
      const {code}=await desk("pair-code",venue.key,{});
      const rig=await desk("rig/pair",null,{code,name:"Synthetic Rig "+i},201);
      rigs.push(rig);
      if(i===1) await desk("rig/pair",null,{code,name:"Replay"},409);
      await desk("rig/"+rig.id+"/poll",rig.key,{presets:["rf2-practice"],detail:"Synthetic client"});
    }
    assert.equal((await desk("state",other.key)).rigs.length,0);
    await desk("session/"+rigs[0].id,other.key,{action:"confirm"},404);
    await Promise.all(rigs.map(r=>desk("rig/"+r.id+"/poll",r.key,{presets:["rf2-practice"]})));
    const launch=await desk("start",venue.key,{seats:rigs.map((r,i)=>({rigId:r.id,driver:"Driver "+i})),minutes:15});
    assert.ok(launch.rigs.every(r=>r.status==="launching" && r.session.endsAt===null));
    await desk("session/"+rigs[0].id,venue.key,{action:"confirm"},409);
    for(const rig of rigs) {
      const path="rig/"+rig.id;
      const {command}=await desk(path+"/poll",rig.key,{presets:["rf2-practice"]});
      assert.equal(command.preset,"rf2-practice");
      assert.equal((await desk(path+"/poll",rig.key,{presets:["rf2-practice"]})).command,null);
      await desk(path+"/ack",rig.key,{id:command.id,ok:true,detail:"Synthetic launch opened"},204);
    }
    const pending=await desk("state",venue.key);
    assert.ok(pending.rigs.every(r=>r.status==="awaiting_drive" && r.session.endsAt===null));
    await desk("rig/"+rigs[0].id+"/poll",rigs[0].key,{presets:["rf2-practice"]});
    const started=await desk("session/"+rigs[0].id,venue.key,{action:"confirm"});
    assert.equal(started.rigs[0].session.endsAt-started.now,900000);
    const rotated=await desk("session/"+rigs[0].id,venue.key,{action:"rotate",driver:"Second Driver"});
    assert.equal(rotated.rigs[0].session.driver,"Second Driver");
    assert.equal(rotated.rigs[0].session.endsAt,started.rigs[0].session.endsAt);
    await desk("session/"+rigs[0].id,venue.key,{action:"finish",confirmed:true});
    const revoked=await desk("session/"+rigs[0].id,venue.key,{action:"revoke",confirmed:true});
    assert.equal(revoked.rigs.length,3);
    await desk("rig/"+rigs[0].id+"/poll",rigs[0].key,{presets:[]},401);
  } finally {
    for(const account of [venue,other,partner]) await call("v1","credentials/"+account.credentialId+"/revoke",admin,{});
  }
});

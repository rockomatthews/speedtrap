import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";

const dll = process.env.RACE_DESK_BINARY;
const dotnet = process.env.RACE_DOTNET ?? "dotnet";
test("four rigs, concurrent sessions, rotation, and website capacity", { skip: !dll }, async t => {
  const data = await mkdtemp(join(tmpdir(),"str-desk-test-"));
  const base = "http://127.0.0.1:" + (process.env.RACE_DESK_PORT ?? "15080");
  const websiteKey = randomBytes(32).toString("hex");
  const child = spawn(dotnet,[dll,"--urls",base],{env:{...process.env,RACE_DESK_DATA:data,RACE_WEBSITE_KEY:websiteKey},stdio:"ignore"});
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once("exit",resolve));
      child.kill();
      await exited;
    }
    await rm(data,{recursive:true,force:true});
  });
  let key;
  for (let n=0;n<40;n++) {
    try {
      if ((await fetch(base+"/health")).ok) { key=await readFile(join(data,"operator.txt"),"utf8"); break; }
    } catch {}
    await pause(100);
  }
  assert.ok(key,"Desk started");
  async function api(path, token, data, expected=200) {
    const response = await fetch(base+path,{
      method:data === undefined ? "GET" : "POST",
      headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
      ...(data === undefined?{}:{body:JSON.stringify(data)})
    });
    assert.equal(response.status,expected,await response.clone().text());
    return response.status===204 || !response.headers.get("content-type") ? null : response.json();
  }
  await api("/desk/state",null,undefined,401);
  const rigs = [];
  for (let i=1;i<=4;i++) {
    const {code} = await api("/desk/pair-code",key,{});
    const rig = await api("/rig/pair",null,{name:"QA Rig "+i,code});
    rigs.push(rig);
    if (i===1) await api("/rig/pair",null,{name:"replay",code},409);
    await api("/rig/"+rig.id+"/poll",rig.key,{presets:["rf2-practice","ac-hotlap","iracing-hosted"],detail:"Simulated"});
  }
  const start = (index, preset, driver) => api("/desk/start",key,{preset,minutes:15,seats:[{rigId:rigs[index].id,driver}]});
  const eventId = randomUUID();
  const firstEntry = randomUUID(), nextEntry = randomUUID();
  const [rf] = await api("/desk/start",key,{preset:"rf2-practice",minutes:15,eventId,
    seats:[{rigId:rigs[0].id,driver:"Driver One",entryId:firstEntry}]});
  const [ir] = await start(1,"iracing-hosted","Driver Two");
  const [ac] = await start(2,"ac-hotlap","Driver Three");
  assert.equal(ir.status,"needs_staff");
  for (const rig of [rigs[0],rigs[2]]) {
    const url = "/rig/"+rig.id;
    const {command} = await api(url+"/poll",rig.key,{presets:["rf2-practice","ac-hotlap"],detail:"Simulated"});
    assert.equal(command.action,"start");
    assert.equal((await api(url+"/poll",rig.key,{presets:["rf2-practice","ac-hotlap"]})).command,null);
    await api(url+"/ack",rig.key,{id:command.id,ok:true,detail:"Software launch only"},204);
  }
  await api("/desk/session/"+rf.id,key,{action:"confirm"});
  const beforeRotation = new Date().toISOString();
  await pause(20);
  const rotated = await api("/desk/session/"+rf.id,key,{action:"rotate",driver:"Driver Four",entryId:nextEntry});
  assert.equal(rotated.seats.length,2);
  assert.ok(rotated.seats[0].to);
  assert.equal(rotated.seats[1].driver.name,"Driver Four");
  assert.notEqual(rf.id,ac.id);
  const result = {eventId,sessionId:rf.id,driverId:rotated.seats[0].driver.id,
    result:{entryId:firstEntry,game:"rfactor_2",occurredAt:beforeRotation}};
  await api("/desk/results",key,{...result,result:{...result.result,entryId:nextEntry}},409);
  assert.equal((await api("/desk/results",key,result)).status,"queued");
  await api("/site/v1/availability",key,undefined,401);
  const window = {start:new Date(Date.now()+1200000).toISOString(),end:new Date(Date.now()+2400000).toISOString()};
  const menu = await api("/site/v1/catalog",websiteKey,undefined);
  assert.ok(menu.some(game => game.id === "rf2-practice"));
  const hold = {externalId:"qa-web-id",rigIds:[rigs[0].id,rigs[3].id],preset:"rf2-practice",...window};
  await api("/site/v1/holds",websiteKey,{...hold,preset:"ac-traffic"},409);
  const [one,two] = await Promise.all([
    api("/site/v1/holds",websiteKey,hold),
    api("/site/v1/holds",websiteKey,hold)
  ]);
  assert.equal(one.expires,two.expires);
  await api("/site/v1/holds",websiteKey,{...hold,externalId:"other"},409);
  await api("/desk/session/"+rf.id,key,{action:"extend",minutes:15},409);
  await api("/site/v1/bookings/qa-web-id/confirm",websiteKey,{});
  await api("/site/v1/bookings/qa-web-id/confirm",websiteKey,{});
  await api("/site/v1/bookings/qa-web-id/release",websiteKey,{});
  const available = await api("/site/v1/availability?"+new URLSearchParams(window),websiteKey,undefined);
  assert.equal(available.length,4);
  await api("/desk/session/"+rf.id,key,{action:"finish",confirmed:true});
  assert.equal((await api("/desk/state",key)).rigs[0].session,null);
});

test("rFactor 2 XML fixture preserves native identity and timing", { skip: !dll }, async () => {
  const fixture = new URL("fixtures/rf2-result.xml",import.meta.url);
  const child = spawn(dotnet,[dll,"rf2-results",decodeURIComponent(fixture.pathname)]);
  let output = "", error = "";
  child.stdout.on("data", bytes => { output += bytes; });
  child.stderr.on("data", bytes => { error += bytes; });
  const code = await new Promise(resolve => child.once("close",resolve));
  assert.equal(code,0,error);
  const result = JSON.parse(output);
  assert.equal(result.source,"rfactor_2");
  assert.equal(result.track,"Fixture Raceway");
  assert.equal(result.drivers[0].steamId,"123456789");
  assert.equal(result.drivers[0].position,2);
  assert.equal(result.drivers[0].bestLapMs,65321);
});

test("four rig workers pair and acknowledge a shared desk request", { skip: !dll }, async t => {
  const data = await mkdtemp(join(tmpdir(),"str-rig-workers-"));
  const origin = "http://127.0.0.1:" + (process.env.RACE_WORKER_TEST_PORT ?? "15081");
  const children = [];
  const start = (...args) => {
    const child = spawn(dotnet,[dll,...args],{env:{...process.env,RACE_DESK_DATA:data},stdio:"ignore"});
    children.push(child);
    return child;
  };
  t.after(async () => {
    await Promise.all(children.map(async child => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const done = new Promise(resolve => child.once("exit",resolve));
      child.kill();
      await done;
    }));
    await rm(data,{recursive:true,force:true});
  });
  async function until(fn,predicate) {
    for (let attempt=0;attempt<80;attempt++) {
      try { const value=await fn(); if (predicate(value)) return value; } catch {}
      await pause(100);
    }
    assert.fail("Desk or rig workers did not become ready.");
  }
  start("--urls",origin);
  const key = await until(async () => {
    assert.ok((await fetch(origin+"/health")).ok);
    return readFile(join(data,"operator.txt"),"utf8");
  },value=>value.length===64);
  async function call(path, body) {
    const r=await fetch(origin+path,{
      method:body===undefined?"GET":"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    assert.ok(r.ok,await r.clone().text());
    return r.json();
  }
  for (let i=1;i<=4;i++) {
    const {code}=await call("/desk/pair-code",{});
    const file=join(data,"rig"+i+".json");
    await writeFile(file,JSON.stringify({desk:origin,name:"Simulated Pod "+i,code,simulated:true,verifiedPresets:["rf2-practice"]}));
    start("rig",file);
  }
  const desk=await until(()=>call("/desk/state"),value=>value.rigs.length===4 && value.rigs.every(r=>r.online));
  await call("/desk/start",{preset:"rf2-practice",minutes:30,seats:desk.rigs.map(r=>({rigId:r.id,driver:r.name}))});
  const after=await until(()=>call("/desk/state"),value=>value.rigs.every(r=>r.session?.status==="needs_staff"));
  assert.ok(after.rigs.every(r=>r.session.detail==="Simulated command acknowledged."));
});

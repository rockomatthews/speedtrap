import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { handle } from "../competition/lib/api.mjs";

const remote = process.env.RACE_TEST_URL;
const admin = process.env.RACE_ADMIN_KEY;
const configured = !!(admin && (remote || process.env.RACE_DATABASE_URL));
const id = randomUUID().slice(0,8);
async function call(path, key, data, expected = 200) {
  const request = new Request((remote ?? "http://localhost") + "/api/v1/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type":"application/json", ...(key ? { Authorization:"Bearer " + key } : {}) },
    ...(data === undefined ? {} : { body:JSON.stringify(data) })
  });
  const response = remote ? await fetch(request) : await handle(request, path.split("/"));
  const body = await response.json();
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}

test("two venues enter, review, correct and publish rFactor 2 results", { skip: !configured }, async () => {
  assert.deepEqual(await call("health"), { ok:true });
  await call("venues", null, undefined, 401);
  const home = await call("venues",admin,{name:"Speed Trap QA " + id,provider:"desk"},201);
  const guest = await call("venues",admin,{name:"External Venue QA " + id,provider:"partner"},201);
  const event = await call("events",admin,{
    name:"QA · Two-venue rFactor 2 " + id,game:"rfactor_2",track:"QA Track",car:"QA Car",build:"qa-fixed",
    rules:"Synthetic integration test. Best qualifying lap, official final positions.",
    startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString()
  },201);
  const base = "events/"+event.id;
  const a = await call(base+"/entries",home.key,{externalId:"42",alias:"Apex Test",consentToPublish:true});
  const b = await call(base+"/entries",guest.key,{externalId:"42",alias:"Partner Test",consentToPublish:true});
  assert.notEqual(a.id,b.id);
  assert.equal((await call(base+"/entries",guest.key)).length,1);
  await call(base+"/phase",guest.key,{phase:"check_in"},403);
  await call(base+"/phase",admin,{phase:"check_in"});
  await call(base+"/check-in/"+a.id,guest.key,{},404);
  await call(base+"/check-in/"+a.id,home.key,{});
  await call(base+"/check-in/"+b.id,guest.key,{});
  await call(base+"/phase",admin,{phase:"qualifying"});
  const lap = {sourceId:"qual-a",entryId:a.id,revision:1,kind:"lap",game:"rfactor_2",track:"QA Track",car:"QA Car",
    build:"qa-fixed",occurredAt:new Date(Date.now()+250).toISOString(),valid:true,lapMs:68000,provenance:"game_export",evidence:"QA fixture"};
  await call(base+"/results",guest.key,lap,409);
  const first = await call(base+"/results",home.key,lap);
  const retried = await call(base+"/results",home.key,lap);
  assert.equal(retried.id,first.id);
  assert.equal(retried.replayed,true);
  await call(base+"/results",home.key,{...lap,lapMs:67999},409);
  await call(base+"/review/"+first.id,admin,{decision:"accepted",note:"Verified fixture"});
  const correction = await call(base+"/results",home.key,{...lap,revision:2,lapMs:66000});
  const partner = await call(base+"/results",guest.key,{...lap,entryId:b.id,sourceId:"qual-b",lapMs:67000,provenance:"provider_feed"});
  const mismatch = await call(base+"/results",guest.key,{...lap,entryId:b.id,sourceId:"bad-build",build:"wrong"});
  assert.equal(mismatch.issue,"Ruleset mismatch.");
  await call(base+"/review/"+mismatch.id,admin,{decision:"accepted",note:"wrong"},422);
  await call(base+"/review/"+mismatch.id,admin,{decision:"rejected",note:"Build mismatch"});
  await call(base+"/review/"+correction.id,admin,{decision:"accepted",note:"Corrected fixture"});
  await call(base+"/review/"+partner.id,admin,{decision:"accepted",note:"Validated partner feed"});
  await call(base+"/phase",admin,{phase:"race"});
  const {lapMs, ...finish} = lap;
  const homeFinish = await call(base+"/results",home.key,{...finish,sourceId:"race-a",kind:"finish",position:2});
  const partnerFinish = await call(base+"/results",guest.key,{...finish,entryId:b.id,sourceId:"race-b",kind:"finish",position:1});
  await call(base+"/phase",admin,{phase:"review"});
  await call(base+"/phase",admin,{phase:"published"},409);
  await call(base+"/review/"+homeFinish.id,admin,{decision:"accepted",note:"Race finish verified"});
  await call(base+"/review/"+partnerFinish.id,admin,{decision:"accepted",note:"Race finish verified"});
  await call(base+"/phase",admin,{phase:"published"});
  const {board} = await call(base+"/standings");
  assert.deepEqual(board.qualifying.map(row=>row.lapMs),[66000,67000]);
  assert.deepEqual(board.race.map(row=>row.driver),["Partner Test","Apex Test"]);
  await call("credentials/"+guest.credentialId+"/revoke",admin,{});
  await call(base+"/entries",guest.key,undefined,401);
});

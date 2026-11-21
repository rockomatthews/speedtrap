import { z } from "zod";
import { Entry, Event, Phase, Result, Review, Venue } from "../../lib/model.mjs";

const ids = path => [...path.matchAll(/{(\w+)}/g)].map(([,name]) => ({
  name,in:"path",required:true,schema:{type:"string",format:"uuid"}
}));
const write = schema => ({
  required:true, content:{ "application/json":{ schema:z.toJSONSchema(schema,{io:"input"}) } }
});
function operation(path,summary,{auth=false,body,status="200"}={}) {
  return {
    summary,parameters:ids(path),
    ...(auth?{security:[{Bearer:[]}]}:{}),...(body?{requestBody:write(body)}:{}),
    responses:{
      [status]:{description:"Success",content:{"application/json":{schema:{}}}},
      "401":{description:"Missing, expired, or invalid credential"},
      "403":{description:"Action is outside credential scope"},
      "404":{description:"Resource unavailable to this caller"},
      "409":{description:"Phase, revision, or scheduling conflict"},
      "422":{description:"Input or competition rules failed validation"}
    }
  };
}
const events="/events";
const e=events+"/{eventId}";
const c="/credentials/{credentialId}/revoke";
export function GET() {
  return Response.json({
    openapi:"3.1.0",
    info:{title:"Speed Trap Competition API",version:"1.0.0",description:"Game-neutral venue entry and reviewed esports results."},
    servers:[{url:"/api/v1"}],
    components:{securitySchemes:{Bearer:{type:"http",scheme:"bearer"}}},
    paths:{
      "/health":{get:operation("/health","Database readiness")},
      "/venues":{get:operation("/venues","List venues (organizer)",{auth:true}),post:operation("/venues","Issue venue credential (organizer)",{auth:true,body:Venue,status:"201"})},
      [c]:{post:operation(c,"Revoke credential (organizer)",{auth:true})},
      [events]:{get:operation(events,"Discover scheduled events"),post:operation(events,"Schedule an event (organizer)",{auth:true,body:Event,status:"201"})},
      [e+"/rules"]:{get:operation(e+"/rules","Read event rules and content versions")},
      [e+"/standings"]:{get:operation(e+"/standings","Read last official publication")},
      [e+"/entries"]:{get:operation(e+"/entries","List entries visible to this venue",{auth:true}),
        post:operation(e+"/entries","Register a consenting driver",{auth:true,body:Entry})},
      [e+"/check-in/{entryId}"]:{post:operation(e+"/check-in/{entryId}","Check in an entry at its venue",{auth:true})},
      [e+"/results"]:{post:operation(e+"/results","Submit or revise a result",{auth:true,body:Result})},
      [e+"/phase"]:{post:operation(e+"/phase","Advance phase (organizer)",{auth:true,body:Phase})},
      [e+"/review"]:{get:operation(e+"/review","List latest result revisions and eligibility (organizer)",{auth:true})},
      [e+"/review/{resultId}"]:{post:operation(e+"/review/{resultId}","Accept or reject the current result (organizer)",{auth:true,body:Review})}
    }
  });
}

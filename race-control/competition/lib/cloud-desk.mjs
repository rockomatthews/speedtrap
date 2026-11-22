import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { body, identity } from "./api.mjs";
import { database, tx } from "./db.mjs";

const uuid = z.uuid();
const name = z.string().trim().min(1).max(80);
const minutes = z.number().int().min(1).max(240);
const decision = z.strictObject({
  action:z.enum(["confirm","extend","rotate","finish","revoke"]),
  confirmed:z.boolean().optional(),
  driver:name.optional(), minutes:minutes.optional()
});
const enroll = z.strictObject({ code:z.string().regex(/^[a-f0-9-]{36}\.[a-f0-9]{32}$/), name });
const start = z.strictObject({
  seats:z.array(z.strictObject({rigId:uuid,driver:name})).min(1).max(4), minutes
});
const poll = z.strictObject({ presets:z.array(z.string().max(40)).max(16), detail:z.string().max(240).nullish() });
const ack = z.strictObject({ id:uuid, ok:z.boolean(), detail:z.string().max(240).nullish() });
const issue = (status,message) => Object.assign(new Error(message),{status});
const hash = value => createHash("sha256").update(value).digest("hex");
const key = () => randomBytes(32).toString("hex");
const json = (value,status=200) => Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const online = (rig,now) => (rig.lastSeen ?? 0) + 20_000 > now;
const rigReady = (rig,now) => online(rig,now) && rig.ready;
const hasPending = (session,now) => session?.command && !session.command.done && session.command.expiresMs > now;

function status(rig, now) {
  const session = rig.session;
  if (!session) return rig.revoked ? "revoked" : rigReady(rig,now) ? "ready" : online(rig,now) ? "needs_config" : "offline";
  if (session.status === "launching" && !hasPending(session,now)) return "launch_unconfirmed";
  if (session.status === "racing" && session.endsAt <= now) return "time_up";
  return session.status;
}
function view(room, venueId, now) {
  return { venueId, now, rigs:room.rigs.filter(rig=>!rig.revoked).map(rig=>({
    id:rig.id, name:rig.name, online:online(rig,now), status:status(rig,now),
    detail:rig.detail ?? null, session:rig.session ? {
      driver:rig.session.driver, minutes:rig.session.minutes, endsAt:rig.session.endsAt ?? null,
      detail:rig.session.detail ?? null
    } : null
  }))};
}
async function useRoom(db,venueId,fn,create=false) {
  if (create) await db.query("INSERT INTO race_control.desk_rooms(venue_id) VALUES($1) ON CONFLICT DO NOTHING",[venueId]);
  const row = (await db.query("SELECT state FROM race_control.desk_rooms WHERE venue_id=$1 FOR UPDATE",[venueId])).rows[0];
  if (!row) throw issue(404,"Desk enrollment unavailable.");
  const value = await fn(row.state,Date.now());
  await db.query("UPDATE race_control.desk_rooms SET state=$2 WHERE venue_id=$1",[venueId,row.state]);
  return value;
}
async function device(request,id) {
  if (!uuid.safeParse(id).success) throw issue(404,"Rig unavailable.");
  const secret=request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!secret) throw issue(401,"Rig credential required.");
  const row=(await database().query(
    "SELECT venue_id FROM race_control.desk_rig_keys WHERE id=$1 AND secret_hash=$2 AND revoked_at IS NULL",
    [id,hash(secret)])).rows[0];
  if (!row) throw issue(401,"Invalid rig credential.");
  return row.venue_id;
}

export async function handleDesk(request,path) {
  const [resource,id,action,...tail] = path;
  const post=request.method==="POST";
  try {
    if (tail.length) throw issue(404,"Unknown desk route.");
    if (resource==="rig" && id==="pair" && !action && post) {
      const input=await body(request,enroll);
      const [venueId,code]=input.code.split(".");
      if (!uuid.safeParse(venueId).success) throw issue(422,"Invalid pairing code.");
      return json(await tx(db=>useRoom(db,venueId,async (room,now)=>{
        const ticket=room.tickets.find(item=>item.hash===hash(code) && item.expires>now);
        if (!ticket) throw issue(409,"Pairing code is invalid or expired.");
        if (room.rigs.filter(r=>!r.revoked).length>=4) throw issue(409,"All four pilot rig slots are in use.");
        if (room.rigs.some(r=>!r.revoked && r.name.toLowerCase()===input.name.toLowerCase()))
          throw issue(409,"That rig name is already in use.");
        const rig={id:randomUUID(),name:input.name,session:null};
        const secret=key();
        await db.query("INSERT INTO race_control.desk_rig_keys(id,venue_id,secret_hash) VALUES($1,$2,$3)",[rig.id,venueId,hash(secret)]);
        room.tickets=room.tickets.filter(item=>item!==ticket && item.expires>now);
        room.rigs=room.rigs.filter(r=>!r.revoked);
        room.rigs.push(rig);
        return {id:rig.id,key:secret};
      })),201);
    }
    if (resource==="rig" && post && ["poll","ack"].includes(action)) {
      const venueId=await device(request,id);
      const input=await body(request,action==="poll"?poll:ack);
      const result=await tx(db=>useRoom(db,venueId,(room,now)=>{
        const rig=room.rigs.find(r=>r.id===id && !r.revoked);
        if (!rig) throw issue(401,"Invalid rig credential.");
        const session=rig.session;
        const command=session?.command;
        if (action==="poll") {
          rig.lastSeen=now;
          rig.ready=input.presets.includes("rf2-practice");
          rig.detail=input.detail ?? null;
          if (!hasPending(session,now) || command.sent) return {command:null};
          command.sent=true;
          return {command:{id:command.id,action:"start",preset:"rf2-practice",expires:new Date(command.expiresMs).toISOString()}};
        }
        if (command?.id!==input.id || !command.sent) throw issue(404,"Command unavailable.");
        if (!command.done && command.expiresMs>now) {
          command.done=true;
          session.status=input.ok?"awaiting_drive":"launch_unconfirmed";
          session.detail=input.detail ?? null;
        }
        return null;
      }));
      return action==="poll"?json(result):new Response(null,{status:204});
    }

    const actor=await identity(request);
    if (actor.provider!=="desk" || !actor.venue) throw issue(403,"Use a venue-scoped desk key.");
    if (resource==="state" && !id && request.method==="GET") {
      const row=(await database().query("SELECT state FROM race_control.desk_rooms WHERE venue_id=$1",[actor.venue])).rows[0];
      return json(view(row?.state ?? {rigs:[]},actor.venue,Date.now()));
    }
    if (resource==="pair-code" && !id && post) return json(await tx(db=>useRoom(db,actor.venue,(room,now)=>{
      const code=randomBytes(16).toString("hex");
      room.tickets=room.tickets.filter(item=>item.expires>now).slice(-7);
      room.tickets.push({hash:hash(code),expires:now+300_000});
      return {code:actor.venue+"."+code};
    },true)));
    if (resource==="start" && !id && post) {
      const input=await body(request,start);
      return json(await tx(db=>useRoom(db,actor.venue,(room,now)=>{
        if (new Set(input.seats.map(s=>s.rigId)).size!==input.seats.length) throw issue(422,"Select distinct rigs.");
        for (const seat of input.seats) {
          const rig=room.rigs.find(r=>r.id===seat.rigId && !r.revoked);
          if (!rig || !rigReady(rig,now) || rig.session) throw issue(409,"A selected rig is busy, offline, or missing the rFactor 2 preset.");
          rig.session={driver:seat.driver,minutes:input.minutes,status:"launching",
            command:{id:randomUUID(),expiresMs:now+45_000,sent:false,done:false}};
        }
        return view(room,actor.venue,now);
      })));
    }
    if (resource==="session" && uuid.safeParse(id).success && !action && post) {
      const input=await body(request,decision);
      return json(await tx(db=>useRoom(db,actor.venue,async(room,now)=>{
        const rig=room.rigs.find(r=>r.id===id && !r.revoked);
        if (!rig) throw issue(404,"Rig unavailable.");
        const session=rig.session;
        if (input.action==="revoke" && input.confirmed && !session) {
          await db.query("UPDATE race_control.desk_rig_keys SET revoked_at=now() WHERE id=$1 AND venue_id=$2",[id,actor.venue]);
          rig.revoked=true;
        } else if (input.action==="confirm" && session && online(rig,now) && ["launch_unconfirmed","awaiting_drive"].includes(status(rig,now))) {
          session.status="racing";session.endsAt=now+session.minutes*60_000;
        } else if (input.action==="rotate" && session?.status==="racing" && session.endsAt>now && input.driver) {
          session.driver=input.driver;
        } else if (input.action==="extend" && session?.status==="racing" && session.endsAt>now &&
                   input.minutes && session.minutes+input.minutes<=240) {
          session.minutes+=input.minutes;session.endsAt+=input.minutes*60_000;
        } else if (input.action==="finish" && input.confirmed && session && !hasPending(session,now)) {
          rig.session=null;
        } else throw issue(409,"That action is unavailable for this rig or session.");
        return view(room,actor.venue,now);
      })));
    }
    throw issue(404,"Unknown desk route.");
  } catch (error) {
    if (error.status) return json({error:error.message},error.status);
    console.error("Cloud desk error",error.code ?? error.name);
    return json({error:"Desk service unavailable."},503);
  }
}

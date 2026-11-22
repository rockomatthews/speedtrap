import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { database, tx } from "./db.mjs";
import { Event, Venue, Entry, Result, Review, Phase, uuid, transitions, eligibility, standings } from "./model.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const problem = (status, message) => Object.assign(new Error(message), { status });
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const first = ({ rows }) => rows[0];
const publicEvent = "id,name,game,track,car,build,rules,starts_at,ends_at,phase";

export async function body(request, schema) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw problem(415, "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw problem(400, "A JSON request body is required.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16000) {
        await reader.cancel();
        throw problem(413, "Request is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw problem(400, "Invalid JSON."); }
  const result = schema.safeParse(parsed);
  if (!result.success) throw problem(422, result.error.issues.map(i => i.path.join(".") + " " + i.message).join(" / "));
  return result.data;
}

export async function identity(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
  if (!token) throw problem(401, "A bearer credential is required.");
  const secret = process.env.RACE_ADMIN_KEY;
  if (secret && timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(secret))))
    return { admin: true, provider: "staff" };
  const row = first(await database().query(
    "SELECT venue_id,provider FROM race_control.credentials WHERE secret_hash=$1 AND revoked_at IS NULL", [hash(token)]
  ));
  if (!row) throw problem(401, "Credential expired or invalid.");
  return { admin: false, provider: row.provider, venue: row.venue_id };
}
function organizer(actor) {
  if (!actor.admin) throw problem(403, "Organizer access is required.");
}
function venueScope(actor, requested) {
  if (actor.admin && requested) return requested;
  if (!actor.admin && (!requested || requested === actor.venue)) return actor.venue;
  throw problem(403, "Use a credential scoped to this venue.");
}
async function readEvent(db, id, lock = false) {
  const event = first(await db.query("SELECT * FROM race_control.events WHERE id=$1" + (lock ? " FOR UPDATE" : ""), [id]));
  if (!event) throw problem(404, "Event not found.");
  return event;
}
async function audit(db, id, action, detail) {
  await db.query("INSERT INTO race_control.audit(event_id,action,detail) VALUES($1,$2,$3)", [id, action, detail]);
}
async function current(db, id) {
  return (await db.query(`
    SELECT latest.*,e.alias,v.name AS venue FROM (
      SELECT DISTINCT ON (venue_id,provider,source_id) *
      FROM race_control.results WHERE event_id=$1
      ORDER BY venue_id,provider,source_id,revision DESC
    ) latest JOIN race_control.entries e ON e.id=latest.entry_id
    JOIN race_control.venues v ON v.id=latest.venue_id
    ORDER BY latest.created_at,latest.id LIMIT 2001`, [id])).rows;
}

async function submit(db, event, actor, input) {
  const venue = venueScope(actor, input.venueId);
  const entry = first(await db.query(
    "SELECT * FROM race_control.entries WHERE id=$1 AND event_id=$2 AND venue_id=$3",
    [input.entryId, event.id, venue]
  ));
  if (!entry?.checked_in_at) throw problem(409, "The assigned driver must be checked in at that venue.");
  if (Date.parse(input.occurredAt) < Date.parse(entry.checked_in_at)) throw problem(422, "The result predates driver check-in.");
  const previous = first(await db.query(
    `SELECT * FROM race_control.results WHERE event_id=$1 AND venue_id=$2 AND provider=$3 AND source_id=$4
     ORDER BY revision DESC LIMIT 1`, [event.id, venue, actor.provider, input.sourceId]
  ));
  const { venueId, ...payload } = input;
  if (previous && input.revision <= previous.revision) {
    const existing = first(await db.query(
      `SELECT id, review, payload=$6::jsonb AS same FROM race_control.results
       WHERE event_id=$1 AND venue_id=$2 AND provider=$3 AND source_id=$4 AND revision=$5`,
      [event.id, venue, actor.provider, input.sourceId, input.revision, JSON.stringify(payload)]
    ));
    if (existing?.same) return { id: existing.id, review: existing.review, replayed: true };
    throw problem(409, "This source revision conflicts with a stored result.");
  }
  if (previous && (previous.entry_id !== input.entryId || previous.payload.kind !== input.kind))
    throw problem(409, "Corrections must keep the original driver and result type.");
  const phases = input.kind === "lap" ? ["qualifying", "race", "review"] : ["race", "review"];
  if (!phases.includes(event.phase)) throw problem(409, "This result type is closed in the current phase.");
  if (actor.provider === "staff" && input.provenance === "provider_feed")
    throw problem(422, "Staff must use an export or staff-attested evidence.");
  if (actor.provider !== "staff" && input.provenance === "staff_attested")
    throw problem(422, "Staff evidence must be submitted in the staff portal.");
  const row = first(await db.query(
    `INSERT INTO race_control.results(event_id,entry_id,venue_id,provider,source_id,revision,payload)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,review`,
    [event.id,input.entryId,venue,actor.provider,input.sourceId,input.revision,payload]
  ));
  await audit(db, event.id, "result.submitted", { id: row.id, provider: actor.provider, venue, revision: input.revision });
  return { ...row, issue: eligibility(event, input) };
}

export async function handle(request, [resource, id, action, target, ...extra]) {
  try {
    const get = request.method === "GET", post = request.method === "POST";
    if (extra.length) throw problem(404, "Route not found.");
    if (resource === "health" && !id && get) {
      await database().query("SELECT 1 FROM race_control.events LIMIT 1");
      return json({ ok: true });
    }
    if (resource === "events" && !id && get)
      return json((await database().query("SELECT " + publicEvent + " FROM race_control.events ORDER BY starts_at DESC LIMIT 50")).rows);
    if (resource === "events" && id && !target && get && ["standings","rules"].includes(action)) {
      if (!uuid.safeParse(id).success) throw problem(404, "Event not found.");
      const event = await readEvent(database(), id);
      if (action === "standings") return json({ event: event.name, phase: event.phase, board: event.publication });
      const { publication, allow_attested, ...rules } = event;
      return json({ ...rules, allow_attested });
    }
    const actor = await identity(request);
    if (resource === "venues" && !id) {
      organizer(actor);
      if (get) return json((await database().query("SELECT id,name FROM race_control.venues ORDER BY name LIMIT 200")).rows);
      if (post) {
        const input = await body(request, Venue);
        return json(await tx(async db => {
          const venue = first(await db.query(
            `INSERT INTO race_control.venues(name) VALUES($1)
             ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id,name`, [input.name]
          ));
          const key = randomBytes(32).toString("hex");
          const credential = first(await db.query(
            "INSERT INTO race_control.credentials(venue_id,provider,secret_hash) VALUES($1,$2,$3) RETURNING id",
            [venue.id,input.provider,hash(key)]
          ));
          return { ...venue, provider: input.provider, key, credentialId: credential.id };
        }), 201);
      }
    }
    if (resource === "credentials" && uuid.safeParse(id).success && action === "revoke" && !target && post) {
      organizer(actor);
      const row = await database().query("UPDATE race_control.credentials SET revoked_at=now() WHERE id=$1", [id]);
      if (!row.rowCount) throw problem(404, "Credential not found.");
      return json({ revoked: true });
    }
    if (resource === "events" && !id && post) {
      organizer(actor);
      const data = await body(request, Event);
      return json(first(await database().query(
        `INSERT INTO race_control.events(name,game,track,car,build,rules,starts_at,ends_at,allow_attested)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [data.name,data.game,data.track,data.car,data.build,data.rules,data.startsAt,data.endsAt,data.allowAttested]
      )), 201);
    }
    if (resource !== "events" || !uuid.safeParse(id).success) throw problem(404, "Route not found.");
    if (get && !target && action === "entries") {
      const rows = (await database().query(
        `SELECT e.*,v.name AS venue FROM race_control.entries e JOIN race_control.venues v ON e.venue_id=v.id
         WHERE event_id=$1 AND ($2::uuid IS NULL OR venue_id=$2) ORDER BY e.alias LIMIT 1000`, [id, actor.venue ?? null]
      )).rows;
      return json(rows);
    }
    if (get && !target && action === "review") {
      organizer(actor);
      const event = await readEvent(database(), id);
      return json((await current(database(), id)).map(row => ({ ...row, issue: eligibility(event, row.payload) })));
    }
    if (!post) throw problem(404, "Route not found.");
    let input;
    if (action === "entries" && !target) input = await body(request, Entry);
    else if (action === "results" && !target) input = await body(request, Result);
    else if (action === "phase" && !target) { organizer(actor); input = await body(request, Phase); }
    else if (action === "review" && uuid.safeParse(target).success) { organizer(actor); input = await body(request, Review); }
    else if (action !== "check-in" || !uuid.safeParse(target).success) throw problem(404, "Route not found.");
    return json(await tx(async db => {
      const event = await readEvent(db, id, true);
      if (action === "entries") {
        if (!["registration", "check_in"].includes(event.phase)) throw problem(409, "Registration is closed.");
        const venue = venueScope(actor,input.venueId);
        if ((await db.query("SELECT count(*)::int AS count FROM race_control.entries WHERE event_id=$1", [id])).rows[0].count >= 1000)
          throw problem(409, "The event registration limit has been reached.");
        return first(await db.query(
          `INSERT INTO race_control.entries(event_id,venue_id,external_id,alias) VALUES($1,$2,$3,$4)
           ON CONFLICT(event_id,venue_id,external_id) DO UPDATE SET alias=excluded.alias RETURNING id`,
          [id,venue,input.externalId,input.alias]
        ));
      }
      if (action === "check-in") {
        if (!["check_in","qualifying"].includes(event.phase)) throw problem(409, "Check-in is unavailable in this phase.");
        const row = first(await db.query(
          `UPDATE race_control.entries SET checked_in_at=COALESCE(checked_in_at,now())
           WHERE event_id=$1 AND id=$2 AND ($3::uuid IS NULL OR venue_id=$3) RETURNING id,checked_in_at`,
          [id,target,actor.venue ?? null]
        ));
        if (!row) throw problem(404, "Entry not found.");
        return row;
      }
      if (action === "results") {
        const count = first(await db.query("SELECT count(*)::int AS count FROM race_control.results WHERE event_id=$1", [id])).count;
        if (count >= 2000) throw problem(409, "The pilot result limit has been reached.");
        return submit(db, event, actor, input);
      }
      if (action === "review") {
        if (!["qualifying","race","review"].includes(event.phase)) throw problem(409, "Result review is closed.");
        const row = (await current(db, id)).find(r => r.id === target);
        if (!row) throw problem(404, "Current result revision not found.");
        const issue = eligibility(event, row.payload);
        if (input.decision === "accepted" && issue) throw problem(422, issue);
        await db.query("UPDATE race_control.results SET review=$2,review_note=$3 WHERE id=$1", [target,input.decision,input.note]);
        await audit(db,id,"result.reviewed",{ id: target, ...input });
        return { reviewed: true };
      }
      if (!transitions[event.phase]?.includes(input.phase)) throw problem(409, "Invalid event phase transition.");
      if (input.phase === "published") {
        const rows = await current(db, id);
        if (rows.some(r => r.review === "pending")) throw problem(409, "Review all current result revisions before publishing.");
        const accepted = rows.filter(r => r.review === "accepted" && !eligibility(event,r.payload));
        if (!accepted.some(r => r.payload.kind === "finish")) throw problem(409, "Accept at least one race finish before publishing.");
        const ranked = accepted.filter(r => r.payload.kind === "finish");
        if (new Set(ranked.map(r => r.entry_id)).size !== ranked.length ||
            new Set(ranked.map(r => r.payload.position)).size !== ranked.length)
          throw problem(409, "Resolve duplicate drivers or finishing positions before publishing.");
        const publication = { ...standings(accepted), publishedAt: new Date().toISOString() };
        await db.query("UPDATE race_control.events SET phase=$2,publication=$3 WHERE id=$1", [id,input.phase,publication]);
        await audit(db,id,"standings.published",publication);
      } else {
        await db.query("UPDATE race_control.events SET phase=$2 WHERE id=$1", [id,input.phase]);
        await audit(db,id,"phase.changed",{ from:event.phase,to:input.phase });
      }
      return { phase: input.phase };
    }));
  } catch (error) {
    if (error.status) return json({ error: error.message }, error.status);
    if (error.code === "23503") return json({ error: "Venue or event reference is invalid." }, 422);
    console.error("Race Control API", error.code ?? error.name);
    return json({ error: "Competition database unavailable." }, 503);
  }
}

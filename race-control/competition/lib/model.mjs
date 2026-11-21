import { z } from "zod";
const short = z.string().trim().min(1).max(120);
const date = z.iso.datetime({ offset: true });
export const uuid = z.uuid();
export const game = z.enum(["rfactor_2", "assetto_corsa", "iracing"]);
export const Event = z.strictObject({
  name: short, game, track: short, car: short, build: short,
  rules: z.string().trim().min(1).max(2000), startsAt: date, endsAt: date,
  allowAttested: z.boolean().default(false)
}).refine(e => Date.parse(e.startsAt) < Date.parse(e.endsAt), "Event end must follow its start.");
export const Venue = z.strictObject({ name: short, provider: z.enum(["desk", "vms", "multitap", "partner", "staff"]) });
export const Entry = z.strictObject({ externalId: short, alias: short, consentToPublish: z.literal(true), venueId: uuid.optional() });
export const Review = z.strictObject({ decision: z.enum(["accepted", "rejected"]), note: z.string().trim().min(1).max(500) });
export const Phase = z.strictObject({ phase: z.enum(["check_in", "qualifying", "race", "review", "published"]) });
export const Result = z.strictObject({
  entryId: uuid, venueId: uuid.optional(), sourceId: short, revision: z.number().int().min(1).max(1000000),
  kind: z.enum(["lap", "finish"]), game, track: short, car: short, build: short,
  occurredAt: date, valid: z.boolean(), lapMs: z.number().int().min(1).max(86400000).optional(),
  position: z.number().int().min(1).max(1000).optional(), withdrawn: z.boolean().default(false),
  provenance: z.enum(["game_export", "provider_feed", "staff_attested"]),
  evidence: z.string().trim().min(1).max(800)
}).refine(result => result.withdrawn || (result.kind === "lap" ? result.lapMs && result.position === undefined :
  result.position && result.lapMs === undefined), "Provide exactly one time or finishing position for its result kind.");

export const transitions = {
  registration: ["check_in"], check_in: ["qualifying"], qualifying: ["race"], race: ["review"],
  review: ["published"], published: ["review"]
};

export function eligibility(event, result) {
  if (event.game !== result.game || event.track !== result.track || event.car !== result.car || event.build !== result.build) return "Ruleset mismatch.";
  const when = Date.parse(result.occurredAt);
  if (when < Date.parse(event.starts_at) || when > Date.parse(event.ends_at)) return "Result is outside the event window.";
  if (result.withdrawn || !result.valid) return "Invalid or withdrawn result.";
  if (result.provenance === "staff_attested" && !event.allow_attested) return "This event requires game or provider evidence.";
  return null;
}
export function standings(rows) {
  const laps = new Map();
  const finishes = new Map();
  for (const row of rows) {
    const table = row.payload.kind === "lap" ? laps : finishes;
    const score = row.payload.kind === "lap" ? row.payload.lapMs : row.payload.position;
    const prior = table.get(row.entry_id);
    if (!prior || score < prior.score) table.set(row.entry_id, { driver: row.alias, venue: row.venue, score });
  }
  const ordered = (table, key) => [...table.values()]
    .sort((a, b) => a.score - b.score || a.driver.localeCompare(b.driver) || a.venue.localeCompare(b.venue))
    .map(({ driver, venue, score }) => ({ driver, venue, [key]: score }));
  return { qualifying: ordered(laps, "lapMs"), race: ordered(finishes, "position") };
}

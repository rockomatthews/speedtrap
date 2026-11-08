# Racing engagement: shadow pilot

Branch: `codex/racing-engagement-shadow`. The isolated collector is now running; see [review environment](review-environment.md) for its dashboard, schedule and verification. No production rollout is included.

## Operating contract

This build records proposed **all-time record losses**, not arbitrary position losses. Compare only the same source, venue, car, circuit and transmission. VMS does not establish matching game builds, assists or conditions here; staff must approve eligible boards before any future delivery release.

There is no email transport, delivery worker, send action or live-mode switch. Reviewing an alert never sends it. No customer email addresses are copied into this subsystem.

Apply `supabase/migrations/20261108040608_racing_engagement_shadow.sql` to an isolated review database with the existing profiles schema. Configure the usual server Supabase and VMS credentials, `VMS_HOME_VENUE_ID`, and `RACING_ENGAGEMENT_SHADOW_ENABLED=true`. Default is disabled. Visit `/admin/racing-engagement` as an administrator. Run batches until baseline completes; subsequent runs detect new records. Existing history is silent.

The authenticated endpoint `/api/cron/racing-engagement` accepts the existing CRON_SECRET bearer token. Schedule every five minutes in the review environment. No production cron was added: Vercel preview deployments do not automatically run production cron schedules. Each invocation fetches at most one new 500-lap page and one reconciliation page; initial setup also reads the newest ID. Budget this alongside booking sync against the vendor quota. A 15-second request timeout retains the prior committed checkpoint. Concurrent jobs use optimistic version checks under a database lock.

## Review and release gates

1. Replay fixtures: baseline, self improvements, ties, separate cars/tracks/transmissions, invalid laps, duplicates, delayed imports, corrections and deletions.
2. In shadow, compare real proposals with VMS and the correct public board. Review enough real record changes to cover these cases, not simply elapsed time.
3. Confirm profile-to-VMS identity is unique, including shared pods and changing drivers. Identity linkage is not consent.
4. Before a separate delivery implementation: notification preferences, verified recipient, unsubscribe, cooldown/global daily cap, durable outbox, delivery idempotency, bounce suppression and revalidation. Define record scopes and competition end/reset rules.
5. Backfill must never email old losses. Corrections must invalidate proposals. Full reconciliation freshness must gate delivery; shadow reconciliation is incremental, not instantaneous.

Disable collection by removing the enable flag. Existing previews remain private. Do not delete other booking or lap data. The migration is additive and must not be applied to production merely to view this branch.

## VMS controls: next proof, not a fictional launch API

Official cloud API exposes laps/catalog/bookings/events; it does not establish remote rig launch control. Use native VMS Desktop controls first. Do not place arbitrary shell commands or VMS credentials in the browser.

On one idle venue rig, record VMS Desktop/Connect versions and consult the licensed manual. Validate selecting a car/track, launching solo/AI, launching a group server, stopping one selected rig, extending within the next booking boundary, spectator mode, and returning to the normal profile. Record which controls are supported and their actual interfaces. Repeat with all four rigs and a disconnected client. Never stop an occupied pod silently: show affected drivers and require explicit staff confirmation.

Website control design: validated installed-content presets; staff selects pods and preset; server checks authorization, occupancy and upcoming bookings; local adapter acknowledges a versioned command with a short expiry and idempotency key; UI shows pending/acknowledged/failed, never optimistic success. Unsupported commands remain unavailable. Default agent permissions read-only until physical validation. Unknown state disables launch/extension. Keep driver/controller configuration per rig.

No local control adapter or rig operation is claimed by this build. The user has previously reported no remote rig access.

## Provider-neutral network foundation

Current source interface normalizes lap facts and scopes identities to a provider. This is an internal boundary, not a published MultiTap connector. Future signed events need provider + venue + event IDs, revision/tombstone semantics, game/content/build/settings fingerprint, timing precision, validation tier, provenance, consent and visibility. Never merge drivers by display name. Cross-venue boards require equivalent rules and content, not merely matching track names. Adapter-specific capabilities must be negotiated; ingesting results does not confer rig control.

Future connectors: VMS, MultiTap where their supported API permits, and other sim-center systems. Use documented authentication and explicit venue permission; no scraping private customer data or assumption that demo access grants an integration license.

## Capability backlog and sequencing

| Stage | Capabilities | Validation/dependency |
|---|---|---|
| 1 (this pilot) | Record-loss previews, review log, incremental lap import | Shadow evidence and corrections |
| 2 | Position-loss, personal bests, milestones, editable templates, delivery logs | Board definitions, preferences and outbox |
| 2 | Session summaries, birthday/comeback reminders, weekly digests | Reliable visits/rotation identity, supplied birthdays, activity and consent |
| 2 | Challenge announcements, final results, scheduled hotlap challenges | Lifecycle/finalized standings; launching is separate |
| 3 | Custom/sponsor leaderboards, profiles, club/company boards, private event boards | Visibility and organization permissions |
| 3 | Analytics, unpopular-content reports | Laps support popularity; utilization requires occupancy evidence |
| 3 | Discord announcements/commands | Linked identities, authorized channels and shared event stream |
| 4 | Website car/track catalog, staff selection, saved solo/AI presets | Installed compatible content, native VMS validation |
| 4 | Phone/tablet start/stop/extend, wheel/button-box menus | Supported local interface and controller tests |
| 4 | Party guest queues, timed rotation, customer group lobbies | Roster/entitlements, capacity and private server orchestration |
| 4 | Complex leagues, heats/finals, grids, penalties | Audited race results and progression engine |
| 5 | Traffic driving, near-miss/combo scores | Separate traffic server/content and scoring telemetry |
| 5 | Home participants | Network security, matching content, identity and reserved venue seats |
| 5 | Moving track map, collisions/cuts, spectator broadcasts | Real-time local telemetry; supported native VMS spectator controls |
| 5 | Content/mod sync, readiness checks, updates/rollback | Manifests, controller preservation, idle checks, signed releases, recovery |
| 5 | Motion seats, flight sims/other applications | Device/game testing; process launch is not telemetry support |
| 6 | Public API, signed outgoing webhooks, venue backups | Auth, replay protection, revisions, restore drills across local/cloud systems |
| 6 | Cross-location boards and provider-neutral sim-center network | Consent, trusted results, equivalent rules and adapter contracts |

## Sources inspected

- MultiTap demo: https://demo.mlttp.com/ (simulated rigs; observed launcher, notifications and reports navigation, not proven physical control)
- https://multitap.space/docs/email.html
- https://multitap.space/docs/groups.html
- https://multitap.space/docs/rig-launcher.html
- https://multitap.space/docs/api.html
- https://api.simracing.co.uk/docs/v0.1/
- https://www.simracing.co.uk/downloads.php

## Verification commands

Use the same Node version and environment as the existing project. Install `@electric-sql/pglite@0.3.14` in an isolated tooling directory, then set `RACING_PGLITE_MODULE` to its absolute `dist/index.js` path and run `node --test tests/*.test.cjs`. The SQL tests create an in-memory database and never call production. Run `npm run build` with the existing required application environment. Do not place secrets in this document or commit environment files.

Demo launcher readback: idle cockpit exposes driver selection, Assetto Corsa, duration options and custom minutes. ACC/iRacing were disabled pending configured launch paths; Check rig was disabled and labelled as needing launcher 1.2.0. Broadcast targets expose join/leave, automatic mode and restart-video controls. No session was started or setting changed during inspection.

### First rig-control evidence collection

`scripts/vms/inspect-readiness.ps1` is a read-only Windows PowerShell inventory helper for staff to run on each rig. It reports relevant installed software versions, graphics resolution, candidate controllers and process presence as JSON. It does not install, launch, terminate, alter VMS or upload anything. It has not been run on venue Windows hardware. Staff must still verify controller calibration, content and licensing manually. Label reports with pod numbers when submitting them; do not add license keys.

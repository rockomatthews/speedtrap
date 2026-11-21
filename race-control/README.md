# Speed Trap Race Control

Standalone test branch. The first three integrations, in order, are rFactor 2, original Assetto Corsa with AssettoServer traffic, and iRacing. Speed Trap is the intended first venue and first customer of our own API. The pilot uses its own data, credentials and deployment. The existing site is outside this branch's release scope.

## Run the desk and four rigs

1. Build a Windows distribution with `installer/Build-Windows.ps1`. The ZIP contains the Desk and Rig roles. Provide a code-signing certificate when shipping an installer to a venue. Build locally for loopback with `dotnet publish desk -c Release -o /path/to/desk`, then run `dotnet /path/to/desk/RaceControl.dll --urls http://127.0.0.1:5080`.
2. Run `Install-SpeedTrap.ps1 -Role Desk` in the extracted Windows package. Open the shortcut, then the desk URL. The desk logs the path to its operator key. Keep the key on the desk PC. The same user account owns the SQLite database and local game-server settings.
3. For LAN rigs, configure a trusted certificate on Kestrel and bind the desk to its HTTPS LAN address. For example, set `ASPNETCORE_Kestrel__Certificates__Default__Path` and `ASPNETCORE_Kestrel__Certificates__Default__Password` under the desk account before starting it with `--urls https://desk.example.internal:5080`. Allow only the venue LAN to connect. Each Windows rig must trust the certificate authority and resolve the desk host. Loopback HTTP is for local testing.
4. Pair each PC using a new code from **Pair a rig**. Run `Install-SpeedTrap.ps1 -Role Rig` in the Windows user account that runs the game. Enter the desk URL, rig name, correct Steam library, and presets verified on that PC. Then launch the Rig shortcut in that user session. For loopback testing, create per-rig JSON files containing `desk`, `name`, `code`, `verifiedPresets` and `simulated: true`, and run `RaceControl rig path-to-config.json` for each. The installer exports visible HID devices for staff review.
5. Select ready seats, choose a preset and duration, assign a driver to each seat, and start. Confirm the drivers are on track when the game is ready. The timer tracks the reservation, and staff clears the seat after the driver exits. Capture the assignment history before reviewing results. If the network drops, consult the local desk, which uses SQLite, and handle any disputed seat on-site. Use `-UsePrevious` on an idle desk or rig to swap its current and previous app binaries. Keep a backup of desk data before upgrading.

## First three integrations

- **rFactor 2:** Install and prepare the Studio 397 dedicated-server tool and match the race event, packages, controls, and version on every participating rig. Write `server-rf2.json` in the desk data folder with an absolute installation `root` and optional local `profile`. The desk opens the tool with the documented `+path` and profile options. Staff completes the server wizard and each game client joins through the native lobby. Practice opens the Steam game and uses the verified car and track selected in-game. Use `RaceControl.exe rf2-results path-to-results.xml` to review IDs, finishing positions, and reported best lap time from an export. The parser has synthetic coverage. On-site, confirm actual XML structure, lap validity, session settings and identity before accepting results.
- **Assetto Corsa traffic:** Install original Assetto Corsa on the rigs with the approved CSP build and venue-licensed map/car content. Install and configure the separate AssettoServer process, including a tested AI spline. Set `server-traffic.json` in the desk data folder with the server's absolute `root`. The desk opens the server and Steam client. Staff joins the configured lobby and confirms the seat. No traffic score feed has been verified. Assetto Corsa EVO Free Roam has a separate release gate.
- **iRacing:** Confirm the installed commercial edition, hosting rights and supported data interface before enabling native integration. The desk holds the seats and tracks time and drivers. Staff creates and starts the approved hosted session, matches driver IDs to check-in, and uses official results or permitted staff attestation. Confirm two drivers on one seat, then a four-driver event. Automatic launch and game data capture are pending commercial-build verification.

- [rFactor 2 dedicated server setup](https://docs.studio-397.com/pages/viewpage.action?pageId=37946002)
- [AssettoServer setup](https://assettoserver.org/docs/thebeginnersguide/)
- [iRacing hosting](https://support.iracing.com/support/solutions/articles/31000147700-how-much-do-hosted-sessions-cost-)

## Website API

The desk is the source of truth for bookings. Keep the website integration server-side, using the separately scoped `RACE_WEBSITE_KEY` over a private HTTPS route to the desk. The public browser should talk to the Speed Trap website, which in turn calls the venue API. Keep the desk on its LAN. A hosted website will need a private connection or an outbound relay before the venue can use it.

OpenAPI: `GET /website-openapi.json` on a running desk. Client: `tools/site-client.mjs`.

1. Call `GET /site/v1/catalog` for verified venue presets. Call `GET /site/v1/availability?start=...&end=...&preset=...` with ISO date-times and an optional preset.
2. Call `POST /site/v1/holds` with `externalId` (an immutable website booking ID), `rigIds`, `start`, `end`, and an optional `preset`. A hold lasts ten minutes. An identical retry returns the same state and expiry. A booking ID reused with a different window or rig list returns a conflict.
3. Call `POST /site/v1/bookings/{id}/confirm` once the website's checkout confirms payment. If the request times out, read `GET /site/v1/bookings/{id}` before taking another action. A confirmed booking is eligible for the normal desk booking workflow. An expired hold requires checkout reconciliation.
4. Call `POST /site/v1/bookings/{id}/release` for cancellations. Active racing seats require staff to finish their sessions first. There is no billing side effect from any desk endpoint.

## Competition API

Set `RACE_DATABASE_URL` and `RACE_ADMIN_KEY` in `competition`. Use a dedicated Postgres database. Apply `competition/supabase/migrations/*_race_control_pilot.sql`. For Supabase, supply the provider CA in `RACE_DATABASE_CA` and use a restricted role with schema usage, table select/insert/update, and sequence usage. Run `npm ci` and `npm run dev` in `competition`.

- OpenAPI is served at `/openapi.json`. Event reads, rules, and published standings live under `/api/v1`. A published event has a read-only TV page at `/tv/{eventId}`.
- The organizer key issues revocable, venue-scoped credentials, creates events, advances phases, and reviews current result revisions. A venue key can register and check in its own drivers and submit results. A driver opts into publishing only their alias and venue.
- A partner can use the venue portal, the reference sender `tools/submit-result.mjs`, or its own adapter. Choose the provider when issuing the key. Link IDs using venue-specific entry records. Verify source validity and game/content mapping before sending. Set `RACE_COMPETITION_URL` and `RACE_COMPETITION_KEY` for the sender or the desk's SQLite outbox. To queue a desk result, use a JSON envelope with `eventId`, `sessionId`, `driverId` from the assignment export, and a `result` payload from OpenAPI. Enter the event and checked-in entry UUIDs when seating or rotating competition drivers. The desk checks event, game, entry and assignment time before queuing a result. Use a stable source ID per lap or finish. Submit higher revisions for corrections. The desk retries connectivity failures and exposes other errors for staff review.
- For a VMS venue, use `RaceControl.exe vms-page path-to-mapping.json` with `RACE_VMS_READ_KEY` from that venue. The mapping supplies `after`, `venueId`, `circuitId`, `vehicleId`, `transmission`, a fixed verified `utcOffset` such as `-05:00`, `game`, `track`, `car`, `build`, and `driverEntries` mapping VMS customer IDs to competition entry UUIDs. Review candidate laps, submit them using the venue’s VMS competition key, and save the returned candidate cursor after the batch is reconciled. Keep DST transitions in separate batches. Native feed validity and reconciliation still need a partner test. MultiTap can use the result contract today through a partner adapter. Its hosted API and signed webhook bridge require a real venue’s endpoint and payload verification.
- Advance registration through check-in, qualifying, race and review. Accept or reject each current revision with a note, then publish. Reopening a correction preserves the previous public snapshot until the new one is approved. A mismatched game, track, build or car cannot be promoted. Export and retain the game evidence for steward disputes.

## Verification

- With an isolated database and `RACE_ADMIN_KEY`, run `node --test race-control/tests/competition.test.mjs` from the branch root. Set `RACE_TEST_URL` to exercise an isolated deployment via HTTP. The test creates explicitly marked QA events.
- With the published desk DLL in `RACE_DESK_BINARY` and `dotnet` on PATH, run `node --test race-control/tests/desk.test.mjs`. The desk test creates a separate SQLite store and starts the real application on loopback. Its rig clients are simulated.
- On venue hardware, verify session setup, launching and joining, timing, controls, result mapping, three consecutive four-rig runs, a disconnected rig, restart and handback. Repeat the tournament test with a real partner and an authorized provider feed before calling the network venue-ready.

After pilot sign-off, add Wreckfest 2 dedicated cups, World of Outlaws staff sessions, original AC drift, Assetto Corsa EVO, ACC, JDM and Rally in that order. Kiosk, live spectator controls, round and league scoring, signed outbound webhooks, provider-native imports and opt-in engagement follow their separate test gates.

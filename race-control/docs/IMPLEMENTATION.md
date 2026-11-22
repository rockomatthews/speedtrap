# Race Control — engineering handoff

## Scope and current architecture

Use only `codex/speedtrap-race-control`, its separate worktree, Vercel project **speedtrap-race-control-test** and Postgres project **eqbnjxevikfqxfqvuvst**. Before applying a migration or deploying, verify the project identity. Production checkout, production environment variables and production database are outside this project.

The hosted app and APIs execute in Vercel functions. Postgres holds competition records, hashed venue and rig credentials, and the desk states. On the hosted desk path the front desk is a browser. Windows workers connect outbound over HTTPS and run the game locally. There is no separately hosted venue coordinator, inbound rig port or dedicated game server for solo practice. The existing .NET/SQLite desk remains a LAN option. The browser demo uses temporary state in the browser and is independent of the rig API. Real-time wheel hardware and the simulation still need the Windows PCs.

The supported rig command in the cloud pilot is narrowly scoped to `rf2-practice`. Pairing codes are single-use and expire in five minutes. Rig credentials cannot access scheduling or management. Use paired rig credentials only on that Windows account. Each command expires, is dispatched at most once, and must be acknowledged. An uncertain launch goes to staff review, without repeating a launch blind. The timer starts at Drive confirmation, independently of the launch request or Steam opening. The cloud desk does not read or mutate website reservations. Its extension is suitable only for isolated practice.

## API contract

- `/desk-openapi.json`: operator state, one-time pairing, start, seat actions, rig poll and acknowledgment.
- `/openapi.json`: competition registration, results, review and public standings.
- Local desk `/website-openapi.json`: website catalog, availability, idempotent hold, confirm and release.

For in-venue production use, unify booking ownership before enabling cloud starts during paid sessions. The website must use one authoritative hold/confirm/release path, consumed by both the seat schedule and venue staff. Model each confirmed payment, booking, rig reservation, session, explicit driver stint and game result as separate linked records. During migration simulate timeout, retries, refunds, duplicate webhooks, a previously reserved rig, cancellation or expiry during checkout, and an offline venue. Keep the open competition API provider-neutral.

## rFactor 2 first

Solo practice and AI sessions run in Single Player. Start with one venue-approved car, one layout, fixed conditions and a known wheel profile. Keep the game warm between bookings where practical. Validate one Windows rig, then four. Treat process launch, game loaded, correct configuration and driver on track as separate states. Use Studio 397's public plugin interface to investigate telemetry/scoring confirmation of the local driver and actual session. Its existence is evidence of a supported observation surface, not proof a current build has an automatic car/track selection or Drive command. Keep manual selection and confirmation until a documented or repeatably validated path can be demonstrated on the licensed build. No unverified click macro ships in this pilot.

Practice can become asynchronous qualifying across venues once we can prove the rules and build, driver identity and valid laps. A shared final uses a supported community dedicated server, which can be reused for the event. Hold results pending until a steward has enough evidence. Preserve corrected results, put the prior publication on record, and test a driver swap mid-session. For competitive play, prefer server exports for shared races and versioned local evidence for qualifying.

[Studio 397 plugin resources](https://www.studio-397.com/modding-resources/) · [Single-player changes](https://support.studio-397.com/hc/en-us/articles/4785154268815-Q2-Content) · [Community dedicated servers](https://www.studio-397.com/2026/11/rfactor-2-community-update/)

## What competitors proved

| Evidence | Design decision |
|---|---|
| VMS publishes rFactor 2 under full automation and has a history of explicit Put on Track controls and readiness feedback. | Match the observable workflow after proving the actual game interface. Treat game process started and able to drive as separate states. |
| MultiTap's local launcher writes a preset on the rig. Its guide separates End Game from End Session and uses private server instances for shared AC races and traffic. | Keep timing, booking, game process and driver identity separate. Local content validation and error feedback happen before a session is marked ready. |
| ShiftOS teaches the player to pick a car and track on the rig, then offers centralized control and reusable presets. It also offers multi-venue competition. | Start with operator control, then add a wheel/button-box experience on the rig. Benchmarks are time to Drive, staff interventions and cross-venue participation by outside systems. |

[VMS release notes](https://www.simracing.co.uk/downloads.php) · [MultiTap launcher](https://multitap.space/docs/launcher.html) · [MultiTap groups](https://multitap.space/docs/groups.html) · [ShiftOS Launch](https://shiftos.app/launch) · [ShiftOS Compete](https://shiftos.app/compete)

## Traffic integration plan

Use **original Assetto Corsa with CSP and AssettoServer** for the shared traffic experience. Keep Assetto Corsa EVO Free Roam a separate title and capability. First make one licensed, version-pinned map and AI lane bundle work on one rig. Try a supported single-player traffic layout as a separate local preset. For a shared road use one persistent private traffic server or start one per event, with configured slots and verified build, content, weather, traffic settings and join flow. The control API sends a preset ID, and a venue-owned host handles the game server. A cloud function never runs the race simulation.

Expose the approved traffic preset in the website catalog only where the required content and player capacity are verified. Represent solo and shared traffic separately. Store native traffic attempts as a separate result type once the feed is verified. Add stable event/attempt IDs, scoring rule version, source timestamps, collision invalidation and replay review. Use dedicated scoreboards for traffic. Before ranking near misses, prove server-side attribution, standards across venues, cutoffs for stationary or colliding bots, and dispositions for disconnects/retries. For v1, sell the experience with no scored competition and leave telemetry experiments private. Validate four drivers, rejoin, correct start area, AI density under load, and a repeatable server restart. Check distribution, mods and license terms before packaging.

[AssettoServer traffic](https://assettoserver.org/docs/getting-started/intro) · [Solo traffic layouts versus shared traffic](https://assettoserver.org/docs/faq/) · [Kunos EVO Free Roam reveal](https://assettocorsa.gg/assetto-corsa-evo-free-roam-revealed/)

## iRacing last

Do not collect or store a member's iRacing username/password for desk login. iRacing's Password Limited Grant is restricted to a registered unattended client user for data access. It does not support a general member login workflow or prove that an access token can authenticate the game UI or join a race. iRacing's support page says new OAuth client IDs are paused. The commercial edition has separate terms and may expose different permitted controls.

1. Start with the exact licensed commercial SKU and ask iRacing for its supported operator login, per-seat policy, launch or join interface, hosting, results export and use of display identities. Verify what the venue's agreement permits.
2. Ship staff-operated iRacing events first if the agreement supports them. Use Speed Trap identities for reservations and check-in. Open or join through iRacing's approved UI. If personal accounts are permitted, each user signs in directly in the rig's official UI, completes MFA there, and signs out at rotation. The desk carries the assignment, time and approved join reference only.
3. If the vendor issues OAuth for identity or results, use its browser authorization flow with PKCE. Keep only the consented account link and approved scoped results access. A linked profile grants no rig-login or hosting authority. Test on one licensed seat with two different drivers, then four seats, then one permitted hosted event. Keep automated joins gated on a separate documented commercial capability.

[iRacing OAuth grants](https://oauth.iracing.com/oauth2/book/token_endpoint.html) · [Client credential availability](https://support.iracing.com/support/solutions/articles/31000177790-oauth-client-credentials) · [Commercial terms](https://ir-core-sites.iracing.com/members/pdfs/20251106_iRacing_Commercial_Terms_dated_Nov_06_2025.pdf) · [Commercial build update](https://www.iracing.com/iracing-development-update-february-2026/)

## Replacement and competitive gates

The existing Speed Trap site's behavior is the baseline. The new package already pilots desk pairing, timed solo starts, independent local bookings, and reviewed multi-venue standings. Before replacing an operational surface, cover:

- Public and staff booking: hours, closures, group and per-pod capacity, accurate venue timezone, payments, expiration, refund/cancellation and staff overrides.
- Customer accounts: bookings, membership benefits, credits and rewards, discounts/promo codes, reminders and lap history.
- Private events: deposits, balances recorded from Toast and clear staff access.
- Leagues and competitions: registration, dues, qualifying, grids, rules, classes, results correction, series scoring and restricted/public boards. Add TV/spectator controls separately from result trust.
- Rig operations: supported live sessions, availability, rotation, reliable device readiness, local failure handling, installer and staged rollback, content and version management, and kiosk modes.
- Existing public site content and navigation: retain the brand site, menu, merch and other pages. The site can consume the new rig and network APIs once separately tested and approved.

Implement in this order: rFactor 2 local proof → shared rFactor pilot and partner qualifier → venue booking parity → traffic and later titles → iRacing last. During the pilot publish only synthetic or expressly approved results. A second venue can join through the competition API or the staff portal. Provider-native automation is accepted only after recording its actual API contract, mapping and corrections behavior.

For reproducible tests: set `RACE_ADMIN_KEY` with the known test organizer key and either an isolated `RACE_DATABASE_URL`/CA or `RACE_TEST_URL` for an authenticated preview. Run `node --test race-control/tests/cloud-desk.test.mjs race-control/tests/competition.test.mjs`. Use the installed .NET SDK/published DLL for `desk.test.mjs`. Real game, controller and network acceptance must be logged separately.

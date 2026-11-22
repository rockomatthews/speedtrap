# Race Control workspace instructions

- Make changes in the Race Control test worktree on `codex/speedtrap-race-control`. Keep production code, live site, database, credentials and DNS out of scope. The only hosted deployment target is Vercel `speedtrap-race-control-test` Preview, backed by isolated Postgres project `eqbnjxevikfqxfqvuvst`.
- Read [engineering handoff](docs/IMPLEMENTATION.md) for architecture, rollout order, API contracts, and parity requirements. Read the [operator guide](docs/OPERATOR.md) before changing steps a venue runs.
- Prioritize original rFactor 2 local practice and validated competition results. Staff confirms Drive until a real licensed Windows test proves reliable detection. Keep traffic and iRacing work behind their own verification gates. Use iRacing's official sign-in and approved interfaces for member accounts.
- Use synthetic names and test-only keys. Maintain separate organizer, venue and rig scopes. Keep credentials out of source, shell arguments, logs and customer UI. Run the branch tests with an isolated database and verify the protected Preview before reporting a hosted change as live.
- State exactly which environment and client were tested. A simulated rig acknowledges commands. It cannot establish that rFactor 2 launched, that the correct car or track loaded, or that a driver used the controls.

# Running isolated review environment

Provisioned 2026-11-08 UTC (November 7 local venue evening).

- Supabase review project: `kzymywpamdmfwnlwxzfj`
- Parent production project, NEVER a deployment target for this worker: `ispveopmovavssktnbfu`
- Branch: `racing-engagement-shadow`, persistent during verification, no production data clone.
- Worker: `racing-shadow`, JWT verification enabled plus a dedicated scheduler-token check.
- Scheduler: `racing-shadow-sync`, every five minutes, inside the review database.
- No dependency on a laptop remaining on or Vercel preview cron execution.
- VMS access: only GET `/laps`; no rig, booking, customer or content mutations.
- No Resend, SMTP, Stripe, webhook-delivery or booking worker deployed.

## Important scope

The review database contains only minimal private staff profiles, the three shadow tables, and scheduler infrastructure. Production migration replay failed because its historical migrations were not a complete blank-database bootstrap. The required shadow schema was then applied separately. A migration-history warning may remain in the branch dashboard; this is not a copy of the full production website database. Do not merge this database branch to production.

Existing customer accounts were not copied. Website-profile linkage is therefore unverified here. Staff review is available at https://speedtrap-shadow-review.vercel.app in its own Vercel project. Do not point this application at production.

## Review queries (only on the review project)

```sql
select * from public.racing_shadow_sources;
select valid, exclusion, count(*) from public.racing_shadow_laps group by valid, exclusion;
select created_at, status, reason, recipient_driver_id, payload, review_decision, review_note
from public.racing_shadow_events order by created_at desc limit 50;
select jobname, schedule, active from cron.job;
select status, start_time, end_time from cron.job_run_details order by runid desc limit 10;
select id, status_code, error_msg from net._http_response order by id desc limit 10;
```

Successful cron submission alone is not proof of a successful import: check HTTP 200 and `synced_at` / cursor progression too. Baseline ID is captured once; historical records never generate alert proposals. Each regular run reads at most 1,000 laps (500 new, 500 reconciliation). The authenticated `{ "bootstrap": true }` operation imports up to ten batches within a bounded time for initial catch-up only.

## Secrets and isolation

VMS API key resides in review Edge Function secrets. The scheduler's branch JWT and dedicated worker token reside in Supabase Vault. Neither is committed. The worker refuses to run if its Supabase URL differs from the exact review project URL. All tables have RLS enabled and access revoked from anonymous and authenticated API clients; service role only. Security advisor notices about RLS with no policies are intentional for these private tables.

## Update / stop

1. Edit shared detector/parser or `scripts/racing-engagement/edge-handler.txt`.
2. Run `node scripts/racing-engagement/build-edge.cjs`, tests and typecheck; commit the generated entrypoint with its source.
3. Deploy only: `supabase functions deploy racing-shadow --project-ref kzymywpamdmfwnlwxzfj --use-api`.
4. To stop polling, run `select cron.unschedule('racing-shadow-sync');` on the review database. Setting `RACING_ENGAGEMENT_SHADOW_ENABLED=false` on this worker also stops collection without removing evidence.
5. Delivery cannot be enabled by either flag. It requires a separate reviewed implementation.

The persistent branch incurs the Supabase branch charges accepted at creation. Retire it after review rather than leaving unused infrastructure running.

## Verified startup snapshot

At 2026-11-08 04:29 UTC: historical baseline complete, 30,838 laps imported (30,820 eligible), latest lap ID 30,864, zero proposed losses. Baseline boundary was ID 30,862. This is a snapshot, not a permanent count. Historical import produced no alerts. Full reconciliation has begun but its first complete sweep is still pending.

The first scheduled invocation returned HTTP 200 and advanced the cursor. A request with the branch JWT but missing the private scheduler token returned HTTP 401. Live grants checks show no anonymous or authenticated SELECT permissions on any shadow table. Production has no `racing_shadow_sources` table. Local verification: 75 tests pass, TypeScript check passes, production build passes.

Intentional advisor informational notice: [RLS enabled with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). These are service-only tables, not publicly accessible customer data.

## Isolated staff website

- URL: https://speedtrap-shadow-review.vercel.app
- Dedicated Vercel project: `prj_rdEmbg7AmniJOQ7C0y93jgETyB86`, root `apps/shadow-review`
- Approved staff: Andrew and Rob at their SpeedTrap addresses. These are separate accounts and passwords, not copied production accounts.
- The site has only sign-in/setup/sign-out and alert review endpoints. No payments, bookings, VMS credentials or email SDK.
- Project credentials: only `SHADOW_SUPABASE_URL`, `SHADOW_ANON_KEY`, `SHADOW_SERVICE_ROLE_KEY`; fixed review database URL checked at runtime.
- The extra Vercel team-login gate was removed with the user's explicit approval; application-level staff authorization remains mandatory on every private read/write.
- Cookies are HttpOnly, Secure, SameSite=Strict; mutations require same-origin requests. Staff role comes from the database, never editable user metadata.
- Global Auth signup is disabled. `auth.email.enable_signup=true` is required for password login: the CLI maps it to `external_email_enabled`, while the separate `auth.enable_signup=false` maps to `disable_signup=true`. An explicit test confirmed unauthorized signup fails.
- `shadow_block_email` is a Postgres Auth Send Email hook returning a 403, with EXECUTE granted only to `supabase_auth_admin`. This prevents Auth email delivery as well as the absence of racing-email delivery code.
- Supabase CLI config push applies Auth changes successfully but subsequently reports an unrelated Storage schema-read error. Live login, hook rejection, and signup denial were verified directly; do not interpret that CLI exit code as rollback of Auth changes.
- Private recovery/setup links are generated through Admin `generateLink`, which does not send mail. They are single-use, expire in one hour, and use the website URL fragment; the page removes the fragment from browser history after loading. Each recipient chooses their own password. Never commit these links.

Verification: 78 local tests pass; isolated app production build passes. Live HTTPS QA passed initial password setup, login, cookie protection, private alert retrieval, audited review saving, refresh, logout, cross-origin rejection, immediate role revocation, non-staff denial, blocked email and disabled signup. Temporary QA account and fixture records were removed. Use `node scripts/racing-engagement/verify-staff-site.cjs https://speedtrap-shadow-review.vercel.app` for an explicit repeat; it is review-project-only.

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

The review database contains only minimal private profiles (empty), the three shadow tables, and scheduler infrastructure. Production migration replay failed because its historical migrations were not a complete blank-database bootstrap. The required shadow schema was then applied separately. A migration-history warning may remain in the branch dashboard; this is not a copy of the full production website database. Do not merge this database branch to production.

Existing customer accounts were not copied. Website-profile linkage is therefore unverified here. Review initially through the Supabase dashboard/table editor or queries below. The Next.js admin review screen is code-complete but is not yet provisioned with isolated staff sign-in. Do not point its normal Supabase variables back at production to shortcut that setup.

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

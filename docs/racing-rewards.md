# Racing rewards and prepaid credits

## Launch controls

Admin → Racing rewards & credits (`/admin/rewards`). Earning, credit sales, and referrals default OFF on installation. The production pilot enabled all three on October 21, 2026 after isolated Stripe verification and live webhook delivery checks. See `rewards-stripe-verification-2026-10-21.md`. Saving settings is required after changing switches. Turning earning off affects new bookings; already booked rates are honored. Existing balances remain redeemable.

Customer wallet: Dashboard → My Rewards (`/dashboard/rewards`). Website only; no POS integration or VMS telemetry dependency.

## Rules

- $1 purchased credit equals $1 of racing payment, including booking tax. No expiration or customer transfers.
- Default: one point per eligible racing dollar after discounts, excluding tax. Fractions are retained to two decimals.
- Points are awarded automatically after the booked session ends, usually within five minutes. Paid no-shows qualify unless cancelled or refunded.
- 100 points converts to $5 racing rewards. Promotional rewards cover at most 25% of the racing subtotal and cannot combine with discount-mode pricing.
- Purchased credit use earns points; purchasing credit does not. Reward-funded racing does not earn points.
- Membership fees, included member sessions, league dues/deposits, private event deposits, food and merch are excluded. Paid member sessions earn after their existing discount.
- Referrals: enter a friend's code before the first booking. Referrer earns 100 points after the friend's first qualifying completed $30+ race; five awards per Eastern calendar month. Refunds reverse eligibility. No self referrals.
- Double points uses the session start in America/New_York. Overlapping windows do not compound. Booked rates are snapshotted; rescheduling recalculates the promotional multiplier.
- Points do not expire during the pilot. Reward settings changes affect future conversions; communicate any changes before using them.

## Staff workflow

No routine attendance confirmation is required. The automatic queue shows the oldest 100 eligible ended sessions; Award now is an optional manual retry. Use customer wallets to review transactions or issue an adjustment with a mandatory reason. Enter dollars for money balances and points for points. Purchased-credit adjustments must represent collected money or a correction, not a giveaway; use promotional credits for giveaways.

Cancellation returns reserved purchased and promotional credits. Card refunds are separate from returned wallet funds. Refund events use cumulative Stripe totals and reverse points; spent points can create a negative balance, which blocks further promotional spending until resolved. Do not manually duplicate an automatic return.

Abandoned checkout credits are reserved until the hold expires and Stripe payment is cancelled or reconciled. A protected cron runs every five minutes. Processing payments retain their reservation. Failed reconciliation returns an error and retains funds for retry; never manually release a reservation while its payment might still succeed.

## Pilot checklist

1. Apply `20261021174410_racing_rewards_wallet.sql` before deploying application code. New tables are inaccessible to browser database roles; authenticated server endpoints use the service role.
2. Verify Admin and My Rewards while signed in, including another customer's access being rejected.
3. Validate a Stripe test-mode top-up, mixed wallet/card checkout, wallet-only checkout, and cancellation/refund in a separate test environment before enabling credit sales. No real customer charge is needed for this verification.
4. Enable earning for the pilot after verifying automatic end-of-session awards. Enable sales and referrals separately after their flows are validated.
5. Review outstanding balances, redeemed rewards, repeat racers and referral awards weekly. Compare repeat attendance and reward cost against the pre-pilot period before expanding.

## Verification

Application tests: `node --test tests/*.test.cjs`.
Database tests: install `@electric-sql/pglite` in an isolated test directory, then run `REWARDS_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/rewards-postgres.mjs`.
Build: `npm run build` with the existing environment supplied securely.

The database suite executes the real migration and checks idempotency, simultaneous reservations, refund ordering, negative-point debt, referral caps, schedule changes, and denied browser-role access. No test writes production balances.

Automatic awards use `rewards_complete_due()` from the protected five-minute rewards cron. Apply `20261021210000_automatic_session_rewards.sql` before deploying. It honors booked reward rates even if earning is later disabled; existing non-enrolled bookings stay excluded. Repeated runs cannot double-award. Cancellation and refund reversals remain active.

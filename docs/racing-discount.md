# Website racing discount mode

Scope: standard website timeslot bookings (solo, group/rotation, and extended sessions). Active Apex Pass pricing and credits, membership subscriptions, merch, food, private-event deposits, and Toast are unaffected. No game-expansion files are included in this branch.

## Admin behavior

Admin → Racing Discount Mode (`/admin/discounts`). Enter a whole percentage, choose Discount mode, and save. The current saved state and save result appear separately from unsaved edits. Starts disabled with 0%. Enabled requires 1–95%; this keeps the minimum $15 paid package above the USD card-charge minimum. Turning it off preserves the configured percentage but applies no discount.

Discounts are calculated in cents on the package subtotal before the existing 8% sales tax. Example: 25% off $28 = $21 + $1.68 = $22.68. The discount applies when a new hold is created, regardless of the session's future date. Paid reservations and already-created 10-minute holds retain their quoted amount. Turning the mode off affects new holds, not a customer's payment already in progress.

Home and Pricing show original and discounted standard prices. Booking checkout shows the discount, tax, and total; the exact server hold quote replaces the preview before payment. Open pages refresh settings every 30 seconds and on focus. New server requests read settings without caching. If settings cannot be read, new checkout fails rather than guessing a price. Authenticated member benefits require the booking email to match the signed-in email, as before.

## Data and access

`racing_discount_settings` is a singleton with RLS enabled and no direct grants for anon/authenticated users. Admin API reads/writes require a verified admin profile. The public API returns only enabled/percent. Database and API both validate bounds. Updated time and admin user are recorded. Hold and booking rows retain separate racing_discount_percent and racing_discount_cents values; legacy rows default to zero. Card/crypto charges use the held total and include discount metadata. Confirmation, portal, staff booking views, and VMS payment notes retain the applied discount.

## Release sequence

1. Review and publish only branch `codex/racing-discount` from `/Users/rob/Documents/Codex/speedtrap-discount`.
2. Apply `supabase/migrations/20260921160000_racing_discount.sql` before deploying code that selects these columns. Do not apply the separate World of Outlaws migration.
3. Verify the singleton is `{ enabled: false, percent: 0 }` and legacy prices/records are intact.
4. Deploy the discount-only build with the production environment. Check `/api/bookings/discount`, admin authorization, regular prices, and the admin page while the switch remains off.
5. Complete an approved test-mode checkout before enabling an actual promotion. Local mocked Stripe/VMS tests are not evidence of a real payment or reservation.

Disable through the admin switch to stop new promotions. Do not delete discount snapshot columns when rolling back application code; paid bookings need their history. Existing holds keep their quoted price for their normal lifetime.

## Verification performed

- `npm run test:discount`: 14 tests covering arithmetic, solo/groups/extensions, member exclusions/credits, malicious price inputs, bounds, admin authorization, lookup failures, card/crypto hold totals, expiration, confirmation retries, and legacy compatibility.
- TypeScript and optimized Next.js build pass (74 pages; local placeholder public Supabase configuration, no production secrets).
- Migration executed against disposable PostgreSQL 17. Checks cover defaults, preserved historical totals, constraints, RLS/client grants, and service-role updates. Fixture scripts under `tests/sql/` are for an isolated empty test database only.
- Local browser review uses actual React components with simulated API settings and no payment credentials: admin enable/save/persistence/disable; customer sale prices; 30-minute solo checkout; eight-driver rotation total.
- No production schema changes, deployment, live payment, or real booking performed.

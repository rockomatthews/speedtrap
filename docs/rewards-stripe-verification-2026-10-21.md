# Stripe rewards verification — 2026-10-21

Account: Speed Trap Racing (`acct_1QAK9gRrm3SnxLCw`). Mode: Stripe test/sandbox.

The customer-facing hosted $25 checkout was completed manually with Stripe’s published test card. Remaining payment scenarios used Stripe test PaymentMethods. Application route handlers and the wallet migration ran against an isolated PGlite PostgreSQL database; authentication, capacity allocation and VMS were test doubles. No production balances or venue bookings were created.

## Passed checks

- Hosted checkout created by actual top-up route, retry reuses session, unpaid purchase grants no credits
- Hosted test payment completed; signed checkout and payment webhooks credit $25 exactly once
- Paid top-up cannot create another checkout
- Mixed checkout: $25 credits + $18.20 Stripe test card; duplicate webhook creates one booking
- Actual cancellation route refunds $18.20 test card, restores $25 credits, releases resources once
- Wallet-only checkout confirms without Stripe charge; cancellation restores $10.80
- Declined test card creates no booking; cancelled payment releases reserved credit
- Completed racing earns 40 points; real partial/full Stripe test refunds reverse 10 then 30 points once
- Original $25 test credit purchase refund removes purchased balance exactly once
- Invalid webhook signature rejected

## Evidence

- Checkout: `cs_test_a1w35cXEA127NrtD0CFZyXbHpkvt0iFJDA0bYHYx1Rj9HjrqN3DiIwqBtR`
- topupPayment: `pi_3UT6JrRrm3SnxLCw0azijMLE`
- mixedPayment: `pi_3UT6LARrm3SnxLCw1gzum2hW`
- partialRefundPayment: `pi_3UT6LFRrm3SnxLCw1JBKc77V`
- declinedPayment: `pi_3UT6LDRrm3SnxLCw0WSwl5f4`

All successful test payments were fully refunded. Final isolated purchased credit, promo credit and points balances were zero.

Webhook payloads used real Stripe test objects with locally generated test signatures through the application webhook handler. This verifies signature handling and duplicate processing; it does not claim a production payment or live Stripe delivery was performed.

## Repeating the test

Run `REWARDS_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/rewards-stripe-integration.mjs` from the repository. It requires a current Stripe CLI default profile for the expected account and refuses live keys. Open the complete printed checkout URL, complete the sandbox checkout, then request `http://127.0.0.1:4327/verify` once. Results are written to `/tmp/speedtrap-rewards-stripe-verification.json`. Stop the local process after review.

## Live configuration repair

The old endpoint `we_1QddlcRrm3SnxLCwjQeQgMNk` was disabled and targeted the obsolete `/api/webhooks/stripe` route. It remains preserved and disabled.

Created `we_1UT6OoRrm3SnxLCwVvXl36cL` at `https://www.speedtrapracing.com/api/stripe/webhook`, subscribed to the 12 event types handled by the application. Its signing secret was stored in Vercel and read back for equality without printing or saving it locally. API version: `2026-02-25.clover`.

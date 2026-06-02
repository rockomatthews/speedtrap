## SimCenter Web

Next.js + Material UI + Supabase Auth + Sim Racing VMS API integration.

### Prereqs
- Node.js 20+ (for local dev/build)
- A Supabase project
- A Sim Racing VMS API key (server-only)

### Environment
Copy the example env file and fill in values:
- `docs/env.example` → `.env.local`

### Run
```bash
npm install
npm run dev
```

### VMS API
All calls to the Sim Racing VMS API are made server-side with the `Authorization: SRL <your-API-key>` header as documented here:
- https://api.simracing.co.uk/docs/v0.1/#authentication

### Toast session webhooks
Toast-paid racing sessions are received at `POST /api/toast/webhook`. Configure these server-only Vercel env vars:
- `TOAST_WEBHOOK_SECRET`: Toast webhook subscription secret.
- `TOAST_RESTAURANT_GUID`: Toast restaurant GUID / `Toast-Restaurant-External-ID`.
- `TOAST_RACING_ITEM_GUIDS`: comma-separated Toast menu item GUIDs that count as sim sessions.
- `TOAST_RACING_CATEGORY_GUIDS`: optional comma-separated category/group GUIDs that count as sim sessions.
- `TOAST_DEFAULT_SESSION_MINUTES`: optional, defaults to `30`.
- `TOAST_DEFAULT_SESSION_PODS`: optional, defaults to `1`.
- `TOAST_API_BASE_URL`: optional, defaults to `https://ws-api.toasttab.com`.
- `TOAST_CLIENT_ID` and `TOAST_CLIENT_SECRET`: optional Orders API credentials used to hydrate full order details when webhook payloads omit guest name/email.


# speedtrap

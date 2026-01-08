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


# speedtrap

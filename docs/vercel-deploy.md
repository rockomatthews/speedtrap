## Vercel deploy checklist

### 1) Import the repo in Vercel
- Create a new Vercel project from your GitHub repo.
- Framework preset: **Next.js**
- Build command: `next build` (default)
- Output: (default)

### 2) Configure environment variables (Vercel → Project → Settings → Environment Variables)
Add these (from `docs/env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (e.g. `https://yourapp.vercel.app`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `VMS_API_KEY` (server-only; keep it secret)
- `VMS_HOME_VENUE_ID` (your venue id in VMS)

### 3) Configure Supabase Auth (Supabase → Authentication → URL Configuration)
Set **Site URL** to your Vercel domain (e.g. `https://yourapp.vercel.app`).

Add **Redirect URLs** for auth callbacks (include preview domains if you use them):
- `https://yourapp.vercel.app/**`
- `https://*.vercel.app/**`

### 4) Configure Google OAuth (Supabase → Authentication → Providers → Google)
Add the OAuth credentials and ensure the authorized redirect URI matches the Supabase instructions.

### 5) Deploy
Trigger a deployment (push to `main` or click Deploy in Vercel).

### 6) Smoke check
- Open the deployed site and verify `/` loads.
- Verify `/login` works (once implemented) and that protected routes redirect to login when signed out.

### Notes
- The Sim Racing VMS API requires server-side requests using `Authorization: SRL <your-API-key>` as documented here:
  - https://api.simracing.co.uk/docs/v0.1/#authentication



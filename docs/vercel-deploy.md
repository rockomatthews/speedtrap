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
- `STRIPE_SECRET_KEY` (server-only)
- `STRIPE_WEBHOOK_SECRET` (server-only)

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
- Verify `/merch` is publicly visible and checkout opens Stripe.
- Verify `/admin/merch` works for an admin user (create item with image + price).

### 7) Configure Stripe webhook (Merch)
- In Stripe Dashboard → Developers → Webhooks:
  - Add an endpoint with URL: `https://<your-vercel-domain>/api/stripe/webhook`
  - Select at least: `checkout.session.completed`
- Ensure the endpoint secret from Stripe is saved to `STRIPE_WEBHOOK_SECRET` in Vercel.

### Troubleshooting: "This site can't be reached" / DNS_PROBE_FINISHED_NXDOMAIN on Google sign-in

If clicking "Continue with Google" redirects to a URL like `https://xxxx.supabase.co/auth/v1/authorize...` and the browser shows "This site can't be reached" or **DNS_PROBE_FINISHED_NXDOMAIN**, the app is using a Supabase project URL that no longer resolves. Common causes:

1. **Wrong or placeholder URL in Vercel**  
   In [Vercel → Project → Settings → Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables), check `NEXT_PUBLIC_SUPABASE_URL`. It must match the URL of your **current** Supabase project.

2. **Get the correct URL from Supabase**  
   - Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project (or create one).  
   - Go to **Project Settings** (gear) → **API**.  
   - Copy **Project URL** (e.g. `https://abcdefghijk.supabase.co`).  
   - In Vercel, set `NEXT_PUBLIC_SUPABASE_URL` to that value and set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **anon public** key from the same page.  
   - Redeploy the app (or trigger a new deployment) so the new env vars are used.

3. **Project paused (free tier)**  
   If the project was inactive, Supabase may have paused it. In the dashboard, restore the project; the Project URL stays the same. If you no longer have that project, create a new one and use its new URL and anon key in Vercel (and run the DB migration from `docs/supabase-setup.md`).

After fixing the URL and keys, try "Continue with Google" again. Ensure Supabase → Authentication → URL Configuration has your Vercel domain as Site URL and in Redirect URLs (e.g. `https://speedtrap.vercel.app/**`).

### Notes
- The Sim Racing VMS API requires server-side requests using `Authorization: SRL <your-API-key>` as documented here:
  - https://api.simracing.co.uk/docs/v0.1/#authentication



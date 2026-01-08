## Supabase setup (DB + Auth)

### 1) Run the DB migration
In Supabase Dashboard → SQL Editor, run:
- `supabase/migrations/0001_profiles.sql`

This creates `public.profiles`, enables RLS, and creates an `auth.users` trigger to auto-create a profile row for each new user.

### 2) Enable Auth providers
Supabase Dashboard → Authentication → Providers:
- Enable **Email** (magic link)
- Enable **Google**

### 3) Configure URL settings
Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://YOUR_DOMAIN`
- Redirect URLs: include your Vercel domain(s), e.g.
  - `https://YOUR_DOMAIN/**`
  - `https://*.vercel.app/**`

### 4) Make your first admin
After you sign up once (so you have a `profiles` row), run this in SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR_AUTH_USER_UUID';
```



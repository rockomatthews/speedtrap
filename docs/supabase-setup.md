## Supabase setup (DB + Auth)

### 1) Run the DB migration
In Supabase Dashboard → SQL Editor, run:
- `supabase/migrations/0001_profiles.sql`
- `supabase/migrations/0002_merch_items.sql`
- `supabase/migrations/0003_merch_items_public_read.sql`
- `supabase/migrations/0004_merch_admin_fields_and_storage.sql`
- `supabase/migrations/0005_merch_inventory.sql`
- `supabase/migrations/0006_merch_sizes.sql`
- `supabase/migrations/0007_merch_size_inventory_and_cart_preview.sql`

This creates `public.profiles`, enables RLS, and creates an `auth.users` trigger to auto-create a profile row for each new user.
It also creates `public.merch_items` and the public `merch` storage bucket for merch images.

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

### 5) Manage merch catalog
- Sign in as your admin user and go to `/admin/merch`.
- Create/update merch entries with:
  - title
  - description
  - price
  - inventory count
  - sizes (XS/S/M/L/XL)
  - per-size inventory (for apparel)
  - image upload
  - active toggle
- You can delete items from the admin merch page.
- The admin flow creates/updates Stripe product pricing and stores rows in `public.merch_items`.
- Storefront now supports a shopping cart with multi-item checkout and estimated shipping/tax preview.



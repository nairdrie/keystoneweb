# Supabase Setup Guide for Keystone Web

## Prerequisites
- Supabase project created
- Connection string and anon key obtained
- Added to `.env.local` (never commit this file)

## Setup Steps

### 1. Create Database Tables

Go to your Supabase dashboard:
1. Click **SQL Editor** on the left sidebar
2. Click **New query**
3. Copy and paste the entire contents of `lib/db/schema.sql`
4. Click **Run**

This will create all necessary tables with proper indexes and Row-Level Security policies.

### 2. Verify Tables Were Created

In Supabase dashboard:
1. Go to **Table editor** 
2. You should see:
   - `users`
   - `sites` ← **This is the main one we use now**
   - `templates`
   - `payment_methods`
   - `site_access_logs`
   - `dns_records`
   - `subscriptions`

### 3. Test Site Creation Locally

```bash
npm run dev
# Visit http://localhost:3000/onboarding
# Complete the 3-step flow
# Your site should now be stored in Supabase!
```

### 4. Verify Data in Supabase

Go to **Table editor** → **sites** and you should see your created site with:
- `id` (UUID)
- `selected_template_id`
- `business_type`
- `category`
- `design_data` (JSON)
- `created_at` / `updated_at`

## Environment Variables

Your `.env.local` should have:
```
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...YOUR_ANON_KEY
```

**NEVER commit this file!** It's in `.gitignore` by default.

## Architecture

- **Frontend** → calls `/api/sites` (POST/GET/PATCH)
- **API Route** → uses Supabase JS client
- **Supabase** → PostgreSQL database with RLS policies
- **Data Flow**: In-memory → Supabase (real persistence!)

## Next Steps

- [ ] Run the schema.sql in Supabase
- [ ] Verify tables created
- [ ] Test onboarding flow
- [ ] Build PR #19: User Authentication

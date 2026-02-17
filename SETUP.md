# Multi-Tenant CMS - Setup & Getting Started

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The app will start at `http://localhost:3000`

### 3. Test the System

#### **Dashboard (Your Platform)**
- Visit: `http://localhost:3000`
- See: Landing page → redirects to `/dashboard`
- Features: Template selection, setup wizard

#### **Client Sites (Served Dynamically)**

**Option A: Local DNS (Recommended)**
```bash
# macOS/Linux: Edit /etc/hosts
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 cool-barber.local
127.0.0.1 demo-pizza.local

# Then visit:
# http://cool-barber.local:3000
# http://demo-pizza.local:3000
```

**Option B: Direct Testing (No DNS Setup)**
```bash
# Use curl to simulate client domain requests:
curl -H "Host: cool-barber.local:3000" http://localhost:3000
curl -H "Host: demo-pizza.local:3000" http://localhost:3000
```

## Project Structure

```
multi-tenant-cms/
├── app/                      # Next.js app directory
│   ├── (app)/               # Dashboard/platform routes
│   │   ├── dashboard/       # Main dashboard
│   │   ├── templates/       # Template browser
│   │   └── setup/[template] # Site setup wizard
│   │
│   └── (site)/              # Client site routes
│       └── [domain]/        # Dynamic per-site routing
│           ├── layout.tsx   # Loads theme & site data
│           └── page.tsx     # Renders homepage
│
├── lib/
│   └── data.ts              # Data fetching & mock DB
│
├── middleware.ts            # Domain routing magic ✨
├── ARCHITECTURE.md          # Deep dive into design
├── SETUP.md                 # This file
└── package.json
```

## How the Magic Works

### The Middleware
Located in `middleware.ts`, it:
1. Intercepts every request
2. Checks the hostname (domain)
3. If `app.*` or localhost → serve normally
4. If client domain → rewrite to `/site/[domain]` internally

**Result**: User sees `cool-barber.com` in the browser, but Next.js serves from `/site/cool-barber`

### The Data Flow
```
1. Request: cool-barber.local:3000
   ↓
2. Middleware: rewrite → /site/cool-barber
   ↓
3. Layout: getSiteData('cool-barber')
   ↓
4. Gets: { siteName, theme, content }
   ↓
5. Page: Renders with dynamic theme colors
```

## Available Demo Sites

These sites are pre-configured in `lib/data.ts`:

### 1. **Cool Barber's** (`cool-barber.local:3000`)
- Template: Barber Shop
- Colors: Blue theme
- Content: Services, hours, contact

### 2. **Demo Pizza Co** (`demo-pizza.local:3000`)
- Template: Restaurant
- Colors: Red theme
- Content: Menu items, hours, location

**Try them out!** Edit the mock data in `lib/data.ts` to see changes immediately.

## Next Steps

### Phase 2: Database Integration
Replace mock data with real database:

1. **Sign up for Supabase**: https://supabase.com
2. **Create tables** (see `ARCHITECTURE.md` schema)
3. **Update `lib/data.ts`**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

export async function getSiteData(domain: string) {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('domain', domain)
    .single();
  
  return data;
}
```

### Phase 2: Authentication
Add user accounts so businesses can manage their sites:
- Use `next-auth` or Supabase Auth
- Protect setup wizard with login
- Add site management dashboard

### Phase 2: Content Editor
Build a UI for editing site content:
- Rich text editor for page sections
- Image uploads
- Theme customizer
- Publish/preview

## Build for Production

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push to GitHub
2. Import project on Vercel
3. Environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_KEY=your_key
```
4. Deploy!

## Troubleshooting

### "Site Not Found"
- Check that the domain exists in `lib/data.ts`
- Verify the domain is being passed correctly to middleware
- Check browser console logs

### Local domain not working
- Verify `/etc/hosts` is configured
- Try: `127.0.0.1 yourdomain.local`
- Restart your browser or use incognito mode
- Test with `curl -H "Host: yourdomain.local:3000" http://localhost:3000`

### Middleware not triggering
- Ensure middleware.ts is in the root directory
- Check Next.js version (15+)
- Verify config in middleware.ts matcher

## File Descriptions

| File | Purpose |
|------|---------|
| `middleware.ts` | Intercepts requests, handles domain routing |
| `lib/data.ts` | Mock database, data fetching functions |
| `app/(app)/layout.tsx` | Dashboard layout |
| `app/(app)/dashboard/page.tsx` | Main landing page |
| `app/(app)/templates/page.tsx` | Template browser |
| `app/(site)/[domain]/layout.tsx` | Client site layout (loads theme) |
| `app/(site)/[domain]/page.tsx` | Client site homepage (renders content) |
| `ARCHITECTURE.md` | Design decisions & scaling strategy |

## Cost Breakdown

| Component | Free Tier | Paid Tier |
|-----------|-----------|-----------|
| Hosting (Vercel) | Free (Up to 100GB) | $20/month+ |
| Database (Supabase) | Free (Up to 500MB) | Pay-as-you-go |
| Domains | TLD cost only | $10-15/year each |
| **Total** | ~$0-15/year | $30-50/month |

## Questions?

See `ARCHITECTURE.md` for:
- Detailed system design
- Database schema
- Scaling strategy
- Future enhancements

## Vercel Deployment

This project is automatically deployed to Vercel on every push to main.
No manual deployment steps needed!

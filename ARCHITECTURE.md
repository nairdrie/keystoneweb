# Multi-Tenant CMS Architecture

## Overview
A scalable, cost-effective CMS platform that serves thousands of distinct websites from a single Next.js installation and shared database.

## How It Works

### 1. Domain-Based Routing (The Magic)
When a request comes in, the **middleware** checks the hostname:

```
Request: cool-barber.com → Middleware extracts domain → Rewrites to /site/cool-barber
```

The URL in the browser stays the same (`cool-barber.com`), but Next.js internally serves from the `/site/[domain]` route.

### 2. Folder Structure

```
app/
├── (app)/              # Your main platform/dashboard
│   ├── layout.tsx      # Layout for app pages
│   ├── page.tsx        # Root (redirects to /dashboard)
│   ├── dashboard/      # Main dashboard landing page
│   ├── templates/      # Browse templates
│   └── setup/          # Setup new site by template
│
└── (site)/             # Client websites (served dynamically)
    └── [domain]/       # Dynamic domain parameter
        ├── layout.tsx  # Layout for all client sites (fetches theme)
        └── page.tsx    # Client site homepage (renders content)
```

### 3. Data Model

```typescript
SiteData {
  domain: "cool-barber"
  siteName: "Cool Barber's"
  template: "barber"
  theme: {
    primaryColor: "#1e40af"
    accentColor: "#60a5fa"
    backgroundColor: "#0f172a"
  }
  content: {
    title: "Cool Barber's"
    pages: {
      "/": { sections: [...] }
      "/about": { sections: [...] }
    }
  }
}
```

### 4. Server-Side Rendering Flow

```
1. Request comes to cool-barber.com
   ↓
2. Middleware intercepts → rewrites to /site/cool-barber
   ↓
3. Layout loads data → getSiteData("cool-barber")
   ↓
4. Page renders with theme colors & content
   ↓
5. Browser sees cool-barber.com (original URL preserved)
```

## Scaling Strategy

### Phase 1: Static Sites (Free Tier)
- Single Next.js instance on Vercel
- Mock in-memory database (`lib/data.ts`)
- No database costs
- Up to 50-100 simple sites

**Cost**: Free (Vercel hobby plan)

### Phase 2: Growing (Paid Tier)
- Add Supabase PostgreSQL (pay-as-you-go)
- Replace mock data with real database queries
- Add image uploads (Supabase Storage)
- Support dynamic content

**Cost**: ~$10-25/month + usage

### Phase 3: Enterprise
- Supabase Pro ($25/month)
- Custom domains with CNAME
- Advanced theming/plugins
- API for external integrations

**Cost**: $25/month + hosting + domain costs

## Database Schema (When Ready)

```sql
-- Sites table
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) UNIQUE,
  site_name VARCHAR(255),
  template VARCHAR(100),
  theme JSONB,
  content JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Users table (for auth)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  created_at TIMESTAMP
);

-- User sites mapping
CREATE TABLE user_sites (
  user_id INTEGER REFERENCES users(id),
  site_id INTEGER REFERENCES sites(id),
  role VARCHAR(50), -- 'owner', 'editor'
  PRIMARY KEY (user_id, site_id)
);
```

## Key Files Explained

### `middleware.ts`
- Intercepts all incoming requests
- Checks if domain is `app.` (dashboard) or client domain
- Rewrites client domains to `/site/[domain]` internally

### `lib/data.ts`
- Mock database functions
- `getSiteData(domain)` → fetches site config & theme
- `getPageContent(domain, path)` → fetches page content
- **Replace these with Supabase queries when ready**

### `app/(site)/[domain]/layout.tsx`
- Layout for all client sites
- Loads SiteData server-side
- Sets theme colors in CSS
- Returns 404 if domain doesn't exist

### `app/(site)/[domain]/page.tsx`
- Renders client site homepage
- Uses theme colors dynamically
- Section components: hero, features, contact, about
- Easily extensible for new section types

## Development

### Local Testing

1. **Dashboard**: `localhost:3000` → redirects to `/dashboard`
2. **Client site (demo-pizza)**: `demo-pizza.local:3000`
3. **Client site (cool-barber)**: `cool-barber.local:3000`

**Set up local DNS** (macOS/Linux):
```bash
sudo nano /etc/hosts
# Add:
127.0.0.1 demo-pizza.local
127.0.0.1 cool-barber.local
```

### Testing the Middleware
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Curl test
curl -H "Host: cool-barber.local:3000" http://localhost:3000
```

## Future Enhancements

### Phase 1 (Ready Now)
- ✅ Multi-tenant routing
- ✅ Template selection
- ✅ Dynamic theming
- ✅ Server-side rendering

### Phase 2 (Add Soon)
- Authentication & user management
- Real database (Supabase)
- Image uploads
- Content editor UI
- Custom domains (CNAME)
- Email notifications

### Phase 3 (Advanced)
- A/B testing
- Analytics integration
- Plugin system
- API for third-party integrations
- Backup & versioning
- CDN image optimization

## Cost Estimates

| Tier | Users | Cost/Month | Notes |
|------|-------|-----------|-------|
| **Hobby** | <50 | Free | Mock data, Vercel free |
| **Starter** | 50-500 | $25 | Supabase free tier |
| **Pro** | 500-5000 | $50-100 | Supabase + Vercel Pro |
| **Enterprise** | 5000+ | $500+ | Dedicated infrastructure |

---

**Next Steps**: Replace mock database with Supabase → Add authentication → Add content editor UI

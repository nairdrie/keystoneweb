# Editor Page & Domain-Aware Routing (PR #20)

## Overview

This PR introduces the new **Editor Page** (`/editor`) with full-screen template preview and floating toolbar, plus domain-aware routing architecture that supports both:

1. **keystoneweb.ca/editor?siteId=uuid** - Dashboard editing
2. **custom-domain.com/editor** - Custom domain owner editing

Both require authentication and ownership verification.

## Key Features

### 1. Editor Page (`/app/(app)/editor/page.tsx`)
- **Full-screen template preview** with gradient backgrounds
- **Auth guard** - redirects unauthenticated users to onboarding
- **Ownership verification** - only site owner can edit
- **Query param routing** - siteId passed as `?siteId=uuid`
- **Error handling** - clear messages for missing/unauthorized sites

### 2. Floating Toolbar (`/app/components/FloatingToolbar.tsx`)
- **Floating button** (bottom right) - expands to drawer on click
- **Expandable drawer** - max 80% view height on mobile
- **Site name input** - edit site title in real-time
- **Color palettes** - 5 temp UI palettes (previews only for now)
- **Save button** - persists design changes to database

### 3. Domain-Aware Middleware
- **Updated middleware.ts** - adds domain headers (`x-domain`, `x-hostname`)
- **Custom domain support** - future-proof for multi-tenant custom domains
- **App domain detection** - recognizes keystoneweb.ca, localhost, etc.

### 4. Onboarding Flow Update
- Changed redirect from `/design/[siteId]` → `/editor?siteId=[siteId]`
- Cleaner, query-param based navigation
- Prepares for future domain-based routing

## Architecture

### Request Flow

```
User creates site via onboarding
    ↓
POST /api/sites → Returns {siteId}
    ↓
Redirect to /editor?siteId=uuid
    ↓
Editor page checks:
  1. User authenticated? (if not → redirect to /onboarding)
  2. Site exists? (if not → error)
  3. User owns site? (if not → error)
    ↓
Render full-screen template preview + floating toolbar
    ↓
User clicks toolbar → Drawer opens
    ↓
User edits title, chooses color, clicks Save
    ↓
PATCH /api/sites with userId verification
    ↓
Success message
```

### Domain Routing (Future-Ready)

**Current:**
- `keystoneweb.ca/editor?siteId=uuid` (query param)

**Future:**
- `keystoneweb.ca/editor?siteId=uuid` (same)
- `my-business.com/editor` (custom domain, no query param)

Middleware will:
1. Detect hostname
2. If custom domain → look up site by domain in DB
3. If keystoneweb.ca → use siteId from query params
4. Either way → owner check enforced

## Testing Locally

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Create a Site
- Go to http://localhost:3000/onboarding
- Complete 3-step flow
- Select a template
- **Should redirect to `/editor?siteId=<uuid>`**

### 3. Verify Editor Loads
- You should see:
  - Full-screen white preview card
  - Template hero section (blue gradient)
  - Floating red button (bottom right)
- No Header visible (full screen)

### 4. Test Floating Toolbar
- Click the red floating button
- Drawer should slide up from bottom
- Try:
  - Change site name → see it update in preview
  - Click color palettes (UI only, no effect yet)
  - Click "Save Site" → should save to database

### 5. Verify Database
- Go to Supabase → Table Editor → sites
- Your site should have `user_id` set (not NULL)
- `design_data` should have the updated `title`

## File Structure

```
app/
├── (app)/
│   ├── editor/
│   │   └── page.tsx              # Editor page (auth guard + site load)
│   └── components/
│       ├── FloatingToolbar.tsx   # Floating button + drawer
│       └── ... (other components)
├── middleware.ts                 # Updated: domain headers
└── ...

lib/
└── ... (auth, db, types)
```

## Security Considerations

### Current
- **Auth required** to access `/editor`
- **Ownership check** - only site owner can fetch/modify site
- **userId in PATCH** - verifies user match on save

### Next Steps (RLS)
- Enable Row-Level Security (RLS) on `sites` table
- Server-side verification of `userId` from JWT token
- Prevent clients from spoofing userId

## Color Palettes (Temp UI)

Currently 5 hardcoded palettes for demo:
1. **Ocean Blue** - #0369a1 / #06b6d4
2. **Forest Green** - #15803d / #4ade80
3. **Sunset Orange** - #ea580c / #fb923c
4. **Royal Purple** - #7c3aed / #c084fc
5. **Keystone Red** - #dc2626 / #f87171

**To implement color selection** (future PR):
- Store selected palette in `designData`
- Apply to template hero gradient via CSS variables
- Update preview in real-time

## Known Limitations

1. **Color selection is UI only** - doesn't affect actual site yet
2. **No font selector** - coming next
3. **No section editor** - coming soon
4. **No image uploader** - planned feature
5. **Custom domain routing not implemented** - architecture ready

## Next Steps (PR #21+)

### PR #21: Enhanced Design Customization
- [ ] Color picker (apply to hero, buttons, etc.)
- [ ] Font selector (5-10 web fonts)
- [ ] Section editor (hero, features, about, footer)
- [ ] Real-time preview updates
- [ ] RLS policies for security

### PR #22: Public Site Generation
- [ ] Generate public site from design data
- [ ] Custom domain support
- [ ] DNS management

### PR #23: Payment & Subscriptions
- [ ] Stripe integration
- [ ] Subscription tiers
- [ ] Usage tracking

## Deployment Checklist

- [x] Floating toolbar component created
- [x] Editor page with auth guard built
- [x] Onboarding redirects to `/editor?siteId=`
- [x] Middleware updated with domain headers
- [x] Local testing verified
- [ ] Vercel environment variables set (SUPABASE_*)
- [ ] Build passes on Vercel
- [ ] Test end-to-end on keystoneweb.ca

## Files Changed

- `app/(app)/editor/page.tsx` (new)
- `app/components/FloatingToolbar.tsx` (new)
- `app/components/OnboardingWizard.tsx` (updated redirect)
- `middleware.ts` (updated with domain headers)
- `package.json` + `package-lock.json` (added lucide-react)
- `EDITOR_SETUP.md` (this file)

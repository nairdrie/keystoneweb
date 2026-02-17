# Test the Middleware - The Magic Part ✨

This guide shows you how to verify that the middleware routing works correctly.

## What We're Testing

The middleware intercepts requests and **rewrites the path internally** while keeping the URL in the browser unchanged.

```
You visit:           cool-barber.com
Middleware rewrites: /site/cool-barber
You still see:       cool-barber.com ✨
```

---

## Test Method 1: Force Hostname (No DNS Setup)

**This is the easiest way to test immediately!**

### Step 1: Use the Test Middleware
```bash
cd /home/clawd/.openclaw/workspace/multi-tenant-cms

# Make a backup of the real middleware
cp middleware.ts middleware.prod.ts

# Use the test middleware (forces cool-barber.local)
cp middleware.test.ts middleware.ts
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Visit the Site
```
http://localhost:3000
```

You should see:
- ✅ "Cool Barber's" site
- ✅ Blue theme (#1e40af primary color)
- ✅ Services, About, Contact sections
- ✅ **Console shows:**
  ```
  ╔════════════════════════════════════════════════════════╗
  ║                  MIDDLEWARE TEST ROUTING                ║
  ╠════════════════════════════════════════════════════════╣
  ║ Original Request:  cool-barber.local/
  ║ Rewritten Path:    /site/cool-barber.local/
  ║ URL in Browser:    cool-barber.local (unchanged!)
  ╚════════════════════════════════════════════════════════╝
  ```

### What This Proves
- ✅ Middleware intercepted the request
- ✅ Rewrote the path to `/site/cool-barber.local`
- ✅ The `[domain]` parameter received "cool-barber.local"
- ✅ Layout loaded the theme data
- ✅ Page rendered with correct colors

### Step 4: Test Another Domain
Edit `middleware.ts`:
```typescript
// Change line:
const testHostname = 'demo-pizza.local';
```

Then reload `http://localhost:3000`:
- ✅ You should see the Red Pizza site
- ✅ Different theme colors
- ✅ Different content (Menu items)

---

## Test Method 2: Local DNS (More Realistic)

**This simulates real domain setup.**

### Step 1: Restore Real Middleware
```bash
cp middleware.prod.ts middleware.ts
rm middleware.prod.ts
```

### Step 2: Set Up Local DNS
```bash
# macOS/Linux
sudo nano /etc/hosts

# Add these lines:
127.0.0.1 cool-barber.local
127.0.0.1 demo-pizza.local
127.0.0.1 localhost

# Save (Ctrl+O, Enter, Ctrl+X)
```

### Step 3: Start Dev Server
```bash
npm run dev
```

### Step 4: Visit the Sites
```
http://cool-barber.local:3000
http://demo-pizza.local:3000
http://localhost:3000  (goes to dashboard)
```

Each domain should show:
- **cool-barber.local**: Blue barber shop theme
- **demo-pizza.local**: Red pizza restaurant theme
- **localhost**: Dashboard/landing page

### What This Proves
- ✅ Middleware correctly reads the `Host` header
- ✅ Different domains route to different data
- ✅ The `[domain]` dynamic route parameter works
- ✅ Each site has its own theme & content

---

## Test Method 3: Curl (Command Line)

**For debugging without a browser.**

```bash
# Test cool-barber domain
curl -H "Host: cool-barber.local:3000" http://localhost:3000

# Should return HTML with:
# - "Cool Barber's" in the title
# - Blue color hex codes (#1e40af, #60a5fa)
# - Service items

# Test demo-pizza domain
curl -H "Host: demo-pizza.local:3000" http://localhost:3000

# Should return HTML with:
# - "Demo Pizza Co" in the title
# - Red color hex codes (#dc2626, #f87171)
# - Menu items

# Test app domain (should go to dashboard)
curl -H "Host: app.localhost:3000" http://localhost:3000

# Should return HTML with dashboard content
```

---

## How to Read the Console Logs

When the test middleware runs, you'll see logs like:

```
[Middleware TEST] Forcing hostname: cool-barber.local

╔════════════════════════════════════════════════════════╗
║                  MIDDLEWARE TEST ROUTING                ║
╠════════════════════════════════════════════════════════╣
║ Original Request:  cool-barber.local/services
║ Rewritten Path:    /site/cool-barber.local/services
║ URL in Browser:    cool-barber.local (unchanged!)
╚════════════════════════════════════════════════════════╝

[Data] Found site: Cool Barber's (cool-barber)
```

**What each line means:**
- `[Middleware TEST]` → Middleware ran
- `Original Request` → What path user visited
- `Rewritten Path` → What path Next.js actually serves
- `URL in Browser` → What user still sees (unchanged)
- `[Data] Found site` → Database lookup succeeded

---

## Checklist: Middleware Working?

After running the tests, verify:

- [ ] **Console shows middleware logs** (either test or real)
- [ ] **No 404 errors** (the [domain] route matched)
- [ ] **Correct theme colors displayed** (data loaded correctly)
- [ ] **Cool-barber shows BLUE** (#1e40af primary)
- [ ] **Demo-pizza shows RED** (#dc2626 primary)
- [ ] **URL bar doesn't change** (rewrite, not redirect)
- [ ] **Different domains show different content** (routing works)

If all pass: ✅ **Middleware is working perfectly!**

---

## What's Happening Under the Hood

### 1. Request Arrives
```
GET /services HTTP/1.1
Host: cool-barber.local:3000
```

### 2. Middleware Intercepts
```typescript
const hostname = 'cool-barber.local';
const pathname = '/services';

url.pathname = `/site/cool-barber.local/services`;
return NextResponse.rewrite(url);
```

### 3. Next.js Routes to Dynamic Page
```
/site/cool-barber.local/services
      ├─ [domain] = 'cool-barber.local'
      └─ Handles with app/(site)/[domain]/page.tsx
```

### 4. Page Renders
```typescript
// In (site)/[domain]/page.tsx
const site = await getSiteData('cool-barber.local');
// Gets: { siteName: "Cool Barber's", theme: {...}, content: {...} }

// Renders with theme colors
<h1 style={{ color: site.theme.primaryColor }}>...</h1>
```

### 5. Browser Receives HTML
```
✅ Renders in browser
✅ URL bar still shows: cool-barber.local
✅ No redirect happened
✅ User never knew about the rewrite!
```

---

## Why This Rewrite Approach?

### ❌ Redirect (Bad)
```
User visits: cool-barber.com
Server returns: 302 Redirect to /site/cool-barber
Browser makes ANOTHER request
URL bar shows: localhost:3000/site/cool-barber
User sees the "join" in the URL = ugly, confusing
Extra latency: +300ms
```

### ✅ Rewrite (Good)
```
User visits: cool-barber.com
Server rewrites internally: /site/cool-barber
Browser sees: cool-barber.com (unchanged!)
URL bar clean and professional
No extra request: 0ms overhead
User doesn't notice anything = magic ✨
```

---

## Troubleshooting

### "Site Not Found" Error
- [ ] Check that domain is in `lib/data.ts`
- [ ] Verify domain spelling matches exactly
- [ ] Look for console logs showing the domain received

### Localhost Shows Dashboard Instead
- [ ] The middleware is working correctly!
- [ ] Localhost is treated as `app.*` domain
- [ ] That's why it shows `/dashboard`
- [ ] Use `cool-barber.local` instead

### Theme Colors Wrong
- [ ] Data loaded but colors are wrong
- [ ] Edit `lib/data.ts` to change theme colors
- [ ] Add more sites with different themes

### Middleware Not Showing Logs
- [ ] Check browser DevTools Console
- [ ] Check terminal where `npm run dev` runs
- [ ] Make sure you're using test middleware
- [ ] Look for `[Middleware` in the logs

---

## Next: Replace Mock Data with Real Database

Once middleware works, next step is:

```typescript
// Replace this (lib/data.ts):
const MOCK_SITES = { 'cool-barber': {...} };

// With this:
const supabase = createClient(url, key);
export async function getSiteData(domain) {
  const { data } = await supabase
    .from('sites')
    .select('*')
    .eq('domain', domain)
    .single();
  return data;
}
```

Same middleware, same routing, real data! 🚀

---

## Summary

The middleware test proves:

✅ **Cheap**: One app serves unlimited domains (no per-customer infrastructure)
✅ **Fast**: Rewrite is instant (no HTTP redirect overhead)
✅ **Scalable**: Add domains just by adding database rows (no code changes)

This is the secret to competing with Vercel Platforms or Notion at a fraction of the cost!

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  APP_URL,
  COOKIE_DOMAIN,
  parseHost,
} from '@/lib/env/domain';

/**
 * Middleware for handling:
 * 1. Supabase Auth token validation and refresh (via cookies)
 * 2. Subdomain routing (published sites at *.kswd.ca / *.staging.kswd.ca)
 * 3. Custom domain routing (user-owned domains pointed via DNS)
 * 4. Ops dashboard routing (ops.keystoneweb.ca / ops.staging.keystoneweb.ca → /ops/*)
 *
 * Environment-specific domains live in lib/env/domain.ts.
 */

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  console.log(`[Middleware] Incoming: ${hostname}${pathname}`);

  const parsed = parseHost(hostname);

  // ============================================================
  // STEP 0: /favicon.ico — serve a distinct icon for the ops domain
  // The matcher includes this path explicitly; for non-ops hosts we let
  // Next.js serve the default favicon without touching auth.
  // ============================================================
  if (pathname === '/favicon.ico') {
    if (parsed.kind === 'ops') {
      const opsFaviconUrl = request.nextUrl.clone();
      opsFaviconUrl.pathname = '/favicon-ops.ico';
      return NextResponse.rewrite(opsFaviconUrl);
    }
    return NextResponse.next();
  }

  // ============================================================
  // STEP 1a: Ops dashboard — ops.{BASE_DOMAIN}
  // Only admin emails (OPS_ADMIN_EMAILS env var) are allowed in.
  // Everyone else is hard-redirected to the app root.
  // ============================================================
  if (parsed.kind === 'ops') {
    // API routes pass through without redirect so the ops pages can call them
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // We need to validate the session to check the email
    let userEmail: string | null = null;
    let userId: string | null = null;
    let isAgent = false;
    const opsCheckResponse = NextResponse.next();

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                opsCheckResponse.cookies.set(name, value, { ...options, domain: COOKIE_DOMAIN });
              });
            },
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = user?.email?.toLowerCase() ?? null;
      userId = user?.id ?? null;

      // If not a hardcoded admin, check if they have the agent flag in the DB
      if (userEmail && !adminEmails.includes(userEmail) && userId) {
        const { data: profile } = await supabase
          .from('users')
          .select('is_agent')
          .eq('id', userId)
          .single();
        isAgent = profile?.is_agent ?? false;
      }
    } catch {
      // Auth error → treat as not authenticated
    }

    const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;

    if (!userEmail || (!isAdmin && !isAgent)) {
      console.log(`[Middleware] Ops access denied for: ${userEmail ?? 'unauthenticated'}`);
      return NextResponse.redirect(new URL(APP_URL));
    }

    // Admin confirmed — rewrite ops.{BASE_DOMAIN}/* → /ops/*
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/ops${pathname === '/' ? '' : pathname}`;
    if (!rewriteUrl.pathname.startsWith('/ops')) {
      rewriteUrl.pathname = '/ops';
    }

    console.log(`[Middleware] Ops rewrite → ${rewriteUrl.pathname}${rewriteUrl.search}`);
    const rewriteResponse = NextResponse.rewrite(rewriteUrl);
    // Forward any refreshed auth cookies
    opsCheckResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      rewriteResponse.cookies.set(name, value, options);
    });
    return rewriteResponse;
  }

  // ============================================================
  // STEP 1b: Published site subdomain — *.{PUBLISHED_ROOT}
  // ============================================================
  if (parsed.kind === 'published' && parsed.subdomain) {
    const subdomain = parsed.subdomain;

    console.log(`[Middleware] Detected published subdomain: '${subdomain}'`);

    // Do not rewrite API routes so they can be handled by app/api/
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // ── /admin and /design shortcuts ──────────────────────────────────────────
    // Visiting mysite.kswd.ca/admin or /design redirects to the app with siteId=...
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
    const isDesignPath = pathname === '/design';
    if (isAdminPath || isDesignPath) {
      const appRoot = APP_URL;

      // Look up the siteId from the published_domain
      let siteId: string | null = null;
      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() { return request.cookies.getAll(); },
              setAll() {},
            },
          }
        );
        const { data } = await supabase
          .from('sites')
          .select('id')
          .eq('published_domain', subdomain)
          .single();
        siteId = data?.id ?? null;
      } catch {
        // Non-blocking — redirect without siteId if lookup fails
      }

      const destination = isDesignPath ? '/design' : pathname;
      const destUrl = new URL(`${appRoot}${destination}`);
      if (siteId) destUrl.searchParams.set('siteId', siteId);

      console.log(`[Middleware] Subdomain admin/design redirect → ${destUrl.toString()}`);
      return NextResponse.redirect(destUrl);
    }

    // Rewrite internally to the public route
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/public/${subdomain}${pathname}`;
    console.log(`[Middleware] Rewriting to: ${rewriteUrl.pathname}${rewriteUrl.search}`);
    const subdomainResponse = NextResponse.rewrite(rewriteUrl);
    // Cache published site pages at Vercel's edge CDN to reduce serverless
    // invocations and DB queries from repeated/abusive requests.
    subdomainResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    return subdomainResponse;
  }

  // ============================================================
  // STEP 1c: Custom domain routing
  // ============================================================
  if (parsed.kind === 'custom' && parsed.cleanDomain) {
    const cleanDomain = parsed.cleanDomain;

    console.log(`[Middleware] Detected possible custom domain: '${cleanDomain}'`);

    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // ── /admin and /design shortcuts ──────────────────────────────────────────
    // Visiting customdomain.com/admin or /design redirects to the app with siteId=...
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
    const isDesignPath = pathname === '/design';
    if (isAdminPath || isDesignPath) {
      const appRoot = APP_URL;

      // Look up the siteId from the custom_domain
      let siteId: string | null = null;
      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() { return request.cookies.getAll(); },
              setAll() {},
            },
          }
        );
        const { data } = await supabase
          .from('sites')
          .select('id')
          .eq('custom_domain', cleanDomain)
          .single();
        siteId = data?.id ?? null;
      } catch {
        // Non-blocking — redirect without siteId if lookup fails
      }

      const destination = isDesignPath ? '/design' : pathname;
      const destUrl = new URL(`${appRoot}${destination}`);
      if (siteId) destUrl.searchParams.set('siteId', siteId);

      console.log(`[Middleware] Custom domain admin/design redirect → ${destUrl.toString()}`);
      return NextResponse.redirect(destUrl);
    }

    // Rewrite to the (site)/[domain] route for custom domain resolution
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/${cleanDomain}${pathname}`;
    console.log(`[Middleware] Rewriting custom domain to: ${rewriteUrl.pathname}${rewriteUrl.search}`);
    const customDomainResponse = NextResponse.rewrite(rewriteUrl);
    customDomainResponse.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    return customDomainResponse;
  }

  // ============================================================
  // STEP 2: Main app domain — auth session refresh
  // ============================================================
  const response = NextResponse.next();

  try {
    // Create server client with cookies from middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, { ...options, domain: COOKIE_DOMAIN });
            });
          },
        },
      }
    );

    // Validate the session and auto-refresh expired tokens
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.log('[Middleware] Auth error or session expired:', error.message);

      // If the session is invalid (e.g. user was deleted, token revoked),
      // clear all Supabase auth cookies so the browser stops spamming
      // refresh_token requests on every subsequent request.
      const supabaseProjectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
        /https:\/\/([^.]+)\./
      )?.[1];
      if (supabaseProjectId) {
        const authCookiePrefix = `sb-${supabaseProjectId}-auth-token`;
        request.cookies.getAll().forEach(({ name }) => {
          if (name.startsWith(authCookiePrefix)) {
            response.cookies.set(name, '', {
              maxAge: 0,
              path: '/',
              domain: COOKIE_DOMAIN,
            });
          }
        });
      }
    }

    if (user) {
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-user-email', user.email || '');

      // Check if user is banned
      const { data: profile } = await supabase
        .from('users')
        .select('is_banned')
        .eq('id', user.id)
        .single();

      if (profile?.is_banned) {
        console.log(`[Middleware] Banned user attempted access: ${user.email}`);
        return NextResponse.redirect(new URL(`${APP_URL}?error=account_blocked`));
      }

      // ============================================================
      // STEP 3: Impersonation check
      // ============================================================
      const impersonateId = request.cookies.get('ksw_impersonate')?.value;
      const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (impersonateId && adminEmails.includes(user.email?.toLowerCase() ?? '')) {
        console.log(`[Middleware] Admin ${user.email} is impersonating: ${impersonateId}`);
        // Must forward as a request header (not response header) so that
        // headers() in server components / route handlers can read it.
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-impersonated-user-id', impersonateId);
        const impersonateResponse = NextResponse.next({ request: { headers: requestHeaders } });
        // Copy any refreshed auth cookies onto the new response
        response.cookies.getAll().forEach(({ name, value, ...options }) => {
          impersonateResponse.cookies.set(name, value, options);
        });
        return impersonateResponse;
      }
    }
  } catch (err) {
    console.error('[Middleware] Auth validation error:', err);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files, assets, icons, and the auth callback.
    // The auth/callback route sets its own session cookies and must not be
    // interrupted by middleware attempting to refresh stale tokens — a
    // refresh_token_not_found error there causes Supabase to emit Set-Cookie
    // headers that clear the cookies, which races with (and can overwrite) the
    // new session cookies the callback just set.
    '/((?!_next/static|_next/image|assets|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware for handling:
 * 1. Supabase Auth token validation and refresh (via cookies)
 * 2. Domain-based routing (app dashboard vs customer sites)
 */
export async function middleware(request: NextRequest) {
  // ============================================================
  // STEP 1: Validate & refresh auth tokens (if present)
  // ============================================================
  let response = NextResponse.next();

  // Only process auth for app domain routes (avoid unnecessary auth checks for public sites)
  const hostname = request.headers.get('host') || '';
  const isAppDomain = 
    hostname.includes('localhost') || 
    hostname.includes('app.') ||
    hostname.includes('vercel.app') ||
    hostname.includes('keystoneweb.ca') ||
    hostname.includes('keystoneweb.com') ||
    hostname.startsWith('127.0.0.1');

  if (isAppDomain) {
    try {
      // Create server client with cookies from middleware
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            // In middleware, use request.cookies.getAll()
            getAll() {
              return request.cookies.getAll();
            },
            // Set cookies on the response for auth token refresh
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        }
      );

      // Validate the session and auto-refresh expired tokens
      // getUser() cryptographically verifies the token with Supabase
      // and automatically uses the refresh token if the access token expired
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.log('[Middleware] Auth error or session expired:', error.message);
        // Optionally: Could redirect to /login here, but most redirects should happen client-side
      }

      if (user) {
        // Set user info in response headers for route handlers to access
        response.headers.set('x-user-id', user.id);
        response.headers.set('x-user-email', user.email || '');
      }
    } catch (err) {
      console.error('[Middleware] Auth validation error:', err);
      // Continue without user - will be redirected client-side if needed
    }
  }

  // ============================================================
  // STEP 2: Domain-based routing
  // ============================================================
  const pathname = request.nextUrl.pathname;

  if (isAppDomain) {
    // App dashboard domain - serve normally
    response.headers.set('x-domain', 'app');
    response.headers.set('x-hostname', hostname);
    return response;
  }

  // Customer site domain (e.g., user.keystoneweb.ca, custom-domain.com)
  // Rewrite to /site/[domain]/[path] internally
  const domain = hostname.split(':')[0];
  const url = request.nextUrl.clone();
  url.pathname = `/site/${domain}${pathname}`;

  console.log(`[Middleware] Rewrote ${hostname}${pathname} → ${url.pathname}`);

  const siteResponse = NextResponse.rewrite(url);
  siteResponse.headers.set('x-domain', domain);
  siteResponse.headers.set('x-hostname', hostname);
  return siteResponse;
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware for handling:
 * 1. Supabase Auth token validation and refresh (via cookies)
 * 2. Subdomain routing (published sites at *.kswd.ca)
 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  console.log(`[Middleware] Incoming: ${hostname}${pathname}`);

  // ============================================================
  // STEP 1: Detect published site subdomains (.kswd.ca)
  // ============================================================
  const domain = hostname.split(':')[0]; // Remove port if present

  if (domain.endsWith('.kswd.ca') && !domain.startsWith('www.')) {
    // Extract subdomain: akdesigns.kswd.ca → akdesigns
    const subdomain = domain.split('.kswd.ca')[0];
    
    console.log(`[Middleware] ✅ Detected published subdomain: '${subdomain}'`);
    console.log(`[Middleware] Domain: '${domain}' → Subdomain: '${subdomain}'`);

    // Rewrite internally to the public route
    // The pathname will be preserved, so / stays /
    const rewriteUrl = new URL(`/public/${subdomain}${pathname}`, request.url);
    console.log(`[Middleware] Rewriting to: /public/${subdomain}${pathname}`);
    return NextResponse.rewrite(rewriteUrl);
  }

  console.log(`[Middleware] Not a published subdomain: ${domain}`);

  // ============================================================
  // STEP 2: For app domain, validate auth and refresh tokens
  // ============================================================
  const isAppDomain =
    hostname.includes('localhost') ||
    hostname.includes('app.') ||
    hostname.includes('vercel.app') ||
    hostname.includes('keystoneweb.ca') ||
    hostname.includes('keystoneweb.com') ||
    hostname.startsWith('127.0.0.1');

  if (!isAppDomain) {
    // Not a recognized domain, let it through
    return NextResponse.next();
  }

  let response = NextResponse.next();

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
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Validate the session and auto-refresh expired tokens
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.log('[Middleware] Auth error or session expired:', error.message);
    }

    if (user) {
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-user-email', user.email || '');
    }
  } catch (err) {
    console.error('[Middleware] Auth validation error:', err);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};

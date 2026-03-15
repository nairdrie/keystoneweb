import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware for handling:
 * 1. Supabase Auth token validation and refresh (via cookies)
 * 2. Subdomain routing (published sites at *.kswd.ca)
 * 3. Custom domain routing (user-owned domains pointed via DNS)
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

    console.log(`[Middleware] Detected published subdomain: '${subdomain}'`);

    // Do not rewrite API routes so they can be handled by app/api/
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // Rewrite internally to the public route
    const rewriteUrl = new URL(`/public/${subdomain}${pathname}`, request.url);
    console.log(`[Middleware] Rewriting to: /public/${subdomain}${pathname}`);
    return NextResponse.rewrite(rewriteUrl);
  }

  // ============================================================
  // STEP 1b: Detect custom domain routing
  // ============================================================
  const isAppDomain =
    hostname.includes('localhost') ||
    hostname.includes('app.') ||
    hostname.includes('vercel.app') ||
    hostname.includes('keystoneweb.ca') ||
    hostname.includes('keystoneweb.com') ||
    hostname.startsWith('127.0.0.1');

  if (!isAppDomain && !domain.endsWith('.kswd.ca')) {
    // This could be a custom domain — rewrite to the custom domain route
    // Strip www. prefix if present
    const cleanDomain = domain.startsWith('www.') ? domain.slice(4) : domain;

    console.log(`[Middleware] Detected possible custom domain: '${cleanDomain}'`);

    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }

    // Rewrite to the (site)/[domain] route for custom domain resolution
    const rewriteUrl = new URL(`/${cleanDomain}${pathname}`, request.url);
    console.log(`[Middleware] Rewriting custom domain to: /${cleanDomain}${pathname}`);
    return NextResponse.rewrite(rewriteUrl);
  }

  if (!isAppDomain) {
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
    // Match all routes except static files, api routes, and icons
    '/((?!_next/static|_next/image|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};

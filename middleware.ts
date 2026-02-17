import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Extract the subdomain/domain
  const parts = hostname.split('.');
  const isAppDomain = hostname.includes('app.') || hostname === 'localhost:3000';

  // If it's the app/dashboard domain (app.yourdomain.com or localhost), serve normally
  if (isAppDomain) {
    return NextResponse.next();
  }

  // If it's a client site (e.g., cool-barber.com), rewrite to /site/[domain]/[path]
  // This keeps the original URL in the browser while serving different content
  const url = request.nextUrl.clone();
  
  // Extract just the domain without port for consistency
  const domain = hostname.split(':')[0];
  
  // Rewrite the URL path internally
  url.pathname = `/site/${domain}${pathname}`;
  
  console.log(`[Middleware] Rewrote ${hostname}${pathname} → ${url.pathname}`);
  
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};

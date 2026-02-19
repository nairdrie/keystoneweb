import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Extract the subdomain/domain
  const isAppDomain = 
    hostname.includes('localhost') || 
    hostname.includes('app.') ||
    hostname.includes('vercel.app') ||
    hostname.includes('keystoneweb.ca') ||
    hostname.includes('keystoneweb.com') ||
    hostname.startsWith('127.0.0.1');

  // If it's the app/dashboard domain, serve normally (but add domain header)
  if (isAppDomain) {
    const response = NextResponse.next();
    response.headers.set('x-domain', 'app');
    response.headers.set('x-hostname', hostname);
    return response;
  }

  // If it's a client site (e.g., cool-barber.com), rewrite to /site/[domain]/[path]
  // This keeps the original URL in the browser while serving different content
  const url = request.nextUrl.clone();
  
  // Extract just the domain without port for consistency
  const domain = hostname.split(':')[0];
  
  // Rewrite the URL path internally
  url.pathname = `/site/${domain}${pathname}`;
  
  console.log(`[Middleware] Rewrote ${hostname}${pathname} → ${url.pathname}`);
  
  const response = NextResponse.rewrite(url);
  response.headers.set('x-domain', domain);
  response.headers.set('x-hostname', hostname);
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api|robots.txt).*)',
  ],
};

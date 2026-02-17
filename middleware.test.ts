/**
 * TEST MIDDLEWARE - Force specific hostname
 * 
 * This is a debug version to test the middleware routing.
 * It forces requests to appear as if they came from a specific domain.
 * 
 * To use this:
 * 1. Rename middleware.ts → middleware.prod.ts
 * 2. Rename middleware.test.ts → middleware.ts
 * 3. npm run dev
 * 4. Visit http://localhost:3000 and it will appear as cool-barber.local
 * 
 * This proves the middleware works without needing local DNS setup!
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // FORCE TEST HOSTNAME - Remove this in production!
  const testHostname = 'cool-barber.local';
  console.log(`[Middleware TEST] Forcing hostname: ${testHostname}`);

  const pathname = request.nextUrl.pathname;
  const isAppDomain = false; // Always treat as client site for testing

  // Rewrite to /site/[domain]
  const url = request.nextUrl.clone();
  const domain = testHostname.split(':')[0];

  url.pathname = `/site/${domain}${pathname}`;

  console.log(`
╔════════════════════════════════════════════════════════╗
║                  MIDDLEWARE TEST ROUTING                ║
╠════════════════════════════════════════════════════════╣
║ Original Request:  ${testHostname}${pathname}
║ Rewritten Path:    ${url.pathname}
║ URL in Browser:    ${testHostname} (unchanged!)
╚════════════════════════════════════════════════════════╝
  `);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};

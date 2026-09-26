import { NextRequest, NextResponse } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { signedFileUrl } from '@/lib/shop/files';
import { run, tech } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/files?siteId=&path= — short-lived link to a job photo, voice note or supplier invoice.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await tech(request);
    const path = request.nextUrl.searchParams.get('path') || '';
    const url = await signedFileUrl(access, path, 300);
    if (!url) throw new ShopRuleError('File not found.', undefined, 404);
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}

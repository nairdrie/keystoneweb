import { NextRequest } from 'next/server';
import { loadMoneyView } from '@/lib/shop/views';
import { owner, run } from '@/lib/shop/http';

export const runtime = 'nodejs';

// GET /api/shop/money?siteId=&period=YYYY-MM-DD — who owes, liens, HST return lines, P&L.
export async function GET(request: NextRequest) {
  return run(async () => {
    const access = await owner(request);
    return loadMoneyView(access.db, access.siteId, request.nextUrl.searchParams.get('period'));
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getMarketingAccess } from '@/lib/marketing/admin-auth';
import { getOrCreateWallet, listTransactions } from '@/lib/marketing/wallet';

/**
 * GET /api/admin/marketing/wallet?siteId=xxx
 * Returns the site's wallet + recent transactions.
 */
export async function GET(request: NextRequest) {
  const result = await getMarketingAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '25'), 200);

  const [wallet, transactions] = await Promise.all([
    getOrCreateWallet(access.siteId),
    listTransactions(access.siteId, { limit }),
  ]);

  return NextResponse.json({ wallet, transactions });
}

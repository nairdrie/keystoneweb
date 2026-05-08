import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getMonthlySpendSummary } from '@/lib/marketing/spend';



import { assertOpsAdmin } from '@/lib/ops/access';
/**
 * GET /api/ops/marketing/spend
 * Get spend summary for a month (defaults to current month).
 */
export async function GET(request: NextRequest) {
  if (!await assertOpsAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const now = new Date();
  const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
  const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));

  const db = createAdminClient();
  const summary = await getMonthlySpendSummary(year, month, db, null);

  return NextResponse.json({ summary, year, month });
}

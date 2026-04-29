import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { getMonthlySpendSummary } from '@/lib/marketing/spend';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch { return false; }
}

/**
 * GET /api/ops/marketing/spend
 * Get spend summary for a month (defaults to current month).
 */
export async function GET(request: NextRequest) {
  if (!await assertAdmin()) {
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

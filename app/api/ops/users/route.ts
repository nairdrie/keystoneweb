import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * GET /api/ops/users?page=1&limit=50&search=email&plan=pro
 * Returns a paginated list of users with their subscription and site counts.
 */
export async function GET(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(parseInt(params.get('page') ?? '1', 10), 1);
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 200);
  const search = params.get('search') ?? '';
  const planFilter = params.get('plan') ?? '';
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let query = db
    .from('users')
    .select(`
      id,
      email,
      business_name,
      is_admin,
      created_at,
      user_subscriptions (
        subscription_plan,
        subscription_status,
        subscription_started_at
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('email', `%${search}%`);
  }

  const { data: users, count, error } = await query;

  if (error) {
    console.error('[ops/users] Query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  // Fetch site counts per user in a single query
  const userIds = (users ?? []).map((u: any) => u.id);
  let siteCounts: Record<string, number> = {};

  if (userIds.length > 0) {
    const { data: siteRows } = await db
      .from('sites')
      .select('user_id')
      .in('user_id', userIds)
      .not('user_id', 'is', null);

    for (const row of siteRows ?? []) {
      siteCounts[row.user_id] = (siteCounts[row.user_id] ?? 0) + 1;
    }
  }

  const enriched = (users ?? []).map((u: any) => {
    const sub = Array.isArray(u.user_subscriptions) ? u.user_subscriptions[0] : u.user_subscriptions;
    return {
      id: u.id,
      email: u.email,
      businessName: u.business_name,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      plan: sub?.subscription_plan ?? 'free',
      subscriptionStatus: sub?.subscription_status ?? null,
      subscribedAt: sub?.subscription_started_at ?? null,
      siteCount: siteCounts[u.id] ?? 0,
    };
  });

  // Client-side plan filter (applied after enrichment since it comes from joined data)
  const filtered = planFilter
    ? enriched.filter((u) => u.plan?.toLowerCase().includes(planFilter.toLowerCase()))
    : enriched;

  return NextResponse.json({
    users: filtered,
    total: count ?? 0,
    page,
    limit,
  });
}

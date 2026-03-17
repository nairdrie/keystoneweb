import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

/** Verify the requesting user is an admin before returning ops data. */
async function assertAdmin(): Promise<{ userId: string } | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

/**
 * GET /api/ops/stats
 * Returns aggregate platform statistics for the ops dashboard.
 */
export async function GET(request: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { count: totalSites },
    { count: publishedSites },
    { count: openSupport },
    { count: signups7d },
    { count: signups30d },
    { count: siteCreates30d },
    { count: siteEdits30d },
    { count: sitePublishes30d },
    { count: upgrades30d },
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('user_subscriptions').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    db.from('sites').select('id', { count: 'exact', head: true }).not('user_id', 'is', null),
    db.from('sites').select('id', { count: 'exact', head: true }).eq('is_published', true),
    db.from('support_requests').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'user_signup').gte('created_at', day7),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'user_signup').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'site_create').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'site_edit').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'site_publish').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'subscription_upgrade').gte('created_at', day30),
  ]);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeSubs: activeSubs ?? 0,
    totalSites: totalSites ?? 0,
    publishedSites: publishedSites ?? 0,
    openSupport: openSupport ?? 0,
    signups7d: signups7d ?? 0,
    signups30d: signups30d ?? 0,
    siteCreates30d: siteCreates30d ?? 0,
    siteEdits30d: siteEdits30d ?? 0,
    sitePublishes30d: sitePublishes30d ?? 0,
    upgrades30d: upgrades30d ?? 0,
  });
}

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { parseHost } from '@/lib/env/domain';
import { getOpsAccessContext } from '@/lib/ops/access';
import OpsOverviewDashboard from './OpsOverviewDashboard';
import type { DashboardEvent } from './dashboard-helpers';

type UserRow = {
  id: string;
  email: string | null;
  business_name: string | null;
};

type SiteRow = {
  id: string;
  site_slug: string | null;
  is_published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type SupportItem = {
  id: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
};

type LaunchItem = {
  id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
  status: string | null;
  created_at: string;
};

type SubscriptionRow = {
  subscription_status: string | null;
};

const TRACKED_EVENT_TYPES = [
  'user_signup',
  'user_signin',
  'site_create',
  'site_edit',
  'site_publish',
  'subscription_upgrade',
  'subscription_cancel',
  'domain_purchase',
  'site_delete',
  'site_transfer_created',
  'site_transfer_accepted',
  'site_unpublish',
];

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function countByStatus(rows: SubscriptionRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const status = row.subscription_status?.trim() || 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

export default async function OpsOverviewPage() {
  const db = createAdminClient();
  const access = await getOpsAccessContext();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const opsBasePath = parseHost(host).kind === 'ops' ? '' : '/ops';
  const refreshedAt = new Date().toISOString();
  const day30 = isoDaysAgo(30);
  const day730 = isoDaysAgo(730);

  let supportCountQuery = db
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress']);

  let urgentSupportQuery = db
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress'])
    .in('priority', ['urgent', 'high']);

  let supportItemsQuery = db
    .from('support_requests')
    .select('id, subject, status, priority, created_at')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(6);

  if (access && !access.isAdmin && access.agentContactEmail) {
    supportCountQuery = supportCountQuery.eq('from_email', access.agentContactEmail);
    urgentSupportQuery = urgentSupportQuery.eq('from_email', access.agentContactEmail);
    supportItemsQuery = supportItemsQuery.eq('from_email', access.agentContactEmail);
  }

  const launchCountQuery = access?.isAdmin
    ? db.from('launch_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
    : Promise.resolve({ count: 0 });

  const launchItemsQuery = access?.isAdmin
    ? db
      .from('launch_requests')
      .select('id, name, email, business_name, status, created_at')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(6)
    : Promise.resolve({ data: [] });

  const [
    { count: totalUsers },
    { count: activeSubscriptions },
    { count: totalSites },
    { count: publishedSites },
    { count: draftSites },
    { count: openSupport },
    { count: urgentSupport },
    { count: newLaunchRequests },
    { count: staleDraftSites },
    { data: subscriptionRows },
    { data: supportItems },
    { data: launchItems },
    { data: recentSiteRows },
    { data: chartRows },
    { data: recentEventRows },
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('user_subscriptions').select('user_id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    db.from('sites').select('id', { count: 'exact', head: true }).not('user_id', 'is', null),
    db.from('sites').select('id', { count: 'exact', head: true }).not('user_id', 'is', null).eq('is_published', true),
    db.from('sites').select('id', { count: 'exact', head: true }).not('user_id', 'is', null).eq('is_published', false),
    supportCountQuery,
    urgentSupportQuery,
    launchCountQuery,
    db
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .not('user_id', 'is', null)
      .eq('is_published', false)
      .lt('created_at', day30),
    db.from('user_subscriptions').select('subscription_status'),
    supportItemsQuery,
    launchItemsQuery,
    db
      .from('sites')
      .select('id, site_slug, is_published, created_at, updated_at, published_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
    db
      .from('analytics_events')
      .select('id, event_type, user_id, site_id, metadata, created_at')
      .in('event_type', TRACKED_EVENT_TYPES)
      .gte('created_at', day730)
      .order('created_at', { ascending: true }),
    db
      .from('analytics_events')
      .select('id, event_type, user_id, site_id, metadata, created_at')
      .in('event_type', TRACKED_EVENT_TYPES)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const events = (chartRows ?? []) as DashboardEvent[];
  const recentEvents = (recentEventRows ?? []) as DashboardEvent[];
  const eventUserIds = events.map((event) => event.user_id);
  const eventSiteIds = events.map((event) => event.site_id);
  const userIds = Array.from(new Set([...eventUserIds, ...recentEvents.map((event) => event.user_id)]
    .filter((id): id is string => Boolean(id))));
  const siteIds = Array.from(new Set([
    ...eventSiteIds,
    ...recentEvents.map((event) => event.site_id),
    ...((recentSiteRows ?? []) as SiteRow[]).map((site) => site.id),
  ].filter((id): id is string => Boolean(id))));

  const [{ data: userRows }, { data: siteRows }] = await Promise.all([
    userIds.length > 0
      ? db.from('users').select('id, email, business_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    siteIds.length > 0
      ? db
        .from('sites')
        .select('id, site_slug, is_published, created_at, updated_at, published_at')
        .in('id', siteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const users: Record<string, UserRow> =
    Object.fromEntries(((userRows ?? []) as UserRow[]).map((user) => [user.id, user]));

  const missingUserIds = userIds.filter((id) => !users[id]);
  if (missingUserIds.length > 0) {
    await Promise.all(
      missingUserIds.slice(0, 25).map(async (uid) => {
        try {
          const { data: { user: authUser } } = await db.auth.admin.getUserById(uid);
          if (authUser?.email) {
            users[uid] = { id: authUser.id, email: authUser.email, business_name: null };
          }
        } catch {
          // Leave missing users unnamed in the activity feed.
        }
      }),
    );
  }

  const sites: Record<string, SiteRow> =
    Object.fromEntries(((siteRows ?? []) as SiteRow[]).map((site) => [site.id, site]));

  return (
    <OpsOverviewDashboard
      stats={{
        totalUsers: totalUsers ?? 0,
        activeSubscriptions: activeSubscriptions ?? 0,
        totalSites: totalSites ?? 0,
        publishedSites: publishedSites ?? 0,
        openSupport: openSupport ?? 0,
        urgentSupport: urgentSupport ?? 0,
        newLaunchRequests: newLaunchRequests ?? 0,
        draftSites: draftSites ?? 0,
        staleDraftSites: staleDraftSites ?? 0,
        subscriptionStatusCounts: countByStatus((subscriptionRows ?? []) as SubscriptionRow[]),
      }}
      events={events}
      recentEvents={recentEvents}
      users={users}
      sites={sites}
      supportItems={(supportItems ?? []) as SupportItem[]}
      launchItems={(launchItems ?? []) as LaunchItem[]}
      recentSites={(recentSiteRows ?? []) as SiteRow[]}
      refreshedAt={refreshedAt}
      opsBasePath={opsBasePath}
      canViewUsers={access?.isAdmin ?? false}
      canViewLaunch={access?.isAdmin ?? false}
    />
  );
}

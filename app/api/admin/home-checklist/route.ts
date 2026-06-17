import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { hasPaidAccess } from '@/lib/subscription/access';

const HEALTH_FRESH_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type ChecklistItem = {
  id: 'edit-site' | 'upgrade-plan' | 'seo' | 'health-check' | 'publish-site';
  title: string;
  complete: boolean;
  status: string;
  href: string;
  action: string;
};

type HealthDiagnostic = {
  category?: string | null;
  severity?: string | null;
};

function adminHref(path: string, siteId: string) {
  return `${path}?siteId=${encodeURIComponent(siteId)}`;
}

function formatPlan(plan?: string | null) {
  if (!plan) return 'Paid plan';
  const trimmed = plan.trim();
  if (!trimmed) return 'Paid plan';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)} plan`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...dates: Array<Date | null>) {
  const valid = dates.filter((date): date is Date => Boolean(date));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map(date => date.getTime())));
}

function isSameOrAfter(left: Date, right: Date | null) {
  return !right || left.getTime() >= right.getTime();
}

function getHealthResults(value: unknown): HealthDiagnostic[] {
  return Array.isArray(value) ? value as HealthDiagnostic[] : [];
}

export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId');

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (error) {
      return siteAccessErrorResponse(error);
    }

    const { supabase, targetUserId } = access;
    const safeSiteId = access.siteId;

    const [
      siteResult,
      latestSaveResult,
      latestPageResult,
      subscriptionResult,
      healthRunResult,
    ] = await Promise.all([
      supabase
        .from('sites')
        .select('id, is_published, published_domain, custom_domain, pending_custom_domain, updated_at, created_at')
        .eq('id', safeSiteId)
        .single(),
      supabase
        .from('site_history')
        .select('created_at')
        .eq('site_id', safeSiteId)
        .eq('event_type', 'save_draft')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('pages')
        .select('updated_at')
        .eq('site_id', safeSiteId)
        .order('updated_at', { ascending: false })
        .limit(1),
      supabase
        .from('user_subscriptions')
        .select('subscription_status, subscription_plan')
        .eq('user_id', targetUserId)
        .maybeSingle(),
      supabase
        .from('site_health_check_runs')
        .select('created_at, results, summary')
        .eq('site_id', safeSiteId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    if (siteResult.error || !siteResult.data) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (healthRunResult.error) {
      console.error('Failed to fetch latest health check run:', healthRunResult.error);
    }

    const site = siteResult.data;
    const latestSave = latestSaveResult.data?.[0] ?? null;
    const latestPage = latestPageResult.data?.[0] ?? null;
    const subscription = subscriptionResult.data ?? null;
    const latestHealthRun = healthRunResult.error ? null : healthRunResult.data?.[0] ?? null;

    const now = new Date();
    const freshAfter = new Date(now.getTime() - HEALTH_FRESH_DAYS * DAY_MS);
    const latestSaveAt = parseDate(latestSave?.created_at);
    const latestEditAt = latestDate(
      parseDate(site.updated_at),
      parseDate(latestPage?.updated_at),
      latestSaveAt,
    );
    const healthCheckedAt = parseDate(latestHealthRun?.created_at);
    const healthIsFresh = !!healthCheckedAt && healthCheckedAt.getTime() >= freshAfter.getTime();
    const healthIsAfterEdit = !!healthCheckedAt && isSameOrAfter(healthCheckedAt, latestEditAt);
    const healthIsCurrent = healthIsFresh && healthIsAfterEdit;

    const isPaid = hasPaidAccess(subscription);
    const liveDomain = site.custom_domain || (site.published_domain ? `${site.published_domain}.kswd.ca` : null);
    const isPublished = Boolean(site.is_published && site.published_domain);
    const healthResults = getHealthResults(latestHealthRun?.results);
    const seoIssues = healthResults.filter(result => (
      result.category === 'SEO' && result.severity !== 'pass'
    ));

    const healthStatus = !healthCheckedAt
      ? 'Run your first health check'
      : !healthIsFresh
        ? `Last checked ${formatDate(healthCheckedAt)}`
        : !healthIsAfterEdit
          ? 'Site changed since last check'
          : `${latestHealthRun?.summary?.errors ?? 0} errors, ${latestHealthRun?.summary?.warnings ?? 0} warnings`;

    const publishHref = isPublished
      ? adminHref('/admin/domains', safeSiteId)
      : isPaid
        ? `/publish/domain-select?session_id=existing&siteId=${encodeURIComponent(safeSiteId)}`
        : `/pricing?action=publish&siteId=${encodeURIComponent(safeSiteId)}`;

    const items: ChecklistItem[] = [
      {
        id: 'edit-site',
        title: 'Edit your site',
        complete: Boolean(latestSaveAt),
        status: latestSaveAt ? `Draft saved ${formatDate(latestSaveAt)}` : 'Open the editor and save a draft',
        href: `/editor?siteId=${encodeURIComponent(safeSiteId)}`,
        action: latestSaveAt ? 'Edit' : 'Start',
      },
      {
        id: 'upgrade-plan',
        title: 'Upgrade your plan',
        complete: isPaid,
        status: isPaid ? `Active ${formatPlan(subscription?.subscription_plan)}` : 'Choose a plan to publish and grow',
        href: '/pricing',
        action: isPaid ? 'Compare' : 'Upgrade',
      },
      {
        id: 'health-check',
        title: 'Run the health check',
        complete: healthIsCurrent,
        status: healthStatus,
        href: adminHref('/admin/health', safeSiteId),
        action: healthIsCurrent ? 'View' : 'Run',
      },
      {
        id: 'seo',
        title: 'SEO',
        complete: healthIsCurrent && seoIssues.length === 0,
        status: !healthIsCurrent
          ? 'Run health check to verify SEO'
          : seoIssues.length === 0
            ? 'SEO checks passed'
            : `${seoIssues.length} SEO item${seoIssues.length === 1 ? '' : 's'} need attention`,
        href: adminHref('/admin/seo', safeSiteId),
        action: 'Review',
      },
      {
        id: 'publish-site',
        title: 'Publish your site',
        complete: isPublished,
        status: isPublished
          ? `Live at ${liveDomain}`
          : isPaid
            ? 'Choose your free domain and publish'
            : 'Upgrade before publishing',
        href: publishHref,
        action: isPublished ? 'Manage' : 'Publish',
      },
    ];

    return NextResponse.json({
      items,
      completed: items.filter(item => item.complete).length,
      total: items.length,
      healthFreshDays: HEALTH_FRESH_DAYS,
      latestHealthCheckAt: healthCheckedAt?.toISOString() ?? null,
      latestEditAt: latestEditAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/home-checklist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

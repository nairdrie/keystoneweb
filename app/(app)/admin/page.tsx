'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  FileImage,
  Link2,
  ListChecks,
  Mail,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAdminContext } from './admin-context';

type Subscription = {
  subscription_plan?: string | null;
  subscription_status?: string | null;
};

type InboxAddress = {
  id: string;
  address: string;
  kind: 'kswd_subdomain' | 'custom_domain';
  is_primary: boolean;
};

type AnalyticsData = {
  todayVisitors: number;
  weekVisitors: number;
  totalViews: number;
};

type SeoAudit = {
  score: number;
  totals: { pass: number; warn: number; fail: number; skip: number };
};

type InboxData = {
  unread: number;
  total: number;
};

type MediaData = {
  media: Array<{ id: string; media_type: 'image' | 'pdf' | 'video'; size_bytes: number }>;
  storageUsedBytes: number;
  storageLimitMb: number;
};

type ChecklistItem = {
  id: string;
  title: string;
  complete: boolean;
  status: string;
  href: string;
  action: string;
};

type ChecklistData = {
  items: ChecklistItem[];
  completed: number;
  total: number;
};

const number = (value: number) => value.toLocaleString('en-US');

function adminHref(path: string, siteId: string | null) {
  return `${path}${siteId ? `?siteId=${siteId}` : ''}`;
}

function planValue(subscription: Subscription | null) {
  if (!subscription || subscription.subscription_status !== 'active') return 'Free plan';
  const plan = subscription.subscription_plan?.trim() || 'Paid';
  if (plan.toLowerCase().includes('pro')) return 'Keystone Pro';
  if (plan.toLowerCase().includes('basic')) return 'Keystone Basic';
  return `Keystone ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}

function isProSubscription(subscription: Subscription | null) {
  return subscription?.subscription_status === 'active' &&
    !!subscription.subscription_plan?.toLowerCase().includes('pro');
}

function resolvePrimaryInboxAddress(addresses: InboxAddress[]) {
  if (addresses.length === 0) return null;
  return (
    addresses.find(address => address.is_primary) ??
    addresses.find(address => address.kind === 'custom_domain') ??
    addresses[0]
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Skeleton({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded bg-slate-200 ${className}`} />;
}

function StatusRail({
  label,
  value,
  href,
  action,
  loading = false,
  muted = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  action: string;
  loading?: boolean;
  muted?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 border-slate-200 px-4 py-3 text-sm transition-colors hover:bg-slate-50 sm:border-r"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="whitespace-nowrap text-xs font-bold text-slate-700">{label}</span>
              <span className="whitespace-nowrap text-xs font-bold text-red-600">{action}</span>
            </div>
            <p className={`mt-0.5 truncate text-xs ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{value}</p>
          </>
        )}
      </div>
    </Link>
  );
}

function SnapshotTile({
  title,
  value,
  detail,
  href,
  loading,
  icon: Icon,
  tone = 'slate',
}: {
  title: string;
  value: string;
  detail: string;
  href: string;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'slate' | 'red' | 'emerald' | 'amber' | 'sky' | 'violet';
}) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
  }[tone];

  return (
    <Link
      href={href}
      className="group min-h-[154px] rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {loading ? (
        <div className="mt-2 space-y-3">
          <Skeleton className="h-8 w-20" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-2xl font-black leading-none text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
        </>
      )}
    </Link>
  );
}

function HomeChecklist({
  data,
  loading,
}: {
  data: ChecklistData | null;
  loading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-slate-500" />
          <h3 className="truncate text-sm font-black text-slate-900">Setup checklist</h3>
        </div>
        {loading ? (
          <Skeleton className="h-4 w-16" />
        ) : data ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {data.completed}/{data.total} done
          </span>
        ) : null}
      </div>

      <div className="divide-y divide-slate-100">
        {loading && Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex min-h-[58px] items-center gap-3 px-4 py-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}

        {!loading && data?.items.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex min-h-[58px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            {item.complete ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-slate-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{item.status}</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-red-600 group-hover:text-red-700">
              {item.action}
            </span>
          </Link>
        ))}

        {!loading && !data && (
          <div className="flex min-h-[58px] items-center px-4 py-3 text-sm text-slate-500">
            Checklist unavailable.
          </div>
        )}
      </div>
    </section>
  );
}

export default function AdminHomePage() {
  const { siteId, site } = useAdminContext();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [addressesResult, setAddressesResult] = useState<{ siteId: string; data: InboxAddress[] } | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<{ key: string; data: AnalyticsData | null } | null>(null);
  const [seoResult, setSeoResult] = useState<{ siteId: string; data: SeoAudit | null } | null>(null);
  const [inboxResult, setInboxResult] = useState<{ siteId: string; data: InboxData | null } | null>(null);
  const [mediaResult, setMediaResult] = useState<{ siteId: string; data: MediaData | null } | null>(null);
  const [checklistResult, setChecklistResult] = useState<{ siteId: string; data: ChecklistData | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/user/subscription', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setSubscription(data?.subscription ?? null);
      })
      .catch(() => {
        if (!cancelled) setSubscription(null);
      })
      .finally(() => {
        if (!cancelled) setSubscriptionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;

    fetch(`/api/email/addresses?siteId=${siteId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setAddressesResult({ siteId, data: data?.addresses ?? [] });
      })
      .catch(() => {
        if (!cancelled) setAddressesResult({ siteId, data: [] });
      });

    fetch(`/api/contact/inbox?siteId=${siteId}&page=1`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setInboxResult({ siteId, data: data ?? null });
      })
      .catch(() => {
        if (!cancelled) setInboxResult({ siteId, data: null });
      });

    fetch(`/api/seo/audit?siteId=${siteId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setSeoResult({ siteId, data: data ?? null });
      })
      .catch(() => {
        if (!cancelled) setSeoResult({ siteId, data: null });
      });

    fetch(`/api/sites/media?siteId=${siteId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setMediaResult({ siteId, data: data ?? null });
      })
      .catch(() => {
        if (!cancelled) setMediaResult({ siteId, data: null });
      });

    fetch(`/api/admin/home-checklist?siteId=${siteId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setChecklistResult({ siteId, data: data ?? null });
      })
      .catch(() => {
        if (!cancelled) setChecklistResult({ siteId, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const canLoadAnalytics = subscriptionReady && !!siteId && !!site?.isPublished && isProSubscription(subscription);
  const analyticsKey = `${siteId ?? ''}:${site?.isPublished ? 'published' : 'draft'}:${subscription?.subscription_status ?? ''}:${subscription?.subscription_plan ?? ''}`;

  useEffect(() => {
    if (!siteId || !canLoadAnalytics) return;
    let cancelled = false;

    fetch(`/api/sites/analytics?siteId=${siteId}&days=30`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setAnalyticsResult({ key: analyticsKey, data: data ?? null });
      })
      .catch(() => {
        if (!cancelled) setAnalyticsResult({ key: analyticsKey, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [analyticsKey, canLoadAnalytics, siteId]);

  const addresses = useMemo(
    () => (addressesResult?.siteId === siteId ? addressesResult.data : []),
    [addressesResult, siteId],
  );
  const inbox = inboxResult?.siteId === siteId ? inboxResult.data : null;
  const seoAudit = seoResult?.siteId === siteId ? seoResult.data : null;
  const media = mediaResult?.siteId === siteId ? mediaResult.data : null;
  const checklist = checklistResult?.siteId === siteId ? checklistResult.data : null;
  const analytics = canLoadAnalytics && analyticsResult?.key === analyticsKey ? analyticsResult.data : null;
  const addressesLoading = !!siteId && addressesResult?.siteId !== siteId;
  const inboxLoading = !!siteId && inboxResult?.siteId !== siteId;
  const seoLoading = !!siteId && seoResult?.siteId !== siteId;
  const mediaLoading = !!siteId && mediaResult?.siteId !== siteId;
  const checklistLoading = !!siteId && checklistResult?.siteId !== siteId;
  const analyticsLoading = !subscriptionReady || (canLoadAnalytics && analyticsResult?.key !== analyticsKey);

  const primaryAddress = useMemo(() => resolvePrimaryInboxAddress(addresses), [addresses]);
  const displayDomain = site?.customDomain || site?.pendingCustomDomain || (site?.publishedDomain ? `${site.publishedDomain}.kswd.ca` : null);
  const storagePercent = media && media.storageLimitMb > 0
    ? Math.min(100, Math.round((media.storageUsedBytes / (media.storageLimitMb * 1024 * 1024)) * 100))
    : 0;

  const trafficValue = analytics
    ? number(analytics.weekVisitors)
    : site?.isPublished
      ? 'Live'
      : 'Draft';
  const trafficDetail = analytics
    ? `${number(analytics.todayVisitors)} visitors today and ${number(analytics.totalViews)} page views in 30 days.`
    : site?.isPublished
      ? 'Detailed traffic appears here on Pro plans.'
      : 'Publish your site to begin tracking visitors.';

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.25fr_1fr]">
          <StatusRail
            icon={Sparkles}
            label="Current plan"
            value={planValue(subscription)}
            href="/pricing"
            action="Compare Plans"
            loading={!subscriptionReady}
          />
          <StatusRail
            icon={Link2}
            label="Domain"
            value={displayDomain ?? 'Publish to create your free domain'}
            href={adminHref('/admin/domains', siteId)}
            action={displayDomain ? 'Manage' : 'Connect Domain'}
            muted={!displayDomain}
          />
          <StatusRail
            icon={Mail}
            label="Business email"
            value={primaryAddress?.address ?? (site?.isPublished ? 'Inbox address is being prepared' : 'Publish to create your free inbox')}
            href={adminHref('/admin/inbox', siteId)}
            action={primaryAddress ? 'Open' : 'Set Up'}
            loading={addressesLoading}
            muted={!primaryAddress}
          />
          <StatusRail
            icon={Settings}
            label="Business info"
            value="Profile, SEO, social links"
            href={adminHref('/admin/seo', siteId)}
            action="Edit"
          />
        </div>
      </section>

      <h2 className="text-base font-black text-slate-900">Home</h2>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotTile
          icon={BarChart3}
          title="Traffic"
          value={trafficValue}
          detail={trafficDetail}
          href={adminHref('/admin/analytics', siteId)}
          loading={analyticsLoading}
          tone="sky"
        />
        <SnapshotTile
          icon={Mail}
          title="Inbox"
          value={inbox ? number(inbox.unread) : '0'}
          detail={`${inbox?.total ?? 0} total conversations and contact submissions.`}
          href={adminHref('/admin/inbox', siteId)}
          loading={inboxLoading}
          tone={inbox?.unread ? 'red' : 'slate'}
        />
        <SnapshotTile
          icon={Search}
          title="SEO"
          value={seoAudit ? `${seoAudit.score}/100` : 'Review'}
          detail={seoAudit ? `${seoAudit.totals.fail} failing checks and ${seoAudit.totals.warn} warnings.` : 'Review page metadata and business profile.'}
          href={adminHref('/admin/seo', siteId)}
          loading={seoLoading}
          tone={seoAudit && seoAudit.score >= 80 ? 'emerald' : seoAudit && seoAudit.score < 60 ? 'red' : 'amber'}
        />
        <SnapshotTile
          icon={FileImage}
          title="Media"
          value={media ? number(media.media.length) : '0'}
          detail={media ? `${formatBytes(media.storageUsedBytes)} used, ${storagePercent}% of storage.` : 'Upload reusable images, PDFs, and videos.'}
          href={adminHref('/admin/media', siteId)}
          loading={mediaLoading}
          tone={storagePercent >= 90 ? 'red' : storagePercent >= 70 ? 'amber' : 'violet'}
        />
      </section>

      <HomeChecklist data={checklist} loading={checklistLoading} />

    </div>
  );
}

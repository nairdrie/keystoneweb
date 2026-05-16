'use client';

import { useEffect, useState } from 'react';
import { Globe, FileText, ArrowRightLeft, AlertTriangle, ArrowRight } from 'lucide-react';

type TabId = 'overview' | 'site' | 'pages' | 'schema' | 'redirects' | 'audit';

interface SeoOverviewPanelProps {
  siteId: string | undefined;
  onJump: (tab: TabId) => void;
}

interface OverviewStats {
  pages: number;
  pagesMissingSeo: number;
  redirects: number;
  redirectHits: number;
  unresolved404s: number;
}

const EMPTY: OverviewStats = { pages: 0, pagesMissingSeo: 0, redirects: 0, redirectHits: 0, unresolved404s: 0 };

export default function SeoOverviewPanel({ siteId, onJump }: SeoOverviewPanelProps) {
  const [stats, setStats] = useState<OverviewStats>(EMPTY);
  const [loading, setLoading] = useState<boolean>(!!siteId);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;

    Promise.all([
      fetch(`/api/seo/pages?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { pages: [] }),
      fetch(`/api/seo/redirects?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { redirects: [] }),
      fetch(`/api/seo/404-logs?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
    ])
      .then(([pagesRes, redirectsRes, logsRes]) => {
        if (cancelled) return;
        const pages = pagesRes.pages || [];
        const redirects = redirectsRes.redirects || [];
        const logs = logsRes.logs || [];
        setStats({
          pages: pages.length,
          pagesMissingSeo: pages.filter((p: { seo?: { seoTitle?: string; seoDescription?: string } }) =>
            !p.seo?.seoTitle || !p.seo?.seoDescription,
          ).length,
          redirects: redirects.length,
          redirectHits: redirects.reduce((sum: number, r: { hit_count?: number }) => sum + (r.hit_count ?? 0), 0),
          unresolved404s: logs.length,
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [siteId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={FileText}
          label="Pages"
          value={loading ? '—' : stats.pages.toString()}
          sub={loading ? '' : `${stats.pagesMissingSeo} missing title or description`}
          cta="Edit page SEO"
          onCta={() => onJump('pages')}
        />
        <StatCard
          icon={ArrowRightLeft}
          label="Redirects"
          value={loading ? '—' : stats.redirects.toString()}
          sub={loading ? '' : `${stats.redirectHits.toLocaleString()} total hits`}
          cta="Manage redirects"
          onCta={() => onJump('redirects')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Unresolved 404s"
          value={loading ? '—' : stats.unresolved404s.toString()}
          sub={loading ? '' : 'Recent dead URLs you can redirect'}
          cta="Review 404s"
          onCta={() => onJump('redirects')}
          tone={stats.unresolved404s > 0 ? 'warn' : 'default'}
        />
        <StatCard
          icon={Globe}
          label="Site profile"
          value="—"
          sub="Business profile, social links, Google Places"
          cta="Edit site profile"
          onCta={() => onJump('site')}
        />
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">Coming in later phases:</strong> live JSON-LD schema editor (Phase 2),
        AI-powered audit with per-page score, GBP completeness checks, and voice-search readiness (Phase 3),
        plus IndexNow + <code>llms.txt</code> for AI assistant discovery (Phase 4).
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  cta,
  onCta,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  cta: string;
  onCta: () => void;
  tone?: 'default' | 'warn';
}) {
  const accent = tone === 'warn' ? 'text-amber-600' : 'text-slate-400';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 min-h-[1rem]">{sub}</div>
      <button
        onClick={onCta}
        className="self-start text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 mt-1"
      >
        {cta} <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

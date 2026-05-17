'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Wand2, ChevronDown } from 'lucide-react';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

interface AuditCheck {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  detail: string;
  pageId?: string;
  pageSlug?: string;
  fixHint?: string;
}

interface AuditResult {
  checks: AuditCheck[];
  score: number;
  totals: { pass: number; warn: number; fail: number; skip: number };
  pageScores: Record<string, { pass: number; warn: number; fail: number; total: number; score: number }>;
}

const STATUS_ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, skip: 3 };
const CATEGORY_LABEL: Record<string, string> = {
  titles: 'Titles',
  descriptions: 'Descriptions',
  business: 'Business profile',
  social: 'Social signals',
  schema: 'Structured data',
  indexability: 'Indexability',
  content: 'Content',
  discoverability: 'Discoverability',
};

interface SeoAuditPanelProps { siteId: string | undefined }

export default function SeoAuditPanel({ siteId }: SeoAuditPanelProps) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState<boolean>(!!siteId);
  const [filter, setFilter] = useState<'all' | 'fail' | 'warn' | 'pass'>('all');
  const [openSuggest, setOpenSuggest] = useState<Record<string, { loading: boolean; text?: string }>>({});

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/seo/audit?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setResult(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  const grouped = useMemo(() => {
    if (!result) return [];
    const filtered = result.checks
      .filter(c => filter === 'all' || c.status === filter)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const byCat = new Map<string, AuditCheck[]>();
    for (const c of filtered) {
      const arr = byCat.get(c.category) || [];
      arr.push(c);
      byCat.set(c.category, arr);
    }
    return Array.from(byCat.entries());
  }, [result, filter]);

  const requestSuggestion = async (check: AuditCheck) => {
    if (!siteId) return;
    setOpenSuggest(prev => ({ ...prev, [check.id]: { loading: true } }));
    try {
      const res = await fetch('/api/seo/audit/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          checkLabel: check.label,
          checkDetail: check.detail,
          fixHint: check.fixHint,
        }),
      });
      const data = await res.json();
      setOpenSuggest(prev => ({ ...prev, [check.id]: { loading: false, text: data.suggestion || data.error || 'No suggestion.' } }));
    } catch {
      setOpenSuggest(prev => ({ ...prev, [check.id]: { loading: false, text: 'Could not load suggestion.' } }));
    }
  };

  if (!siteId) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Select a site to run an audit.</div>;
  }

  if (loading || !result) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Running audit…
      </div>
    );
  }

  const scoreColor = result.score >= 80 ? 'text-emerald-600' : result.score >= 60 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900">SEO scorecard</h3>
            <p className="text-xs text-slate-500 mt-1">{result.checks.length} checks ran. Click any failing check for an AI-suggested fix.</p>
          </div>
          <div className={`text-4xl font-extrabold ${scoreColor}`}>{result.score}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Passing" value={result.totals.pass} tone="pass" onClick={() => setFilter('pass')} active={filter === 'pass'} />
          <Stat label="Warnings" value={result.totals.warn} tone="warn" onClick={() => setFilter('warn')} active={filter === 'warn'} />
          <Stat label="Failing" value={result.totals.fail} tone="fail" onClick={() => setFilter('fail')} active={filter === 'fail'} />
        </div>
        <div className="mt-3">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs ${filter === 'all' ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Show all {result.checks.length} checks
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500 text-center">
          No {filter === 'all' ? '' : filter} checks in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([cat, items]) => (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">{CATEGORY_LABEL[cat] || cat}</h4>
                <span className="text-[11px] text-slate-400">{items.length} {items.length === 1 ? 'check' : 'checks'}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map(check => {
                  const suggest = openSuggest[check.id];
                  return (
                    <li key={check.id} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <StatusIcon status={check.status} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{check.label}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{check.detail}</div>
                        </div>
                        {check.status !== 'pass' && check.fixHint && (
                          <button
                            onClick={() => requestSuggestion(check)}
                            disabled={suggest?.loading}
                            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                          >
                            {suggest?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Suggest fix
                          </button>
                        )}
                      </div>
                      {suggest?.text && (
                        <div className="ml-7 bg-indigo-50 border border-indigo-200 rounded-md p-3 text-xs text-indigo-900 whitespace-pre-wrap leading-relaxed">
                          {suggest.text}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, onClick, active }: { label: string; value: number; tone: 'pass' | 'warn' | 'fail'; onClick: () => void; active: boolean }) {
  const colors = {
    pass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    fail: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${colors} ${active ? 'ring-2 ring-offset-1 ring-slate-900' : ''}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</div>
    </button>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
  return <ChevronDown className="w-5 h-5 text-slate-300 shrink-0" />;
}

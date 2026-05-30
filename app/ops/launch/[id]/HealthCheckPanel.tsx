'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import {
  type DiagnosticResult,
  type Severity,
} from '@/lib/health-checks';

interface HealthCheckPanelProps {
  siteId: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, pass: 2 };

function SeverityIcon({ severity }: { severity: Severity }) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
}

export default function HealthCheckPanel({ siteId }: HealthCheckPanelProps) {
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          context: 'ops',
          includeReachability: true,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.details || errorData?.error || `HTTP ${res.status}`);
      }
      const data: { results?: DiagnosticResult[] } = await res.json();
      const diagnostics = data.results ?? [];
      diagnostics.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setResults(diagnostics);
      const issues = new Set(diagnostics.filter((d) => d.severity !== 'pass').map((d) => d.category));
      setExpanded(issues);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run health check');
    } finally {
      setLoading(false);
    }
  }

  const grouped = results
    ? results.reduce<Record<string, DiagnosticResult[]>>((acc, r) => {
        (acc[r.category] ||= []).push(r);
        return acc;
      }, {})
    : null;

  const errorCount = results?.filter((r) => r.severity === 'error').length ?? 0;
  const warningCount = results?.filter((r) => r.severity === 'warning').length ?? 0;
  const passCount = results?.filter((r) => r.severity === 'pass').length ?? 0;

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Health Check
        </h2>
        {results && (
          <div className="flex items-center gap-3 text-xs">
            {errorCount > 0 && (
              <span className="text-red-400">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-400">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-emerald-400">{passCount} passed</span>
          </div>
        )}
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning the site, fetching links and images…
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            {results ? 'Re-run health check' : 'Run health check'}
          </>
        )}
      </button>

      {error && (
        <p className="mt-3 text-xs text-red-300 bg-red-950 border border-red-900 rounded px-3 py-2">
          {error}
        </p>
      )}

      {results && (
        <>
          {errorCount === 0 && warningCount === 0 && (
            <p className="mt-3 rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
              All checks passed — site is ready to send to client.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {grouped &&
              Object.entries(grouped).map(([category, items]) => {
                const hasIssues = items.some((i) => i.severity !== 'pass');
                const isOpen = expanded.has(category);
                const catErrors = items.filter((i) => i.severity === 'error').length;
                const catWarnings = items.filter((i) => i.severity === 'warning').length;

                return (
                  <div
                    key={category}
                    className="border border-gray-800 rounded overflow-hidden"
                  >
                    <button
                      onClick={() => toggle(category)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                        hasIssues ? 'bg-gray-800/60 hover:bg-gray-800' : 'bg-gray-900/40 hover:bg-gray-800/40'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                        {hasIssues ? (
                          catErrors > 0 ? (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {category}
                        {catErrors > 0 && (
                          <span className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded-full">
                            {catErrors}
                          </span>
                        )}
                        {catWarnings > 0 && (
                          <span className="text-[10px] bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded-full">
                            {catWarnings}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                        {items.map((item) => (
                          <div key={item.id} className="px-3 py-2.5 flex items-start gap-2">
                            <SeverityIcon severity={item.severity} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-gray-200">{item.label}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                                {item.message}
                              </div>
                              {item.link && item.severity !== 'pass' && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 mt-1 break-all"
                                >
                                  Open
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </section>
  );
}

export function HealthCheckCounts({ counts }: { counts: { errors: number; warnings: number; passed: number } | null }) {
  if (!counts) return null;
  return (
    <span className="text-xs">
      {counts.errors > 0 && <span className="text-red-400">{counts.errors}e </span>}
      {counts.warnings > 0 && <span className="text-amber-400">{counts.warnings}w </span>}
      <span className="text-emerald-400">{counts.passed}✓</span>
    </span>
  );
}

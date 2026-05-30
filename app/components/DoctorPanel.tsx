'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import {
    type DiagnosticResult,
    type Severity,
} from '@/lib/health-checks';

interface DoctorPanelProps {
    siteId?: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, pass: 2 };

function SeverityIcon({ severity }: { severity: Severity }) {
    switch (severity) {
        case 'error':
            return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
        case 'warning':
            return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
        case 'pass':
            return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    }
}

export default function DoctorPanel({ siteId }: DoctorPanelProps) {
    const [results, setResults] = useState<DiagnosticResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const runDiagnostics = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/doctor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    siteId,
                    context: 'designer',
                    includeReachability: true,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.details || data?.error || 'Failed to run diagnostics');
            }
            const data: { results?: DiagnosticResult[] } = await res.json();
            const diagnostics = data.results ?? [];
            diagnostics.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
            setResults(diagnostics);

            const issueCategories = new Set(
                diagnostics.filter(d => d.severity !== 'pass').map(d => d.category)
            );
            setExpandedCategories(issueCategories);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Please try again.';
            setError(`Failed to run diagnostics. ${message}`);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const grouped = results
        ? results.reduce<Record<string, DiagnosticResult[]>>((acc, r) => {
            if (!acc[r.category]) acc[r.category] = [];
            acc[r.category].push(r);
            return acc;
        }, {})
        : null;

    const errorCount = results?.filter(r => r.severity === 'error').length || 0;
    const warningCount = results?.filter(r => r.severity === 'warning').length || 0;
    const passCount = results?.filter(r => r.severity === 'pass').length || 0;

    return (
        <div className="p-4 space-y-4">
            <div className="text-sm text-slate-600">
                Run a full health check on your site before publishing. Scans for missing configurations, broken links, incomplete setups, and accessibility compliance (AODA / WCAG 2.0 AA).
            </div>

            <button
                onClick={runDiagnostics}
                disabled={loading || !siteId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: loading ? '#94a3b8' : '#7c3aed' }}
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                    </>
                ) : (
                    <>
                        <RefreshCw className="w-4 h-4" />
                        {results ? 'Re-run Health Check' : 'Run Health Check'}
                    </>
                )}
            </button>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                </div>
            )}

            {results && !loading && (
                <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                <XCircle className="w-3.5 h-3.5" />
                                {errorCount} error{errorCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {warningCount} warning{warningCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        {passCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {passCount} passed
                            </span>
                        )}
                        {errorCount === 0 && warningCount === 0 && (
                            <span className="text-xs font-semibold text-green-700">
                                All checks passed! Your site is ready to publish.
                            </span>
                        )}
                    </div>

                    <div className="space-y-2">
                        {grouped && Object.entries(grouped).map(([category, items]) => {
                            const hasIssues = items.some(i => i.severity !== 'pass');
                            const isExpanded = expandedCategories.has(category);
                            const catErrors = items.filter(i => i.severity === 'error').length;
                            const catWarnings = items.filter(i => i.severity === 'warning').length;

                            return (
                                <div
                                    key={category}
                                    className="border border-slate-200 rounded-lg overflow-hidden"
                                >
                                    <button
                                        onClick={() => toggleCategory(category)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${hasIssues
                                            ? 'bg-red-50 hover:bg-red-100'
                                            : 'bg-green-50 hover:bg-green-100'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                            {hasIssues ? (
                                                catErrors > 0 ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                            )}
                                            {category}
                                            {catErrors > 0 && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                                    {catErrors}
                                                </span>
                                            )}
                                            {catWarnings > 0 && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                    {catWarnings}
                                                </span>
                                            )}
                                        </span>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 divide-y divide-slate-100">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="px-3 py-2.5 flex items-start gap-2"
                                                >
                                                    <SeverityIcon severity={item.severity} />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium text-slate-800">
                                                            {item.label}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                            {item.message}
                                                        </div>
                                                        {item.link && item.severity !== 'pass' && (
                                                            <a
                                                                href={item.link}
                                                                className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium mt-1"
                                                            >
                                                                Fix this
                                                                <ExternalLink className="w-3 h-3" />
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

            {!results && !loading && !error && (
                <div className="text-center text-xs text-slate-400 py-4">
                    Click &ldquo;Run Diagnostics&rdquo; to scan your site.
                </div>
            )}
        </div>
    );
}

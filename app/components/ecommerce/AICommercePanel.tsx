'use client';

/**
 * AI Commerce dashboard for a single site.
 *
 * Surfaces three things merchants care about:
 *   1. Share of Voice — how much of their store's traffic is AI agents vs.
 *      browser sessions, and which agent is sending the most.
 *   2. Funnel — agent cart creates → agent checkouts → revenue.
 *   3. Enrichment coverage — % of catalog with AI-readable attributes; a
 *      one-click "Auto-enrich all" button kicks the job worker for the
 *      missing rows so owners never have to manually fill in conversational
 *      attributes.
 *
 * Endpoints they hit:
 *   - GET  /api/ai-commerce/analytics?siteId=...
 *   - POST /api/products/ai-enrich  { siteId, all: true }
 */

import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Sparkles, ShoppingCart, DollarSign, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Analytics {
  windowDays: number;
  summary: {
    totalAgentRequests: number;
    browserRequests: number;
    shareOfVoice: number;
    agentCartCreates: number;
    agentCheckouts: number;
    agentRevenueCents: number;
  };
  perAgent: Array<{ agent: string; requests: number; carts: number; checkouts: number; revenueCents: number }>;
  topProducts: Array<{ id: string; name: string; hits: number }>;
  timeline: Array<{ day: string; agentRequests: number; checkouts: number }>;
  enrichment: { enrichedProducts: number; totalProducts: number; coverage: number };
}

const AGENT_LABELS: Record<string, string> = {
  'google-gemini': 'Google Gemini',
  'google-shopping': 'Google Shopping',
  'openai-operator': 'OpenAI Operator',
  'openai-chatgpt': 'ChatGPT',
  'anthropic-claude': 'Claude',
  'perplexity': 'Perplexity',
  'meta-ai': 'Meta AI',
  'microsoft-copilot': 'Microsoft Copilot',
  'unknown-bot': 'Unknown bot',
};

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AICommercePanel({ siteId, storefrontUrl }: { siteId: string; storefrontUrl?: string | null }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-commerce/analytics?siteId=${siteId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const enrichAll = async () => {
    setEnriching(true);
    setEnrichMessage(null);
    try {
      let remaining = Infinity;
      let totalProcessed = 0;
      // Worker drains in batches of 10 so we don't sit on a long-lived
      // request — the dashboard polls until remaining hits zero.
      while (remaining > 0 && totalProcessed < 200) {
        const res = await fetch('/api/products/ai-enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ siteId, all: true, limit: 10 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        totalProcessed += json.processed ?? 0;
        remaining = json.remaining ?? 0;
        setEnrichMessage(`Enriched ${totalProcessed} products${remaining ? ` (${remaining} left)…` : ' — done.'}`);
        if (json.processed === 0) break;
      }
      await refresh();
    } catch (e) {
      setEnrichMessage(`Enrichment failed: ${(e as Error).message}`);
    } finally {
      setEnriching(false);
    }
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error || !data) {
    return <div className="p-6 text-red-600">Couldn&apos;t load AI commerce data: {error || 'unknown'}</div>;
  }

  const sov = Math.round(data.summary.shareOfVoice * 100);
  const coverage = Math.round(data.enrichment.coverage * 100);
  const feedUrl = storefrontUrl ? `${storefrontUrl}/feeds/native-commerce.xml` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            AI Commerce
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            How AI shopping assistants (Gemini, Operator, Claude, Perplexity) are interacting with your store. Last {data.windowDays} days.
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Bot className="w-5 h-5 text-violet-500" />} label="Share of Voice" value={`${sov}%`} sub={`${data.summary.totalAgentRequests.toLocaleString()} agent reqs`} />
        <Stat icon={<ShoppingCart className="w-5 h-5 text-blue-500" />} label="Agent carts" value={data.summary.agentCartCreates.toLocaleString()} />
        <Stat icon={<Activity className="w-5 h-5 text-emerald-500" />} label="Agent checkouts" value={data.summary.agentCheckouts.toLocaleString()} />
        <Stat icon={<DollarSign className="w-5 h-5 text-amber-500" />} label="Agent revenue" value={money(data.summary.agentRevenueCents)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Activity by agent</h3>
        {data.perAgent.length === 0
          ? <p className="text-sm text-slate-500">No AI agent activity yet. Submit your <span className="font-mono">native-commerce.xml</span> feed to Google Merchant Center to start being indexed by Gemini.</p>
          : <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Agent</th>
                  <th className="py-2 text-right">Requests</th>
                  <th className="py-2 text-right">Carts</th>
                  <th className="py-2 text-right">Checkouts</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.perAgent.map(a => (
                  <tr key={a.agent} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{AGENT_LABELS[a.agent] ?? a.agent}</td>
                    <td className="py-2 text-right">{a.requests.toLocaleString()}</td>
                    <td className="py-2 text-right">{a.carts.toLocaleString()}</td>
                    <td className="py-2 text-right">{a.checkouts.toLocaleString()}</td>
                    <td className="py-2 text-right">{money(a.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">AI attribute coverage</h3>
            <p className="text-sm text-slate-500 mt-1">
              {data.enrichment.enrichedProducts}/{data.enrichment.totalProducts} products have conversational AI attributes ({coverage}%).
              These power compatibility/fit answers in Gemini and other agents.
            </p>
          </div>
          <button
            onClick={enrichAll}
            disabled={enriching || data.enrichment.coverage >= 1}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-slate-300"
          >
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {data.enrichment.coverage >= 1 ? 'All enriched' : 'Auto-enrich catalog'}
          </button>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-violet-500 transition-all" style={{ width: `${coverage}%` }} />
        </div>
        {enrichMessage && (
          <p className="mt-2 text-xs text-slate-600 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {enrichMessage}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Most-queried products by AI</h3>
        {data.topProducts.length === 0
          ? <p className="text-sm text-slate-500">No agent product queries yet.</p>
          : <ul className="space-y-2">
              {data.topProducts.map(p => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-900">{p.name}</span>
                  <span className="text-slate-500">{p.hits.toLocaleString()} reads</span>
                </li>
              ))}
            </ul>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Integration endpoints</h3>
        <p className="text-sm text-slate-500 mb-3">Submit these URLs to Google Merchant Center / point AI clients here.</p>
        <ul className="space-y-2 text-xs font-mono break-all">
          {feedUrl && <Endpoint label="native_commerce feed (Merchant Center)" url={feedUrl} />}
          {storefrontUrl && <Endpoint label="UCP discovery" url={`${storefrontUrl}/.well-known/ucp.json`} />}
          {storefrontUrl && <Endpoint label="A2A agent card" url={`${storefrontUrl}/.well-known/agent.json`} />}
          <Endpoint label="UCP REST base" url={`/api/ucp/${siteId}`} />
          <Endpoint label="MCP JSON-RPC" url={`/api/mcp/${siteId}`} />
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs">{icon}<span>{label}</span></div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function Endpoint({ label, url }: { label: string; url: string }) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
      <span className="font-sans text-slate-600 not-italic">{label}</span>
      <code className="text-violet-700">{url}</code>
    </li>
  );
}

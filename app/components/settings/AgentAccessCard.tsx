'use client';

/**
 * Account Settings → AI agents: how to connect an AI app (Claude, etc.) to
 * Keystone via the MCP server, and which apps are connected. Connecting uses
 * sign-in (OAuth) — no keys to copy.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Bot, Check, Copy, Loader2, Unplug } from 'lucide-react';

const noopSubscribe = () => () => {};

async function fetchApps(): Promise<ConnectedApp[]> {
  const res = await fetch('/api/user/connected-apps', { credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  return res.ok ? body.apps || [] : [];
}

interface ConnectedApp {
  client_id: string;
  name: string;
  scopes: string[];
  last_connected: string;
}

export default function AgentAccessCard() {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');
  const endpoint = `${origin || 'https://keystoneweb.ca'}/api/mcp`;

  const load = useCallback(async () => { setApps(await fetchApps()); }, []);
  useEffect(() => {
    let live = true;
    fetchApps().then((list) => { if (live) setApps(list); });
    return () => { live = false; };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <Bot className="h-5 w-5 text-red-500" />
          AI agents
        </h2>
        <p className="text-sm text-slate-500">
          Connect an AI app like Claude to build and edit your sites. Agents work on drafts and can&apos;t overwrite text you&apos;ve edited.
        </p>
      </div>

      <div className="space-y-5 bg-slate-50/50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">MCP server URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-slate-100 px-2 py-1 text-sm">{endpoint}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(endpoint).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Copy URL"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="mb-2 font-semibold text-slate-900">Claude app (desktop or web)</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Settings → Connectors → <span className="font-medium">Add custom connector</span></li>
              <li>Paste the URL above and click Add</li>
              <li>Sign in to Keystone and click <span className="font-medium">Allow</span></li>
            </ol>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="mb-2 font-semibold text-slate-900">Claude Code</p>
            <code className="block break-all rounded bg-slate-100 px-2 py-1 text-xs">claude mcp add --transport http keystone {endpoint}</code>
            <p className="mt-2">Then run <code className="rounded bg-slate-100 px-1">/mcp</code> and choose keystone to sign in.</p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Then ask it something like: <span className="italic">&ldquo;Use Keystone to build a website for my bakery in Oakville.&rdquo;</span>
        </p>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Connected apps</p>
          {apps === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : apps.length === 0 ? (
            <p className="text-sm text-slate-500">No AI apps connected yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {apps.map((app) => (
                <li key={app.client_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{app.name}</p>
                    <p className="text-xs text-slate-500">
                      {app.scopes.includes('sites:publish') ? 'Can edit and publish' : 'Can edit drafts'} · connected {new Date(app.last_connected).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    disabled={busy === app.client_id}
                    onClick={async () => {
                      if (!confirm(`Disconnect ${app.name}? It will stop working until you connect it again.`)) return;
                      setBusy(app.client_id);
                      await fetch('/api/user/connected-apps', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: app.client_id }) });
                      setBusy(null);
                      await load();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    {busy === app.client_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

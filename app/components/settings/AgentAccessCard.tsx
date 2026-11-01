'use client';

/**
 * Account Settings → Agent access: personal access tokens for the Keystone
 * MCP server, so AI agents (Claude, etc.) can build and edit sites.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react';

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function AgentAccessCard() {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [name, setName] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  const load = useCallback(async () => {
    const res = await fetch('/api/user/api-tokens', { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setTokens(body.tokens || []);
    else setError(body.error || 'Could not load tokens');
  }, []);

  useEffect(() => { void load(); }, [load]);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const active = (tokens || []).filter((t) => !t.revoked_at);
  const claudeCommand = created
    ? `claude mcp add --transport http keystone ${endpoint} --header "Authorization: Bearer ${created}"`
    : '';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <Bot className="h-5 w-5 text-red-500" />
          Agent access
        </h2>
        <p className="text-sm text-slate-500">
          Let an AI agent build and edit your sites through the Keystone MCP server. Agents work on drafts and can&apos;t overwrite text you&apos;ve edited.
        </p>
      </div>

      <div className="space-y-5 bg-slate-50/50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">MCP server URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-slate-100 px-2 py-1 text-sm">{endpoint}</code>
            <button onClick={() => copy(endpoint, 'endpoint')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Copy URL">
              {copied === 'endpoint' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {created && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-900">Copy your token now — it won&apos;t be shown again.</p>
            <div className="mb-3 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">{created}</code>
              <button onClick={() => copy(created, 'token')} className="rounded-md p-1.5 text-amber-800 hover:bg-amber-100" aria-label="Copy token">
                {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mb-1 text-xs font-medium text-amber-900">Add it to Claude Code:</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">{claudeCommand}</code>
              <button onClick={() => copy(claudeCommand, 'cmd')} className="rounded-md p-1.5 text-amber-800 hover:bg-amber-100" aria-label="Copy command">
                {copied === 'cmd' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-slate-700">
            Token name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Code on my laptop" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} /> Can publish
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const res = await fetch('/api/user/api-tokens', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, scopes: ['sites:read', 'sites:write', ...(canPublish ? ['sites:publish'] : [])] }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Could not create token');
                setCreated(body.token);
                setName('');
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Create token
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {tokens === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-500">No active tokens.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {active.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.token_prefix}… · {t.scopes.includes('sites:publish') ? 'can publish' : 'drafts only'} · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleDateString()}` : 'never used'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Revoke “${t.name}”? Agents using it will stop working.`)) return;
                    await fetch('/api/user/api-tokens', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
                    await load();
                  }}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Revoke ${t.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

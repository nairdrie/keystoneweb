'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Copy, Mail } from 'lucide-react';
import { REGISTRARS } from '@/lib/domains/registrar-guides';

interface CheckResult {
  verified: boolean;
  checks: { a: boolean; cname: boolean; txt: boolean };
  expected: { a: string; cname: string; txt: string };
  found: { a: string[]; cname: string[]; txt: string[] };
  instructions: { type: 'A' | 'CNAME' | 'TXT'; name: string; value: string; description: string }[];
}

interface Props {
  launchRequestId: string;
  domainName: string;
  registrar: string;
  externalVerified: boolean;
  onRegistrarChange: (id: string) => void;
  onVerifiedChange: (verified: boolean) => void;
  disabled?: boolean;
}

export default function ExternalDnsPanel({
  launchRequestId,
  domainName,
  registrar,
  externalVerified,
  onRegistrarChange,
  onVerifiedChange,
  disabled,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domainOk = domainName && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName);

  async function runCheck() {
    if (!domainOk) {
      setError('Enter a valid domain name first.');
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(`/api/ops/launch/${launchRequestId}/check-dns`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'DNS check failed');
      setResult(data);
      onVerifiedChange(data.verified);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DNS check failed');
    } finally {
      setChecking(false);
    }
  }

  async function emailClient() {
    if (!domainOk) {
      setError('Save the launch config with a valid domain first.');
      return;
    }
    setError(null);
    setEmailing(true);
    try {
      const res = await fetch(`/api/ops/launch/${launchRequestId}/email-dns-setup`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email failed');
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Email failed');
    } finally {
      setEmailing(false);
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-800 bg-gray-950/40 p-3">
      {/* Registrar picker */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Where is the domain registered?
        </label>
        <select
          value={registrar}
          onChange={(e) => onRegistrarChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          {REGISTRARS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-gray-500">
          We&apos;ll tailor the setup email with step-by-step instructions for this provider.
        </p>
      </div>

      {/* DNS records preview (visible after a check or on render) */}
      {result && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">DNS records to add</p>
          <div className="space-y-1.5">
            {result.instructions.map((rec, i) => {
              const checkKey =
                rec.type === 'A' ? 'a' : rec.type === 'CNAME' ? 'cname' : 'txt';
              const ok = result.checks[checkKey];
              return (
                <div
                  key={i}
                  className={`rounded border px-2.5 py-2 text-[11px] ${
                    ok ? 'border-emerald-900 bg-emerald-950/30' : 'border-gray-700 bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-200">
                      {ok ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-gray-500" />
                      )}
                      {rec.type}
                    </span>
                    <button
                      onClick={() => copy(rec.value)}
                      className="text-gray-500 hover:text-gray-300"
                      title="Copy value"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-[60px_1fr] gap-x-2 gap-y-0.5">
                    <span className="text-gray-500">Name</span>
                    <code className="text-gray-300 break-all">{rec.name}</code>
                    <span className="text-gray-500">Value</span>
                    <code className="text-gray-300 break-all">{rec.value}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Verification status banner */}
      {result && (
        <div
          className={`rounded border px-3 py-2 text-xs ${
            result.verified
              ? 'border-emerald-900 bg-emerald-950/40 text-emerald-200'
              : 'border-amber-900 bg-amber-950/40 text-amber-200'
          }`}
        >
          {result.verified ? (
            <span>✓ DNS resolves correctly. Safe to launch.</span>
          ) : (
            <span>
              DNS not fully set up yet. Need {!result.checks.txt && 'TXT '}
              {!result.checks.a && !result.checks.cname && '+ either A or CNAME '}
              to resolve. Records can take a few minutes (up to 48 hours) to propagate.
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="rounded border border-red-900 bg-red-950 px-2 py-1.5 text-[11px] text-red-300">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={runCheck}
          disabled={disabled || checking}
          className="flex items-center justify-center gap-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-2 text-xs font-medium text-white"
        >
          {checking ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Checking…
            </>
          ) : (
            <>Run DNS check</>
          )}
        </button>
        <button
          onClick={emailClient}
          disabled={disabled || emailing || !domainOk}
          className="flex items-center justify-center gap-1.5 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-3 py-2 text-xs font-medium text-white"
        >
          {emailing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Sending…
            </>
          ) : emailSent ? (
            <>✓ Sent</>
          ) : (
            <>
              <Mail className="w-3 h-3" /> Email setup to client
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-gray-500">
        {externalVerified ? (
          <span className="text-emerald-400">✓ DNS verified. </span>
        ) : (
          <span className="text-amber-400">DNS not yet verified. </span>
        )}
        Launch is blocked until DNS resolves.
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

export type DomainMode = 'subdomain' | 'purchase' | 'external' | 'owned';

export interface LaunchConfig {
  planTier?: 'basic' | 'pro';
  billingInterval?: 'monthly' | 'yearly';
  domain?: {
    mode?: DomainMode;
    subdomain?: string;
    domainName?: string;
    vercelPriceUsd?: number;
    billToClient?: boolean;
    ownedPurchaseId?: string;
    externalVerified?: boolean;
  };
  launchServicePriceCents?: number;
  billDomainCents?: number;
  skipPreview?: boolean;
}

interface Props {
  launchRequestId: string;
  initial: LaunchConfig | null;
  initialPriceCents: number;
  onSaved: (config: LaunchConfig, priceCents: number) => void;
  disabled?: boolean;
}

interface OwnedDomain {
  id: string;
  domain_name: string;
  site_id: string | null;
  status: string;
}

function deriveTier(mode: DomainMode | undefined): 'basic' | 'pro' {
  return mode === 'subdomain' ? 'basic' : 'pro';
}

function calculateClientDomainPrice(vercelPriceUsd: number): number {
  // (price × 1.1) rounded up to next dollar, minus 0.01
  // Mirrors lib/domains/pricing.ts calculateDomainPrice exactly.
  const marked = vercelPriceUsd * 1.1;
  const rounded = Math.ceil(marked);
  return Math.max(0, rounded - 0.01);
}

export default function LaunchConfigCard({
  launchRequestId,
  initial,
  initialPriceCents,
  onSaved,
  disabled,
}: Props) {
  const [mode, setMode] = useState<DomainMode>(initial?.domain?.mode ?? 'subdomain');
  const [subdomain, setSubdomain] = useState(initial?.domain?.subdomain ?? '');
  const [domainName, setDomainName] = useState(initial?.domain?.domainName ?? '');
  const [vercelPriceUsd, setVercelPriceUsd] = useState<string>(
    initial?.domain?.vercelPriceUsd != null ? String(initial.domain.vercelPriceUsd) : '',
  );
  const [billToClient, setBillToClient] = useState(initial?.domain?.billToClient ?? true);
  const [externalVerified, setExternalVerified] = useState(initial?.domain?.externalVerified ?? false);
  const [ownedPurchaseId, setOwnedPurchaseId] = useState(initial?.domain?.ownedPurchaseId ?? '');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>(
    initial?.billingInterval ?? 'yearly',
  );
  const [launchPrice, setLaunchPrice] = useState<string>(
    ((initialPriceCents ?? 39900) / 100).toFixed(2),
  );
  const [skipPreview, setSkipPreview] = useState(initial?.skipPreview ?? false);
  const [ownedDomains, setOwnedDomains] = useState<OwnedDomain[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);

  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planTier = deriveTier(mode);

  // Load owned domains when picking "owned"
  useEffect(() => {
    if (mode !== 'owned' || ownedDomains.length > 0) return;
    setOwnedLoading(true);
    fetch('/api/domains/owned')
      .then((r) => r.json())
      .then((data) => setOwnedDomains(data.domains ?? data ?? []))
      .catch(() => setOwnedDomains([]))
      .finally(() => setOwnedLoading(false));
  }, [mode, ownedDomains.length]);

  // Subdomain availability check (debounced)
  useEffect(() => {
    if (mode !== 'subdomain') return;
    if (!subdomain.trim()) {
      setSubdomainStatus('idle');
      return;
    }
    const slug = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSubdomainStatus('invalid');
      return;
    }
    setSubdomainStatus('checking');
    const id = setTimeout(() => {
      fetch(`/api/domains/check-availability?subdomain=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((data) => {
          setSubdomainStatus(data.available ? 'available' : 'taken');
        })
        .catch(() => setSubdomainStatus('idle'));
    }, 400);
    return () => clearTimeout(id);
  }, [mode, subdomain]);

  function buildConfig(): LaunchConfig {
    const config: LaunchConfig = {
      planTier,
      billingInterval,
      skipPreview,
      launchServicePriceCents: Math.round(parseFloat(launchPrice || '0') * 100),
      domain: { mode },
    };
    if (mode === 'subdomain') {
      config.domain!.subdomain = subdomain.trim().toLowerCase();
    } else if (mode === 'purchase') {
      const vp = parseFloat(vercelPriceUsd || '0');
      config.domain!.domainName = domainName.trim().toLowerCase();
      config.domain!.vercelPriceUsd = isFinite(vp) ? vp : undefined;
      config.domain!.billToClient = billToClient;
      if (billToClient && isFinite(vp)) {
        config.billDomainCents = Math.round(calculateClientDomainPrice(vp) * 100);
      }
    } else if (mode === 'external') {
      config.domain!.domainName = domainName.trim().toLowerCase();
      config.domain!.externalVerified = externalVerified;
    } else if (mode === 'owned') {
      const picked = ownedDomains.find((d) => d.id === ownedPurchaseId);
      config.domain!.ownedPurchaseId = ownedPurchaseId;
      if (picked) config.domain!.domainName = picked.domain_name;
    }
    return config;
  }

  function validate(): string | null {
    if (mode === 'subdomain') {
      if (!subdomain.trim()) return 'Subdomain is required';
      if (!/^[a-z0-9-]+$/.test(subdomain.trim().toLowerCase()))
        return 'Subdomain may only contain lowercase letters, numbers, and dashes';
      if (subdomainStatus === 'taken') return 'Subdomain is already taken';
    } else if (mode === 'purchase') {
      if (!domainName.trim()) return 'Domain name is required';
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName.trim()))
        return 'Domain name does not look valid (e.g. myclient.ca)';
      const vp = parseFloat(vercelPriceUsd || '0');
      if (!isFinite(vp) || vp <= 0)
        return 'Enter the Vercel registration price (USD) so we know what to quote the client';
    } else if (mode === 'external') {
      if (!domainName.trim()) return 'Domain name is required';
      if (!externalVerified) return 'Confirm DNS is verified before queueing this domain';
    } else if (mode === 'owned') {
      if (!ownedPurchaseId) return 'Select one of your owned domains';
    }
    const price = parseFloat(launchPrice || '0');
    if (!isFinite(price) || price < 0) return 'Launch service price is invalid';
    return null;
  }

  async function save() {
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    const config = buildConfig();
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/launch/${launchRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          launch_config: config,
          launch_service_price_cents: config.launchServicePriceCents,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Save failed');
      }
      setSaved(true);
      onSaved(config, config.launchServicePriceCents ?? initialPriceCents);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const clientDomainCharge =
    mode === 'purchase' && billToClient && vercelPriceUsd
      ? calculateClientDomainPrice(parseFloat(vercelPriceUsd) || 0)
      : null;

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Launch Configuration
        </h2>
        <span
          className={`text-[11px] px-2 py-0.5 rounded ${planTier === 'pro' ? 'bg-violet-900/40 text-violet-300' : 'bg-gray-800 text-gray-300'}`}
        >
          Client will be on <strong>{planTier === 'pro' ? 'Pro' : 'Basic'}</strong>
        </span>
      </div>

      {/* Domain mode */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Domain</label>
        <div className="grid grid-cols-2 gap-2">
          {(['subdomain', 'purchase', 'external', 'owned'] as DomainMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={disabled}
              className={`text-left rounded border px-3 py-2 text-xs transition-colors ${
                mode === m
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                  : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="font-medium">
                {m === 'subdomain' && 'Subdomain (.kswd.ca)'}
                {m === 'purchase' && 'Purchase new domain'}
                {m === 'external' && 'External (DNS already set)'}
                {m === 'owned' && 'Attach owned domain'}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {m === 'subdomain' && 'Free. Client on Basic plan.'}
                {m === 'purchase' && 'Pro plan. Domain purchased on payment.'}
                {m === 'external' && 'Pro plan. DNS managed externally.'}
                {m === 'owned' && 'Pro plan. Pick from your owned domains.'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific fields */}
      {mode === 'subdomain' && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Subdomain</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              placeholder="myclient"
              disabled={disabled}
              className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <span className="text-sm text-gray-500">.kswd.ca</span>
          </div>
          {subdomainStatus !== 'idle' && (
            <p
              className={`mt-1 text-[11px] ${
                subdomainStatus === 'available'
                  ? 'text-emerald-400'
                  : subdomainStatus === 'taken' || subdomainStatus === 'invalid'
                    ? 'text-red-400'
                    : 'text-gray-500'
              }`}
            >
              {subdomainStatus === 'checking' && 'Checking availability…'}
              {subdomainStatus === 'available' && '✓ Available'}
              {subdomainStatus === 'taken' && '✗ Already taken'}
              {subdomainStatus === 'invalid' && 'Only lowercase letters, numbers, and dashes are allowed'}
            </p>
          )}
        </div>
      )}

      {mode === 'purchase' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Domain name</label>
            <input
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value.toLowerCase())}
              placeholder="myclient.ca"
              disabled={disabled}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Vercel registration price (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={vercelPriceUsd}
              onChange={(e) => setVercelPriceUsd(e.target.value)}
              placeholder="12.00"
              disabled={disabled}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Look this up in Vercel before configuring. Domain is not purchased until the client pays.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={billToClient}
              onChange={(e) => setBillToClient(e.target.checked)}
              disabled={disabled}
              className="rounded"
            />
            <span>
              Bill domain to client
              {billToClient ? '' : ' (included with Pro — free domain credit)'}
            </span>
          </label>
          {clientDomainCharge !== null && (
            <p className="text-[11px] text-gray-500">
              Client will see <span className="text-emerald-300">${clientDomainCharge.toFixed(2)}</span> as a one-time domain line item.
            </p>
          )}
        </div>
      )}

      {mode === 'external' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Domain name</label>
            <input
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value.toLowerCase())}
              placeholder="myclient.com"
              disabled={disabled}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={externalVerified}
              onChange={(e) => setExternalVerified(e.target.checked)}
              disabled={disabled}
              className="mt-0.5 rounded"
            />
            <span>
              DNS records confirmed pointing to Keystone (CNAME / A). The client&apos;s site will go live on this
              domain when they pay.
            </span>
          </label>
        </div>
      )}

      {mode === 'owned' && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Owned domain</label>
          <select
            value={ownedPurchaseId}
            onChange={(e) => setOwnedPurchaseId(e.target.value)}
            disabled={disabled || ownedLoading}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            <option value="">{ownedLoading ? 'Loading…' : '— select —'}</option>
            {ownedDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.domain_name}
                {d.site_id ? ` · in use` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Billing + launch price */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Billing interval</label>
          <div className="grid grid-cols-2 gap-1">
            {(['monthly', 'yearly'] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setBillingInterval(iv)}
                disabled={disabled}
                className={`rounded border px-2 py-1.5 text-xs ${
                  billingInterval === iv
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                    : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                }`}
              >
                {iv === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Launch service ($USD)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={launchPrice}
            onChange={(e) => setLaunchPrice(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-300 pt-2 border-t border-gray-800">
        <input
          type="checkbox"
          checked={skipPreview}
          onChange={(e) => setSkipPreview(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded"
        />
        <span>
          <strong>Client has already previewed the site</strong> (e.g. on a screen-share). Skips the preview step in
          their onboarding and takes them straight from password → payment.
        </span>
      </label>

      {error && (
        <p className="text-xs text-red-300 bg-red-950 border border-red-900 rounded px-3 py-2">{error}</p>
      )}

      <button
        onClick={save}
        disabled={disabled || saving}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save configuration'}
      </button>
    </section>
  );
}

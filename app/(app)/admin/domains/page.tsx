'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Loader2,
  Link2,
  Shield,
} from 'lucide-react';
import { useAdminContext } from '../admin-context';
import { DomainManager } from '../../publish/domain-select/page';

interface DomainStatus {
  publishedDomain: string | null;
  customDomain: string | null;
  pendingCustomDomain: string | null;
  dnsChecks: { cname: boolean; txt: boolean } | null;
  transferStatus: string | null;
  transferDomain: string | null;
  ownedDomains: Array<{
    id: string;
    domain: string;
    status: string;
    purchase_type: string;
    transfer_status: string | null;
    expires_at: string | null;
    auto_renew: boolean;
    is_free_with_pro: boolean;
  }>;
}

export default function DomainsPage() {
  const { siteId, site, isProUser } = useAdminContext();

  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [checkingTransfer, setCheckingTransfer] = useState(false);
  const [dnsResult, setDnsResult] = useState<{ verified: boolean; checks: { cname: boolean; txt: boolean }; message: string } | null>(null);
  const [transferResult, setTransferResult] = useState<{ status: string; message: string } | null>(null);

  useEffect(() => {
    if (!siteId) return;
    fetchDomainStatus();
  }, [siteId]);

  async function fetchDomainStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/domains?siteId=${siteId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDomainStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch domain status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyDns() {
    if (!siteId) return;
    setVerifying(true);
    setDnsResult(null);
    try {
      const res = await fetch('/api/domains/verify-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDnsResult(data);
        if (data.verified) {
          await fetchDomainStatus();
        }
      }
    } catch (err) {
      console.error('DNS verification failed:', err);
    } finally {
      setVerifying(false);
    }
  }

  async function handleCheckTransfer() {
    if (!siteId) return;
    setCheckingTransfer(true);
    setTransferResult(null);
    try {
      const res = await fetch('/api/domains/check-transfer-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTransferResult(data);
        if (data.status === 'completed') {
          await fetchDomainStatus();
        }
      }
    } catch (err) {
      console.error('Transfer check failed:', err);
    } finally {
      setCheckingTransfer(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const subdomainUrl = domainStatus?.publishedDomain
    ? `${domainStatus.publishedDomain}.kswd.ca`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Domain Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage how visitors reach your site.</p>
      </div>

      {/* Current Active Domain */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Active Domain</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          {subdomainUrl && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-mono text-sm font-semibold text-slate-900">{subdomainUrl}</span>
                  <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">Subdomain</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-green-700">Active</span>
              </div>
            </div>
          )}

          {domainStatus?.customDomain && (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-green-600" />
                <div>
                  <span className="font-mono text-sm font-semibold text-slate-900">{domainStatus.customDomain}</span>
                  <span className="ml-2 text-[10px] font-bold text-green-600 uppercase">Custom Domain</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-green-700">Verified</span>
              </div>
            </div>
          )}

          {!domainStatus?.customDomain && !domainStatus?.pendingCustomDomain && !subdomainUrl && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">Your site hasn&apos;t been published yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Domain Section */}
      {domainStatus?.pendingCustomDomain && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900">Pending Domain</h3>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-amber-500" />
              <span className="font-mono text-sm font-semibold text-slate-900">{domainStatus.pendingCustomDomain}</span>
            </div>

            {domainStatus.transferStatus && domainStatus.transferStatus !== 'completed' ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Domain transfer in progress.</strong> This typically takes 5-7 days.
                    Check your email for approval requests from your current registrar.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Transfer status:</span>
                  <span className="font-semibold text-amber-700 capitalize">{domainStatus.transferStatus.replace('_', ' ')}</span>
                </div>
                {transferResult && (
                  <div className={`p-2 rounded-lg text-xs ${transferResult.status === 'completed' ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
                    {transferResult.message}
                  </div>
                )}
                <button
                  onClick={handleCheckTransfer}
                  disabled={checkingTransfer}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {checkingTransfer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Check Transfer Status
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>DNS verification pending.</strong> Configure the required DNS records at your registrar,
                    then click verify below. Changes can take up to 48 hours to propagate.
                  </p>
                </div>

                {(dnsResult || domainStatus.dnsChecks) && (
                  <div className="space-y-1.5">
                    {(() => {
                      const checks = dnsResult?.checks || domainStatus.dnsChecks;
                      if (!checks) return null;
                      return (
                        <>
                          <div className="flex items-center gap-2 text-xs">
                            {checks.cname ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                            <span className={checks.cname ? 'text-green-700' : 'text-slate-500'}>
                              CNAME record {checks.cname ? 'verified' : 'not detected yet'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {checks.txt ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                            <span className={checks.txt ? 'text-green-700' : 'text-slate-500'}>
                              TXT verification {checks.txt ? 'verified' : 'not detected yet'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {dnsResult && (
                  <div className={`p-2 rounded-lg text-xs ${dnsResult.verified ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
                    {dnsResult.message}
                  </div>
                )}

                <button
                  onClick={handleVerifyDns}
                  disabled={verifying}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Verify DNS Records
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owned Domains for this site */}
      {domainStatus?.ownedDomains && domainStatus.ownedDomains.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Domain Registrations</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {domainStatus.ownedDomains.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Link2 className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="font-mono text-sm font-semibold text-slate-900">{d.domain}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 capitalize">
                        {d.purchase_type === 'transfer' ? 'Transferred' : 'Registered'}
                      </span>
                      {d.is_free_with_pro && (
                        <span className="text-[10px] font-semibold text-green-600">Included with Pro</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {d.transfer_status && d.transfer_status !== 'completed' ? (
                    <span className="text-xs font-semibold text-amber-600 capitalize">
                      Transfer {d.transfer_status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-green-600">Active</span>
                  )}
                  {d.expires_at && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {d.auto_renew ? 'Renews' : 'Expires'} {new Date(d.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Inline Domain Manager ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Set Up a Domain</h3>
          <p className="text-xs text-slate-500 mt-1">Purchase, transfer, or connect a domain via DNS.</p>
        </div>
        <div className="px-5 py-4">
          <DomainManager
            siteId={siteId}
            currentDomain={domainStatus?.publishedDomain}
            embedded
            onSuccess={() => fetchDomainStatus()}
          />
        </div>
      </div>
    </div>
  );
}

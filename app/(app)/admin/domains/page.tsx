'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAdminContext } from '../admin-context';
import { DomainManager } from '../../publish/domain-select/page';

interface DomainStatusData {
  publishedDomain: string | null;
  customDomain: string | null;
  pendingCustomDomain: string | null;
  transferStatus: string | null;
}

export default function DomainsPage() {
  const { siteId } = useAdminContext();

  const [domainStatus, setDomainStatus] = useState<DomainStatusData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-black text-slate-900">Domain Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage how visitors reach your site.</p>
      </div>

      <DomainManager
        siteId={siteId}
        currentDomain={domainStatus?.publishedDomain}
        customDomain={domainStatus?.customDomain}
        pendingCustomDomain={domainStatus?.pendingCustomDomain}
        transferStatus={domainStatus?.transferStatus}
        embedded
        onSuccess={() => fetchDomainStatus()}
      />
    </div>
  );
}

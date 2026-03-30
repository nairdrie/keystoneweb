'use client';

import { useAdminContext } from '../admin-context';
import { DomainManager } from '../../publish/domain-select/page';

export default function DomainsPage() {
  const { siteId } = useAdminContext();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-black text-slate-900">Domain Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage how visitors reach your site.</p>
      </div>

      <DomainManager
        siteId={siteId}
        embedded
      />
    </div>
  );
}

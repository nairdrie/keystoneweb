'use client';

import { useState } from 'react';
import { useAdminContext } from '../admin-context';
import SEOPanel from '@/app/components/SEOPanel';
import SeoPagesPanel from '@/app/components/seo/SeoPagesPanel';
import SeoRedirectsPanel from '@/app/components/seo/SeoRedirectsPanel';
import SeoOverviewPanel from '@/app/components/seo/SeoOverviewPanel';
import SeoSchemaPanel from '@/app/components/seo/SeoSchemaPanel';
import SeoAuditPanel from '@/app/components/seo/SeoAuditPanel';
import { LayoutDashboard, Globe, FileText, Code2, ArrowRightLeft, ListChecks } from 'lucide-react';

type TabId = 'overview' | 'site' | 'pages' | 'schema' | 'redirects' | 'audit';

export default function AdminSEOPage() {
  const { siteId } = useAdminContext();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'site', label: 'Site', icon: Globe },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'schema', label: 'Schema', icon: Code2 },
    { id: 'redirects', label: 'Redirects', icon: ArrowRightLeft },
    { id: 'audit', label: 'Audit', icon: ListChecks },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">SEO</h2>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {activeTab === 'overview' && <SeoOverviewPanel siteId={siteId ?? undefined} onJump={setActiveTab} />}
        {activeTab === 'site' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <SEOPanel siteId={siteId ?? undefined} />
          </div>
        )}
        {activeTab === 'pages' && <SeoPagesPanel siteId={siteId ?? undefined} />}
        {activeTab === 'schema' && <SeoSchemaPanel siteId={siteId ?? undefined} />}
        {activeTab === 'redirects' && <SeoRedirectsPanel siteId={siteId ?? undefined} />}
        {activeTab === 'audit' && <SeoAuditPanel siteId={siteId ?? undefined} />}
      </div>
    </div>
  );
}


'use client';

import { useAdminContext } from '../admin-context';
import SEOPanel from '@/app/components/SEOPanel';

export default function AdminSEOPage() {
  const { siteId } = useAdminContext();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-base font-bold text-slate-900 mb-4">SEO &amp; Business Profile</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <SEOPanel siteId={siteId ?? undefined} />
      </div>
    </div>
  );
}

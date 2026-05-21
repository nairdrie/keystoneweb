'use client';

import { useAdminContext } from '../admin-context';
import DoctorPanel from '@/app/components/DoctorPanel';

export default function AdminHealthPage() {
  const { siteId } = useAdminContext();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Site Health Check</h2>
        <p className="text-sm text-slate-500 mt-1">
          Scan your site for missing configurations, broken links, accessibility issues, and pre-launch readiness.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <DoctorPanel siteId={siteId ?? undefined} />
      </div>
    </div>
  );
}

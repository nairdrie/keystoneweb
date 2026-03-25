'use client';

import { useAdminContext } from '../admin-context';
import StoreSettingsPanel from '@/app/components/ecommerce/StoreSettingsPanel';
import { ProductManager } from '@/app/components/blocks/ProductGridBlock';

export default function AdminEcommercePage() {
  const { siteId, palette } = useAdminContext();

  if (!siteId) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">Ecommerce</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Store Settings</h3>
        </div>
        <StoreSettingsPanel siteId={siteId} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Products</h3>
        </div>
        <div className="p-4">
          <ProductManager siteId={siteId} palette={palette} />
        </div>
      </div>
    </div>
  );
}

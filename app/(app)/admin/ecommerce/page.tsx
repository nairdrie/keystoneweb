'use client';

import { useAdminContext } from '../admin-context';
import StoreSettingsPanel from '@/app/components/ecommerce/StoreSettingsPanel';
import { ProductManager } from '@/app/components/blocks/ProductGridBlock';
import { ShoppingBag } from 'lucide-react';

export default function AdminEcommercePage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();

  if (!siteId) return null;

  if (!siteBlockTypes.has('productGrid')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <ShoppingBag className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Product Catalog block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add a <strong>Product Catalog</strong> block to your site to start selling products and managing your store.
        </p>
        <a
          href={`/design?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
        >
          Open Designer
        </a>
      </div>
    );
  }

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

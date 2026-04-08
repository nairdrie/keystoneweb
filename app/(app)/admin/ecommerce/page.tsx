'use client';

import { useState, useEffect } from 'react';
import { useAdminContext } from '../admin-context';
import StoreSettingsPanel from '@/app/components/ecommerce/StoreSettingsPanel';
import ShippingPanel from '@/app/components/ecommerce/ShippingPanel';
import { ProductManager } from '@/app/components/blocks/ProductGridBlock';
import { ShoppingBag } from 'lucide-react';

export default function AdminEcommercePage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();
  const [shippingRequired, setShippingRequired] = useState(true);

  // Fetch initial shipping_required value
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/products/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        if (data.settings?.shipping_required !== undefined) {
          setShippingRequired(data.settings.shipping_required);
        }
      })
      .catch(() => {});
  }, [siteId]);

  const handleShippingRequiredChange = async (val: boolean) => {
    setShippingRequired(val);
    try {
      await fetch('/api/products/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, shipping_required: val }),
      });
    } catch (err) {
      console.error('Failed to update shipping_required:', err);
      setShippingRequired(!val); // revert on error
    }
  };

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
      <ShippingPanel
        siteId={siteId}
        shippingRequired={shippingRequired}
        onShippingRequiredChange={handleShippingRequiredChange}
      />
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

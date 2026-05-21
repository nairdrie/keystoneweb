'use client';

import { useState, useEffect } from 'react';
import { useAdminContext } from '../admin-context';
import StoreSettingsPanel from '@/app/components/ecommerce/StoreSettingsPanel';
import ShippingPanel from '@/app/components/ecommerce/ShippingPanel';
import OrdersPanel from '@/app/components/ecommerce/OrdersPanel';
import LowStockPanel from '@/app/components/ecommerce/LowStockPanel';
import SalesAnalyticsPanel from '@/app/components/ecommerce/SalesAnalyticsPanel';
import AutomatedEmailsPanel from '@/app/components/ecommerce/AutomatedEmailsPanel';
import AICommercePanel from '@/app/components/ecommerce/AICommercePanel';
import { ProductManager } from '@/app/components/blocks/ProductGridBlock';
import { ShoppingBag, Package, ClipboardList, CreditCard, Truck, BarChart3, Mail, Sparkles } from 'lucide-react';

type TabId = 'analytics' | 'products' | 'orders' | 'payments' | 'shipping' | 'emails' | 'ai-commerce';

export default function AdminEcommercePage() {
  const { siteId, palette, siteBlockTypes } = useAdminContext();
  const [activeTab, setActiveTab] = useState<TabId>('products');
  const [shippingRequired, setShippingRequired] = useState(true);
  const [siteLogoUrl, setSiteLogoUrl] = useState<string | undefined>(undefined);
  const [storefrontUrl, setStorefrontUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/sites?id=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const designData = data?.designData || {};
        const logo = designData.headerLogo || designData.siteLogo;
        if (logo) setSiteLogoUrl(logo);
        const domain = data?.customDomain || data?.custom_domain;
        if (domain) setStorefrontUrl(`https://${String(domain).replace(/^www\./, '')}`);
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
      setShippingRequired(!val);
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

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'shipping', label: 'Shipping', icon: Truck },
    { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'ai-commerce', label: 'AI Commerce', icon: Sparkles },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900">Ecommerce</h2>

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

      <div className="max-w-3xl mx-auto">
        {activeTab === 'analytics' && (
          <SalesAnalyticsPanel siteId={siteId} />
        )}
        {activeTab === 'products' && (
          <>
            <LowStockPanel siteId={siteId} />
            <ProductManager siteId={siteId} palette={palette} />
          </>
        )}
        {activeTab === 'orders' && (
          <OrdersPanel siteId={siteId} />
        )}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Payment Settings</h3>
            </div>
            <StoreSettingsPanel siteId={siteId} />
          </div>
        )}
        {activeTab === 'shipping' && (
          <ShippingPanel
            siteId={siteId}
            shippingRequired={shippingRequired}
            onShippingRequiredChange={handleShippingRequiredChange}
          />
        )}
        {activeTab === 'emails' && (
          <AutomatedEmailsPanel siteId={siteId} logoUrl={siteLogoUrl} />
        )}
        {activeTab === 'ai-commerce' && (
          <AICommercePanel siteId={siteId} storefrontUrl={storefrontUrl} />
        )}
      </div>
    </div>
  );
}

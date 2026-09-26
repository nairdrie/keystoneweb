'use client';

import { Wrench } from 'lucide-react';
import { useAdminContext } from '../admin-context';
import { ToastProvider } from '@/app/components/shop/ui';
import { ShopProvider } from '@/app/components/shop/ShopContext';
import ShopNav from '@/app/components/shop/ShopNav';
import '@/app/components/shop/shop.css';

// The Shop tab: service desk, board, invoices and books for an auto repair shop.
// Feature-flagged per site (sites.shop_enabled), like Marketing.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { siteId, site } = useAdminContext();

  if (!site || !siteId) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-slate-400">Loading…</div>;
  }
  if (!site.shopEnabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">The Shop tab isn&apos;t enabled yet</h2>
        <p className="text-sm text-slate-500 mt-2">
          Contact Keystone Web Design support to turn on the service desk, estimates, invoices and lien tracking for your shop.
        </p>
      </div>
    );
  }
  return (
    <div className="shop-ui">
      <ToastProvider>
        <ShopProvider siteId={siteId}>
          <ShopNav />
          <div className="view gutter">{children}</div>
        </ShopProvider>
      </ToastProvider>
    </div>
  );
}

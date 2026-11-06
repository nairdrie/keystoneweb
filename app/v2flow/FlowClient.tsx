'use client';

/**
 * Keystone's transactional flows, reused as-is inside an agent-built site:
 * cart & checkout, product pages, booking and order confirmation.
 */
import { Suspense, useEffect } from 'react';
import { CartProvider, useCart } from '@/app/components/ecommerce/CartProvider';
import CartDrawer from '@/app/components/ecommerce/CartDrawer';
import ProductPageWrapper from '@/app/components/ecommerce/ProductPageWrapper';
import OrderConfirmation from '@/app/components/checkout/OrderConfirmation';
import { MemberProvider } from '@/app/components/membership/MemberProvider';
import { BookingFlow } from '@/app/components/blocks/BookingBlock';

type Palette = Record<string, string>;

export type FlowKind = 'cart' | 'product' | 'book' | 'order-confirmation';

interface FlowClientProps {
  kind: FlowKind;
  siteId: string;
  siteName: string;
  palette: Palette;
  serviceId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allProducts?: any[];
}

function CartPage({ siteId, palette }: { siteId: string; palette: Palette }) {
  const cart = useCart();
  useEffect(() => {
    cart?.setCartOpen(true);
    // Open once on arrival; the shopper can close it and keep browsing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="mb-3 text-3xl font-bold">Your cart</h1>
      <p className="mb-8 opacity-70">
        {cart && cart.itemCount > 0 ? `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'} in your cart.` : 'Your cart is empty.'}
      </p>
      <div className="flex justify-center gap-3">
        {cart && cart.itemCount > 0 && (
          <button onClick={() => cart.setCartOpen(true)} className="rounded-full px-6 py-3 font-semibold text-white" style={{ background: palette.primary }}>
            View cart &amp; check out
          </button>
        )}
        {/* The site's pages are agent-built HTML, not Next routes: a full navigation is intended. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="rounded-full border px-6 py-3 font-semibold">Continue shopping</a>
      </div>
      <CartDrawer siteId={siteId} palette={palette} />
    </div>
  );
}

export default function FlowClient({ kind, siteId, siteName, palette, serviceId, product, allProducts }: FlowClientProps) {
  return (
    <CartProvider siteId={siteId}>
      <MemberProvider siteId={siteId}>
        <main id="main" className="ks-flow" data-ks-flow={kind}>
          {kind === 'cart' && <CartPage siteId={siteId} palette={palette} />}
          {kind === 'product' && product && (
            <>
              <ProductPageWrapper
                product={product}
                siteId={siteId}
                palette={palette}
                siteName={siteName}
                allProducts={allProducts || []}
                navContent={{}}
                templateId="agent_v2"
                productsPagePath="/"
              />
              <CartDrawer siteId={siteId} palette={palette} />
            </>
          )}
          {kind === 'book' && (
            <div className="mx-auto max-w-3xl px-4 py-12">
              <BookingFlow siteId={siteId} palette={palette} initialServiceId={serviceId} />
            </div>
          )}
          {kind === 'order-confirmation' && (
            <Suspense fallback={null}>
              <OrderConfirmation />
            </Suspense>
          )}
        </main>
      </MemberProvider>
    </CartProvider>
  );
}

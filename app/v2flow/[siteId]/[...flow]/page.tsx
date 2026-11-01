/**
 * Keystone-hosted pages for agent-built (v2) sites, wearing the site's own
 * header, footer and design tokens:
 *   /cart, /book[?service=id], /product/<id>, /order-confirmation
 * Reached through the middleware rewrite for the site's own domain.
 */
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { parseHost } from '@/lib/env/domain';
import { loadRelease, loadSiteRow } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';
import { renderChrome } from '@/lib/v2/render';
import ProductJsonLd from '@/app/components/ProductJsonLd';
import FlowClient, { type FlowKind } from '../../FlowClient';

export const dynamic = 'force-dynamic';

type Params = { siteId: string; flow: string[] };

const TITLES: Record<FlowKind, string> = { cart: 'Cart', product: 'Product', book: 'Book an appointment', 'order-confirmation': 'Order confirmation' };

function flowKind(flow: string[]): FlowKind | null {
  const [first, second] = flow;
  if (first === 'cart' && !second) return 'cart';
  if (first === 'book' && !second) return 'book';
  if (first === 'order-confirmation' && !second) return 'order-confirmation';
  if (first === 'product' && second && flow.length === 2) return 'product';
  return null;
}

async function loadSite(siteId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return null;
  const db = createAdminClient();
  const site = await loadSiteRow(db, siteId);
  if (!site || site.deleted_at || !site.is_published || site.engine !== ENGINE_V2 || !site.v2_release_id) return null;
  const bundle = await loadRelease(db, site.v2_release_id);
  return bundle ? { db, site, bundle } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { siteId, flow } = await params;
  const kind = flowKind(flow);
  const loaded = kind ? await loadSite(siteId) : null;
  if (!kind || !loaded) return { title: 'Not found' };
  return { title: `${TITLES[kind]} | ${loaded.bundle.site.title}`, robots: kind === 'product' ? undefined : { index: false } };
}

export default async function V2FlowPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { siteId, flow } = await params;
  const query = await searchParams;
  const kind = flowKind(flow);
  if (!kind) notFound();
  const loaded = await loadSite(siteId);
  if (!loaded) notFound();
  const { db, site, bundle } = loaded;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let product: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allProducts: any[] = [];
  if (kind === 'product') {
    const { data } = await db.from('products').select('*').eq('id', flow[1]).eq('site_id', siteId).eq('is_active', true).eq('is_archived', false).maybeSingle();
    if (!data) notFound();
    product = data;
    const { data: others } = await db.from('products').select('*').eq('site_id', siteId).eq('is_active', true).eq('is_archived', false).order('sort_order');
    allProducts = others || [];
  }

  const chrome = renderChrome(bundle);
  // The site's own scripts only run on the site's own domain, never on the app host.
  const host = (await headers()).get('host') || '';
  const onSiteHost = ['published', 'custom'].includes(parseHost(host).kind);
  const siteUrl = site.custom_domain ? `https://${site.custom_domain}` : bundle.site.domain ? `https://${bundle.site.domain}` : '';

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: chrome.head }} />
      <script type="application/json" id="ks-config" dangerouslySetInnerHTML={{ __html: chrome.config.replace(/</g, '\\u003c') }} />
      {product && siteUrl && <ProductJsonLd product={product} productUrl={`${siteUrl}/product/${product.id}`} siteName={bundle.site.title} />}
      <div dangerouslySetInnerHTML={{ __html: chrome.header }} />
      <FlowClient
        kind={kind}
        siteId={siteId}
        siteName={bundle.site.title}
        palette={chrome.palette}
        serviceId={typeof query.service === 'string' ? query.service : undefined}
        product={product}
        allProducts={allProducts}
      />
      <div dangerouslySetInnerHTML={{ __html: chrome.footer }} />
      {onSiteHost && <div dangerouslySetInnerHTML={{ __html: chrome.modules }} />}
      <Script src="/ks/runtime.js?v=3" strategy="afterInteractive" />
    </>
  );
}

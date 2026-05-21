/**
 * UCP capability discovery manifest. A spec-compliant agent fetches this
 * first to learn:
 *   - which UCP primitives we implement
 *   - the URL of each endpoint
 *   - which payment surfaces we accept (Google Pay etc.)
 *   - our signature public-key id (so it can verify mandates we issue)
 *
 * Public, cacheable for ~60s — content rarely changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity } from '@/lib/ucp/agent-detect';
import { MANDATE_PUBLIC_KEY_ID } from '@/lib/ucp/mandate';
import type { UcpManifest } from '@/lib/ucp/types';

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const base = new URL(request.url);
  const apiBase = `${base.protocol}//${base.host}/api/ucp/${siteId}`;
  const storefront = ctx.storefrontUrl;

  const manifest: UcpManifest = {
    protocol: 'UCP',
    version: '0.1',
    merchantOfRecord: {
      name: ctx.businessName,
      siteId: ctx.siteId,
      legalEntity: ctx.legalEntity,
    },
    capabilities: {
      rest: true,
      mcp: true,
      a2a: true,
      ap2: true,
      nativeCommerce: true,
      realtimePrice: true,
      promotions: true,
      shippingQuotes: true,
      taxQuotes: true,
      googlePay: true,
    },
    endpoints: {
      products: `${apiBase}/products`,
      product: `${apiBase}/products/{productId}`,
      cart: `${apiBase}/cart`,
      quote: `${apiBase}/quote`,
      checkout: `${apiBase}/checkout`,
      mandate: `${apiBase}/mandate`,
      promotions: `${apiBase}/promotions`,
      mcp: `${base.protocol}//${base.host}/api/mcp/${siteId}`,
      a2a: `${storefront}/.well-known/agent.json`,
      feed: `${storefront}/feeds/native-commerce.json`,
    },
    supportedCurrencies: [ctx.currency, 'USD', 'CAD', 'EUR', 'GBP'].filter((v, i, a) => a.indexOf(v) === i),
    signature: {
      algorithm: 'HMAC-SHA256',
      publicKeyId: MANDATE_PUBLIC_KEY_ID,
    },
  };

  await logAgentActivity(request, { siteId, surface: 'ucp_rest', action: 'manifest', httpStatus: 200 });
  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60', 'X-UCP-Version': '0.1' },
  });
}

/**
 * Per-domain UCP discovery. Lets an agent that only knows the public URL
 * of a merchant ("https://acme.com") learn where the UCP/MCP/A2A endpoints
 * live without scraping any HTML.
 *
 * Convention: GET https://{merchant}/.well-known/ucp.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity } from '@/lib/ucp/agent-detect';
import { MANDATE_PUBLIC_KEY_ID } from '@/lib/ucp/mandate';

export async function GET(request: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const cleanDomain = domain.replace(/^www\./, '');
  const admin = createAdminClient();
  const { data: site } = await admin
    .from('sites')
    .select('id')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .maybeSingle();
  if (!site) return new NextResponse('Not found', { status: 404 });

  const ctx = await loadUcpSiteContext(site.id);
  if (!ctx) return new NextResponse('Not found', { status: 404 });

  const platformOrigin = process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;

  const manifest = {
    protocol: 'UCP',
    version: '0.1',
    merchantOfRecord: { name: ctx.businessName, siteId: ctx.siteId, legalEntity: ctx.legalEntity },
    capabilities: {
      rest: true, mcp: true, a2a: true, ap2: true,
      nativeCommerce: true, realtimePrice: true, promotions: true,
      shippingQuotes: true, taxQuotes: true, googlePay: true,
    },
    endpoints: {
      products: `${platformOrigin}/api/ucp/${site.id}/products`,
      product: `${platformOrigin}/api/ucp/${site.id}/products/{productId}`,
      cart: `${platformOrigin}/api/ucp/${site.id}/cart`,
      quote: `${platformOrigin}/api/ucp/${site.id}/quote`,
      checkout: `${platformOrigin}/api/ucp/${site.id}/checkout`,
      mandate: `${platformOrigin}/api/ucp/${site.id}/mandate`,
      promotions: `${platformOrigin}/api/ucp/${site.id}/promotions`,
      mcp: `${platformOrigin}/api/mcp/${site.id}`,
      a2a: `${ctx.storefrontUrl}/.well-known/agent.json`,
      feed: `${ctx.storefrontUrl}/feeds/native-commerce.json`,
    },
    supportedCurrencies: [ctx.currency, 'USD', 'CAD', 'EUR', 'GBP'].filter((v, i, a) => a.indexOf(v) === i),
    signature: { algorithm: 'HMAC-SHA256', publicKeyId: MANDATE_PUBLIC_KEY_ID },
  };

  await logAgentActivity(request, { siteId: site.id, surface: 'a2a', action: 'discovery_ucp', httpStatus: 200 });

  return NextResponse.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300', 'X-UCP-Version': '0.1' },
  });
}

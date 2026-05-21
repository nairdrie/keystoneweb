/**
 * Google Merchant Center XML feed with the `native_commerce` attribute set
 * per item. This is the form Merchant Center has historically ingested,
 * preserved for compatibility with existing GMC accounts; the JSON sibling
 * route is what UCP-native agents read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { mapProductToUcp } from '@/lib/ucp/product-mapper';
import { buildNativeCommerceXml } from '@/lib/ucp/feed';
import { logAgentActivity } from '@/lib/ucp/agent-detect';

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

  const { data } = await admin
    .from('products')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_archived', false)
    .eq('status', 'published')
    .eq('is_active', true)
    .eq('native_commerce', true)
    .limit(5000);

  const products = (data || []).map(p => mapProductToUcp(p as any, { siteUrl: ctx.storefrontUrl }));
  const xml = buildNativeCommerceXml(ctx.businessName, ctx.storefrontUrl, products);

  await logAgentActivity(request, { siteId: site.id, surface: 'feed', action: 'fetch_feed_xml', httpStatus: 200, requestMeta: { count: products.length } });

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

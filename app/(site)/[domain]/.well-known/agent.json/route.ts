/**
 * A2A "agent card" — the standard discovery doc an Agent-to-Agent caller
 * fetches to learn what skills our commerce agent exposes and how to
 * invoke them. Shape matches the A2A 0.1 spec; UCP-specific bits live
 * under `extensions.ucp`.
 *
 * See: github.com/google/A2A
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
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

  const platformOrigin = process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;

  const card = {
    name: `${ctx.businessName} Commerce Agent`,
    description: `Universal Commerce Protocol agent for ${ctx.businessName}. Returns real-time prices, inventory, AI attributes, and accepts AP2 mandates for checkout.`,
    url: `${ctx.storefrontUrl}/.well-known/agent.json`,
    provider: { organization: ctx.businessName, url: ctx.storefrontUrl },
    version: '0.1.0',
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [
      { id: 'search_products', name: 'Search Products', description: 'Find products by query, category, availability.', tags: ['commerce', 'catalog'] },
      { id: 'get_product', name: 'Get Product', description: 'Real-time price, inventory, and AI attributes for a single product.', tags: ['commerce', 'catalog'] },
      { id: 'compute_quote', name: 'Compute Quote', description: 'Tax, shipping, and total for a hypothetical cart.', tags: ['commerce', 'pricing'] },
      { id: 'create_cart', name: 'Create Cart', description: 'Open a UCP cart owned by the calling agent session.', tags: ['commerce', 'cart'] },
      { id: 'initiate_checkout', name: 'Initiate Checkout', description: 'Receive a signed AP2 cart mandate to finalize via /mandate.', tags: ['commerce', 'checkout', 'ap2'] },
    ],
    extensions: {
      ucp: {
        version: '0.1',
        manifest: `${ctx.storefrontUrl}/.well-known/ucp.json`,
        mcp: `${platformOrigin}/api/mcp/${site.id}`,
        feed: `${ctx.storefrontUrl}/feeds/native-commerce.json`,
        merchantOfRecord: ctx.businessName,
      },
    },
  };

  await logAgentActivity(request, { siteId: site.id, surface: 'a2a', action: 'discovery_agent_card', httpStatus: 200 });

  return NextResponse.json(card, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}

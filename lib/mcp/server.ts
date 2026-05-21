/**
 * Minimal Model Context Protocol (MCP) JSON-RPC handler over HTTP. Wraps
 * our UCP primitives as MCP "tools" so Gemini/Claude can invoke them
 * directly without an OpenAPI-style descriptor.
 *
 * We implement the request/response surface only — enough for `initialize`,
 * `tools/list`, and `tools/call`. Streaming and sessions are not needed
 * for the commerce use case (every call is stateless from MCP's POV; cart
 * state lives in `ucp_carts`).
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { buildQuote } from '@/lib/ucp/quote';
import { createCart, loadCart, updateCartItems, setShippingAddress, setPromoCodes } from '@/lib/ucp/cart';
import { mapProductToUcp } from '@/lib/ucp/product-mapper';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import type { UcpAddress, UcpCartItem, UcpQuoteRequest } from '@/lib/ucp/types';

interface RpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = '2024-11-05';

const TOOL_DEFS = [
  {
    name: 'search_products',
    description: 'Search published products on this storefront. Returns spec-compliant UcpProduct[] with real-time pricing and AI attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search across name and description.' },
        category: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        inStockOnly: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Fetch a single product by id or slug. Returns real-time price, inventory, and AI attributes (material, fit, socket, etc.).',
    inputSchema: {
      type: 'object',
      required: ['productId'],
      properties: { productId: { type: 'string' } },
    },
  },
  {
    name: 'create_cart',
    description: 'Create a UCP cart owned by this agent session. Returns the cart with totals already computed.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  {
    name: 'update_cart',
    description: 'Replace cart items, set a shipping address, or apply promo codes. Returns the cart with re-computed totals.',
    inputSchema: {
      type: 'object',
      required: ['cartId'],
      properties: {
        cartId: { type: 'string' },
        items: { type: 'array' },
        shippingAddress: { type: 'object' },
        promoCodes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'compute_quote',
    description: 'Quote price, tax, and shipping for a hypothetical cart without committing state. Use this for "how much would X cost?" comparisons.',
    inputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        shippingAddress: { type: 'object' },
        promoCodes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'initiate_checkout',
    description: 'Mark a cart as checking-out and issue a signed AP2 cart mandate. Submit a matching payment mandate to /api/ucp/{siteId}/mandate to finalize.',
    inputSchema: {
      type: 'object',
      required: ['cartId'],
      properties: { cartId: { type: 'string' } },
    },
  },
];

async function callTool(
  siteId: string,
  agent: { agentId: string; sessionId: string | null },
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) throw new Error('Site not found');

  switch (name) {
    case 'search_products': {
      const admin = createAdminClient();
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));
      let q = admin.from('products').select('*' as const)
        .eq('site_id', siteId).eq('is_archived', false)
        .eq('status', 'published').eq('is_active', true)
        .eq('native_commerce', true).limit(limit);
      if (args.query) {
        const pat = `%${String(args.query)}%`;
        q = q.or(`name.ilike.${pat},description.ilike.${pat}`);
      }
      if (args.category) q = q.eq('category', String(args.category));
      const { data } = await q;
      let products = (data || []).map(p => mapProductToUcp(p as Parameters<typeof mapProductToUcp>[0], { siteUrl: ctx.storefrontUrl }));
      if (args.inStockOnly) products = products.filter(p => p.availability === 'in_stock');
      return { products };
    }
    case 'get_product': {
      const productId = String(args.productId || '');
      if (!productId) throw new Error('Missing productId');
      const admin = createAdminClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
      let q = admin.from('products').select('*' as const).eq('site_id', siteId).eq('is_archived', false);
      q = isUuid ? q.eq('id', productId) : q.eq('slug', productId);
      const { data } = await q.maybeSingle();
      if (!data) throw new Error('Product not found');
      return mapProductToUcp(data as Parameters<typeof mapProductToUcp>[0], { siteUrl: ctx.storefrontUrl });
    }
    case 'create_cart': {
      return await createCart({
        siteId,
        currency: ctx.currency,
        agentId: agent.agentId,
        agentSessionId: agent.sessionId,
        items: Array.isArray(args.items) ? (args.items as UcpCartItem[]) : [],
      });
    }
    case 'update_cart': {
      const cartId = String(args.cartId || '');
      if (!cartId) throw new Error('Missing cartId');
      const cart = await loadCart(cartId);
      if (!cart || cart.siteId !== siteId) throw new Error('Cart not found');
      let updated = cart;
      if (Array.isArray(args.items)) updated = await updateCartItems(cartId, args.items as UcpCartItem[]);
      if (args.shippingAddress) updated = await setShippingAddress(cartId, args.shippingAddress as UcpAddress);
      if (Array.isArray(args.promoCodes)) updated = await setPromoCodes(cartId, (args.promoCodes as string[]).map(String));
      return updated;
    }
    case 'compute_quote': {
      const req: UcpQuoteRequest = {
        items: Array.isArray(args.items) ? (args.items as UcpCartItem[]) : [],
        shippingAddress: args.shippingAddress as UcpAddress | undefined,
        promoCodes: Array.isArray(args.promoCodes) ? (args.promoCodes as string[]) : undefined,
      };
      return await buildQuote(siteId, req, ctx.currency);
    }
    case 'initiate_checkout': {
      // The HTTP route handles mandate issuance + persistence. The MCP tool
      // proxies to it so the signing path stays single-source.
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const res = await fetch(`${origin}/api/ucp/${siteId}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-agent-id': agent.agentId },
        body: JSON.stringify({ cartId: args.cartId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout init failed');
      return json;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleMcpRequest(
  siteId: string,
  body: RpcRequest,
  agent: { agentId: string; sessionId: string | null },
): Promise<RpcResponse> {
  const respond = (result?: unknown, error?: RpcResponse['error']): RpcResponse =>
    ({ jsonrpc: '2.0', id: body.id ?? null, result, error });

  try {
    switch (body.method) {
      case 'initialize':
        return respond({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: `ucp-mcp-${siteId}`, version: '0.1.0' },
        });
      case 'tools/list':
        return respond({ tools: TOOL_DEFS });
      case 'tools/call': {
        const params = body.params ?? {};
        const name = String(params.name || '');
        const args = (params.arguments as Record<string, unknown>) || {};
        const result = await callTool(siteId, agent, name, args);
        return respond({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
      }
      case 'ping':
        return respond({});
      default:
        return respond(undefined, { code: -32601, message: `Method not found: ${body.method}` });
    }
  } catch (err) {
    return respond(undefined, { code: -32000, message: (err as Error).message });
  }
}

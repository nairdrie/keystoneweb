/**
 * MCP JSON-RPC endpoint, one per site. Gemini / Claude / any MCP-aware
 * client can be pointed at /api/mcp/{siteId} and immediately gain access
 * to the six commerce tools (search_products, get_product, create_cart,
 * update_cart, compute_quote, initiate_checkout).
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest } from '@/lib/mcp/server';
import { detectAgent, logAgentActivity } from '@/lib/ucp/agent-detect';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400 },
    );
  }

  const detect = detectAgent(request.headers);
  const response = await handleMcpRequest(siteId, body, { agentId: detect.agentId, sessionId: detect.sessionId });

  await logAgentActivity(request, {
    siteId,
    surface: 'mcp',
    action: body.method === 'tools/call' ? `tool:${(body.params as { name?: string } | undefined)?.name ?? 'unknown'}` : body.method,
    httpStatus: response.error ? 400 : 200,
  });

  return NextResponse.json(response);
}

// MCP discovery (some clients GET first to test reachability)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return NextResponse.json({
    transport: 'http',
    protocol: 'mcp',
    protocolVersion: '2024-11-05',
    server: { name: `ucp-mcp-${siteId}`, version: '0.1.0' },
    instructions: 'POST JSON-RPC requests here. Start with method=initialize, then tools/list.',
  });
}

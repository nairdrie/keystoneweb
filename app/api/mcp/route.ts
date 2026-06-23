// MCP server endpoint (Streamable HTTP, stateless).
//
// External MCP clients — e.g. Claude Code — connect here with a personal token:
//
//   claude mcp add --transport http keystone \
//     https://<host>/api/mcp --header "Authorization: Bearer ksk_…"
//
// Mint a token with: node scripts/create-mcp-token.mjs <user-email>
// Every request is authenticated and scoped to the token owner's own sites.

import { NextRequest } from 'next/server';
import { resolveMcpAuth } from '@/lib/mcp/auth';
import { dispatch, rpcError, ERROR_CODES, type JsonRpcMessage, type JsonRpcResponse } from '@/lib/mcp/protocol';

export const runtime = 'nodejs';
export const maxDuration = 60;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await resolveMcpAuth(request);
  if (!auth) {
    return new Response(
      JSON.stringify(rpcError(null, ERROR_CODES.INVALID_REQUEST, 'Unauthorized: missing or invalid MCP token.')),
      { status: 401, headers: { ...JSON_HEADERS, 'WWW-Authenticate': 'Bearer' } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(rpcError(null, ERROR_CODES.PARSE_ERROR, 'Parse error: request body is not valid JSON.'), 400);
  }

  const ctx = { userId: auth.userId };

  // JSON-RPC batch: respond with an array of the non-notification results.
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return json(rpcError(null, ERROR_CODES.INVALID_REQUEST, 'Invalid Request: empty batch.'), 400);
    }
    const responses: JsonRpcResponse[] = [];
    for (const message of payload) {
      const response = await dispatch(message as JsonRpcMessage, ctx);
      if (response) responses.push(response);
    }
    // All-notifications batch → 202 Accepted with no body.
    if (responses.length === 0) return new Response(null, { status: 202 });
    return json(responses);
  }

  const response = await dispatch(payload as JsonRpcMessage, ctx);
  if (!response) return new Response(null, { status: 202 });
  return json(response);
}

// This stateless server does not offer a server-initiated SSE stream, so GET
// (the Streamable HTTP "open stream" verb) is not supported.
export async function GET(): Promise<Response> {
  return json(
    {
      name: 'keystone-mcp',
      transport: 'streamable-http',
      message: 'POST JSON-RPC 2.0 MCP messages to this endpoint with an Authorization: Bearer token.',
    },
    405,
  );
}

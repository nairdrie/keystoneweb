/**
 * Keystone MCP server core: JSON-RPC over Streamable HTTP (stateless, JSON
 * responses). The Next route (app/api/mcp/route.ts) is a thin wrapper so this
 * can be exercised directly in tests.
 */
import { authenticateToken } from './api-tokens';
import { callTool, toolList, type ToolContext } from './mcp-tools';
import type { Db } from './store';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'keystone', title: 'Keystone Web', version: '0.1.0' };
const INSTRUCTIONS =
  'Keystone builds and hosts websites for small businesses. You design each site from scratch with HTML/CSS/JS; ' +
  'the owner edits words, images and links afterwards. Call get_guide first and follow its workflow. ' +
  'Never overwrite content the owner edited unless the human asked you to.';

interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpHttpResult {
  status: number;
  body: unknown | null;
  headers: Record<string, string>;
}

const rpcError = (id: RpcMessage['id'], code: number, message: string, data?: unknown) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

/** 401 for missing/invalid credentials, pointing clients at OAuth sign-in (MCP authorization spec). */
export function unauthorizedResult(origin?: string): McpHttpResult {
  const metadata = origin ? `, resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"` : '';
  return {
    status: 401,
    body: rpcError(null, -32001, 'Sign in required. Add this server as a connector in your AI app and sign in with your Keystone account.'),
    headers: { 'WWW-Authenticate': `Bearer realm="keystone"${metadata}` },
  };
}

export async function handleMcpHttp(db: Db, authorization: string | null, payload: unknown, keystoneToken?: string | null, origin?: string): Promise<McpHttpResult> {
  const header = authorization || '';
  // Authorization: Bearer <token>, or X-Keystone-Token: <token> for clients
  // that reserve the Authorization header for their own OAuth flow.
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : (keystoneToken || '').trim() || null;
  const auth = await authenticateToken(db, token);
  if (!auth) return unauthorizedResult(origin);
  if (payload === undefined) return { status: 400, body: rpcError(null, -32700, 'Parse error'), headers: {} };

  const batch = Array.isArray(payload);
  const messages = (batch ? payload : [payload]) as RpcMessage[];
  const responses: unknown[] = [];
  const ctx: ToolContext = { db, auth };

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      if (msg && typeof msg === 'object' && 'id' in msg) responses.push(rpcError(msg.id, -32600, 'Invalid request'));
      continue;
    }
    const isNotification = !('id' in msg) || msg.id === undefined;
    const reply = await handleMessage(msg, ctx);
    if (!isNotification && reply) responses.push(reply);
  }

  if (!responses.length) return { status: 202, body: null, headers: {} };
  return { status: 200, body: batch ? responses : responses[0], headers: { 'Cache-Control': 'no-store' } };
}

async function handleMessage(msg: RpcMessage, ctx: ToolContext) {
  const id = msg.id ?? null;
  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion || '');
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: '2.0',
        id,
        result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS },
      };
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: toolList(ctx.auth) } };
    case 'tools/call': {
      const name = String(msg.params?.name || '');
      const args = (msg.params?.arguments || {}) as Record<string, unknown>;
      const { result, error, details } = await callTool(name, args, ctx);
      if (error) {
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify({ error, ...(details ? { details } : {}) }, null, 2) }], isError: true },
        };
      }
      // Tools may attach images (e.g. screenshot) under __images; they become image content blocks.
      let images: Array<{ label?: string; data: string; mimeType: string }> = [];
      let payload: unknown = result;
      if (result && typeof result === 'object' && !Array.isArray(result) && Array.isArray((result as { __images?: unknown }).__images)) {
        const { __images, ...rest } = result as { __images: typeof images };
        images = __images;
        payload = rest;
      }
      const structured = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : { result: payload };
      const content: Array<Record<string, unknown>> = [{ type: 'text', text: JSON.stringify(payload, null, 2) }];
      for (const image of images) {
        if (image.label) content.push({ type: 'text', text: image.label });
        content.push({ type: 'image', data: image.data, mimeType: image.mimeType });
      }
      return {
        jsonrpc: '2.0',
        id,
        result: { content, structuredContent: structured },
      };
    }
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

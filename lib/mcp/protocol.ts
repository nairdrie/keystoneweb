// Minimal JSON-RPC 2.0 dispatcher implementing the subset of the Model Context
// Protocol that a client like Claude Code needs over Streamable HTTP:
// initialize, the initialized notification, ping, tools/list and tools/call.
//
// We respond to each POST with plain application/json (the Streamable HTTP spec
// permits this for servers that don't push server-initiated messages), which
// keeps the server stateless and serverless-friendly — no sessions, no SSE.

import { McpToolError } from '@/lib/mcp/site-ops';
import { TOOLS, TOOLS_BY_NAME, type ToolContext } from '@/lib/mcp/tools';

const SERVER_INFO = { name: 'keystone', version: '0.1.0' };
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

// JSON-RPC error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export const ERROR_CODES = { PARSE_ERROR, INVALID_REQUEST } as const;

function negotiateProtocolVersion(params: Record<string, unknown> | undefined): string {
  const requested = params?.protocolVersion;
  if (typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.has(requested)) return requested;
  return DEFAULT_PROTOCOL_VERSION;
}

/**
 * Handle a single JSON-RPC message. Returns a response object, or null when the
 * message is a notification (no id) that requires no reply.
 */
export async function dispatch(message: JsonRpcMessage, ctx: ToolContext): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    const id = message && typeof message === 'object' && 'id' in message ? (message.id ?? null) : null;
    return rpcError(id, INVALID_REQUEST, 'Invalid JSON-RPC request.');
  }

  const { method, params } = message;
  const isNotification = message.id === undefined || message.id === null;
  const id = message.id ?? null;

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: negotiateProtocolVersion(params),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Keystone website builder. Use list_sites/get_site/get_page to inspect, create_site to start a new draft, ' +
          'list_block_types + describe_block to learn block shapes, then add_block/set_page_blocks/create_page/set_theme to build.',
      });

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null; // notifications get no response

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      return ok(id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });

    case 'tools/call':
      return callTool(id, params, ctx);

    default:
      if (isNotification) return null; // ignore unknown notifications
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

async function callTool(
  id: string | number | null,
  params: Record<string, unknown> | undefined,
  ctx: ToolContext,
): Promise<JsonRpcResponse> {
  const name = typeof params?.name === 'string' ? params.name : '';
  const args = (params?.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>;

  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) {
    return rpcError(id, INVALID_PARAMS, `Unknown tool: ${name || '(missing name)'}`);
  }

  try {
    const result = await tool.handler(args, ctx);
    return ok(id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    });
  } catch (err) {
    // Tool-execution failures are reported as an isError result (per MCP), so
    // the model can read the message and recover — not as a transport error.
    const message = err instanceof McpToolError || err instanceof Error ? err.message : 'Tool execution failed.';
    if (!(err instanceof McpToolError)) {
      console.error(`[MCP] tool ${name} failed:`, err);
    }
    return ok(id, {
      content: [{ type: 'text', text: message }],
      isError: true,
    });
  }
}

// Re-export for the route's internal-error path.
export { INTERNAL_ERROR };

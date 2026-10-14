import { HttpError, bounded, object } from './security.js';

export type McpConnection = {
  id: string;
  name: string;
  url: string;
  token?: string;
  roles: ('operator' | 'steward')[];
  selectedTools?: string[];
};
export type McpSession = { sessionId?: string; protocolVersion?: string };
export type McpTool = {
  name: string;
  remoteName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  connectorId: string;
};
export type McpToolList = { tools: McpTool[]; session: McpSession };
export type McpToolCall = { result: unknown; isError: boolean; session: McpSession };

const VERSION = '2025-11-25';
const MAX_BODY = 256_000;
const MAX_SCHEMA = 64_000;
const MAX_CATALOG = 256_000;
const MAX_PAGES = 100;
const MAX_ERROR_BODY = 4096;
let nextId = 0;

async function discard(response: Response) {
  try { await bounded(response, MAX_ERROR_BODY); } catch { await response.body?.cancel().catch(() => {}); }
}

function endpoint(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, 'Invalid MCP endpoint.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') ||
      host.endsWith('.invalid') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) {
    throw new HttpError(403, 'MCP endpoint must be a public HTTPS URL without credentials or custom port.');
  }
  const octets = host.split('.').map(Number);
  if (octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168) {
      throw new HttpError(403, 'MCP endpoint must be publicly routable.');
    }
  }
  return url;
}

function schema(value: unknown): Record<string, unknown> {
  const result = object(value);
  let encoded: string;
  try { encoded = JSON.stringify(result); } catch { throw new HttpError(502, 'Invalid MCP tool schema.'); }
  if (encoded.length > MAX_SCHEMA || !encoded.startsWith('{')) throw new HttpError(502, 'MCP tool schema exceeds limit.');
  return result;
}

function modelName(connectorId: string, remoteName: string): string {
  if (!/^[0-9a-f]{8}-/i.test(connectorId) || remoteName.length > 51) throw new HttpError(502, 'MCP connector or tool name is incompatible.');
  return `mcp_${connectorId.slice(0, 8)}_${remoteName}`;
}

function rpc(value: unknown, id: number): Record<string, unknown> {
  const response = object(value);
  if (response.jsonrpc !== '2.0' || response.id !== id || (!('result' in response) && !('error' in response))) {
    throw new HttpError(502, 'Invalid MCP JSON-RPC response.');
  }
  if ('error' in response) throw new HttpError(502, 'MCP server returned a JSON-RPC error.');
  return object(response.result);
}

async function post(conn: McpConnection, session: McpSession, message: Record<string, unknown>): Promise<{ response: Response; session: McpSession }> {
  const url = endpoint(conn.url);
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  });
  if (conn.token) {
    if (conn.token.length > 8192 || /[\r\n]/.test(conn.token)) throw new HttpError(400, 'Invalid MCP bearer token.');
    headers.set('authorization', `Bearer ${conn.token}`);
  }
  if (session.sessionId) headers.set('mcp-session-id', session.sessionId);
  if (session.protocolVersion) headers.set('mcp-protocol-version', session.protocolVersion);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(message), redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new HttpError(502, 'MCP endpoint request failed or timed out.'); }
  if (response.status >= 300 && response.status < 400) {
    await discard(response);
    throw new HttpError(502, 'MCP endpoint redirects are not allowed.');
  }
  const receivedSession = response.headers.get('mcp-session-id');
  const nextSession = receivedSession ? { ...session, sessionId: receivedSession } : session;
  if (!response.ok) {
    await discard(response);
    if (response.status === 401 || response.status === 403) throw new HttpError(502, 'MCP endpoint denied authentication.');
    throw new HttpError(response.status === 404 ? 404 : 502, response.status === 404 ? 'MCP session expired.' : 'MCP endpoint returned an error.');
  }
  return { response, session: nextSession };
}

async function message(response: Response, id: number): Promise<Record<string, unknown>> {
  const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (type === 'application/json' || type?.endsWith('+json')) {
    const body = await bounded(response, MAX_BODY);
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { throw new HttpError(502, 'Invalid MCP JSON response.'); }
    return rpc(parsed, id);
  }
  if (type !== 'text/event-stream') throw new HttpError(502, 'Unsupported MCP response content type.');
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, 'MCP event stream omitted the response.');
  const decoder = new TextDecoder();
  let buffer = '', size = 0;
  const parse = (block: string): Record<string, unknown> | undefined => {
    const data = block.split(/\r\n|\n|\r/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { throw new HttpError(502, 'Invalid MCP event stream.'); }
    const envelope = object(parsed);
    return envelope.id === id ? rpc(envelope, id) : undefined;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        size += value.byteLength;
        if (size > MAX_BODY) throw new HttpError(413, 'Remote response exceeds size limit.');
      }
      buffer += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const result = parse(block);
        if (result) return result;
      }
      if (done) {
        const result = parse(buffer);
        if (result) return result;
        break;
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  throw new HttpError(502, 'MCP event stream omitted the response.');
}

async function request(conn: McpConnection, session: McpSession, method: string, params: Record<string, unknown>, id = ++nextId) {
  const sent = await post(conn, session, { jsonrpc: '2.0', id, method, params });
  return { result: await message(sent.response, id), session: sent.session };
}

async function initialize(conn: McpConnection): Promise<McpSession> {
  const init = await request(conn, {}, 'initialize', {
    protocolVersion: VERSION,
    capabilities: {},
    clientInfo: { name: 'dual-agent', version: '0.1.0' },
  });
  const version = init.result.protocolVersion;
  if (typeof version !== 'string' || version !== VERSION) throw new HttpError(502, 'MCP server selected unsupported protocol version.');
  const session = { ...init.session, protocolVersion: version };
  const notified = await post(conn, session, { jsonrpc: '2.0', method: 'notifications/initialized' });
  const body = await bounded(notified.response, MAX_BODY);
  if (body && notified.response.headers.get('content-type')?.includes('json')) {
    throw new HttpError(502, 'MCP initialized notification returned an unexpected response.');
  }
  return notified.session;
}

export async function listMcpTools(conn: McpConnection, existing: McpSession = {}): Promise<McpToolList> {
  let session = existing;
  if (session.protocolVersion !== VERSION) session = await initialize(conn);
  const tools: McpTool[] = [];
  const names = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    let pageResult: Record<string, unknown>;
    try {
      const response = await request(conn, session, 'tools/list', cursor ? { cursor } : {});
      pageResult = response.result;
      session = response.session;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404 && page === 0) {
        session = await initialize(conn);
        const retry = await request(conn, session, 'tools/list', {});
        pageResult = retry.result;
        session = retry.session;
      } else throw error;
    }
    if (!Array.isArray(pageResult.tools) || pageResult.tools.length > 32 || tools.length + pageResult.tools.length > 32) throw new HttpError(502, 'MCP connector exceeds 32 tools.');
    for (const raw of pageResult.tools) {
      const tool = object(raw);
      if (typeof tool.name !== 'string' || !/^[a-zA-Z0-9_-]{1,51}$/.test(tool.name) || names.has(tool.name)) throw new HttpError(502, 'Invalid or duplicate MCP tool name.');
      names.add(tool.name);
      const inputSchema = schema(tool.inputSchema);
      tools.push({
        name: modelName(conn.id, tool.name), remoteName: tool.name,
        description: typeof tool.description === 'string' ? tool.description.slice(0, 4000) : '',
        inputSchema, connectorId: conn.id,
      });
      if (JSON.stringify(tools).length > MAX_CATALOG) throw new HttpError(502, 'MCP tool catalog exceeds the size limit.');
    }
    if (typeof pageResult.nextCursor !== 'string') return { tools, session };
    if (pageResult.nextCursor.length > 1024 || !pageResult.nextCursor) throw new HttpError(502, 'Invalid MCP pagination cursor.');
    cursor = pageResult.nextCursor;
  }
  throw new HttpError(502, 'MCP tool list exceeded pagination limit.');
}

export async function callMcpTool(conn: McpConnection, existing: McpSession, remoteName: string, args: Record<string, unknown>): Promise<McpToolCall> {
  if (!/^[a-zA-Z0-9_-]{1,51}$/.test(remoteName)) throw new HttpError(400, 'Invalid MCP tool name.');
  if (!conn.selectedTools?.includes(remoteName)) throw new HttpError(403, 'MCP tool is not selected for this connector.');
  object(args);
  if (JSON.stringify(args).length > MAX_SCHEMA) throw new HttpError(413, 'MCP tool arguments exceed limit.');
  let session = existing;
  if (session.protocolVersion !== VERSION) session = await initialize(conn);
  try {
    const response = await request(conn, session, 'tools/call', { name: remoteName, arguments: args });
    return { result: response.result, isError: response.result.isError === true, session: response.session };
  } catch (error) {
    // A call may have completed before the transport lost its session; never retry side effects.
    if (error instanceof HttpError && error.status === 404) throw new HttpError(409, 'MCP session expired; reconnect before retrying this tool.');
    throw error;
  }
}

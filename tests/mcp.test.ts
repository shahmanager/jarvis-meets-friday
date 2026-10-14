import test from 'node:test';
import assert from 'node:assert/strict';
import { callMcpTool, listMcpTools, type McpConnection, type McpSession } from '../src/mcp';
import { HttpError } from '../src/security';

const connection: McpConnection = {
  id: 'a1b2c3d4-1234-4234-8234-123456789abc', name: 'Example', url: 'https://mcp.example.com/api',
  roles: ['operator'], selectedTools: ['read'], token: 'secret-token',
};
const schema = { type: 'object', properties: {} };
const rpc = (id: number, result: unknown) => Response.json({ jsonrpc: '2.0', id, result });
const initResult = { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'test', version: '1' } };

test('initialize uses bearer auth, negotiates version, and carries session to paginated tools/list', async t => {
  const calls: Array<{ body: Record<string, unknown>; init: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const body = JSON.parse(String(init.body));
    calls.push({ body, init });
    if (body.method === 'initialize') {
      const response = rpc(body.id, initResult);
      response.headers.set('mcp-session-id', 'session-1');
      return response;
    }
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method === 'tools/list' && !body.params.cursor) return rpc(body.id, { tools: [{ name: 'read', inputSchema: schema }], nextCursor: 'next' });
    return rpc(body.id, { tools: [{ name: 'write', inputSchema: schema }] });
  });

  const result = await listMcpTools(connection);
  assert.deepEqual(result.tools.map(t => t.remoteName), ['read', 'write']);
  assert.equal(result.tools[0].name, 'mcp_a1b2c3d4_read');
  assert.equal(result.session.sessionId, 'session-1');
  assert.equal(calls[0].init.headers instanceof Headers ? calls[0].init.headers.get('authorization') : (calls[0].init.headers as Record<string, string>).authorization, 'Bearer secret-token');
  assert.equal(calls[1].body.method, 'notifications/initialized');
  assert.equal((calls[2].init.headers as Headers).get('mcp-session-id'), 'session-1');
  assert.deepEqual(calls[3].body.params, { cursor: 'next' });
});

test('tool calls require explicit selection and never retry a possibly executed side effect', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('expired', { status: 404 }); });
  const session: McpSession = { sessionId: 'gone', protocolVersion: '2025-11-25' };
  await assert.rejects(callMcpTool({ ...connection, selectedTools: undefined }, session, 'read', {}), (err: unknown) => err instanceof HttpError && err.status === 403);
  await assert.rejects(callMcpTool(connection, session, 'read', {}), /session expired; reconnect before retrying/);
  assert.equal(calls, 1);
});

test('expired read session reinitializes and retries tools/list once', async t => {
  let listCount = 0;
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const body = JSON.parse(String(init.body));
    if (body.method === 'tools/list' && ++listCount === 1) return new Response('expired', { status: 404 });
    if (body.method === 'initialize') return rpc(body.id, initResult);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return rpc(body.id, { tools: [{ name: 'read', inputSchema: schema }] });
  });
  const result = await listMcpTools(connection, { sessionId: 'expired', protocolVersion: '2025-11-25' });
  assert.deepEqual(result.tools.map(t => t.remoteName), ['read']);
  assert.equal(listCount, 2);
});

test('accepts bounded SSE JSON-RPC response and reports remote isError', async t => {
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const body = JSON.parse(String(init.body));
    return new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { isError: true, content: [{ type: 'text', text: 'denied' }] } })}\n\n`, {
      headers: { 'content-type': 'text/event-stream' },
    });
  });
  const result = await callMcpTool(connection, { protocolVersion: '2025-11-25' }, 'read', {});
  assert.equal(result.isError, true);
  assert.deepEqual(result.result, { isError: true, content: [{ type: 'text', text: 'denied' }] });
});

test('returns on matching SSE frame and cancels a stream that remains open', async t => {
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const body = JSON.parse(String(init.body));
    const frame = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'ready' }] } })}\n\n`;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(frame)); },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
  });
  const result = await callMcpTool(connection, { protocolVersion: '2025-11-25' }, 'read', {});
  assert.equal(result.isError, false);
  assert.equal(cancelled, true, 'client should stop reading and cancel once it has the matching JSON-RPC response');
});

test('rejects invalid JSON-RPC and private or redirected endpoints', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ jsonrpc: '2.0', id: 99, result: initResult }));
  await assert.rejects(listMcpTools(connection), /Invalid MCP JSON-RPC response/);
  await assert.rejects(listMcpTools({ ...connection, url: 'https://127.0.0.1/mcp' }), /public HTTPS URL/);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { location: 'https://other.example/mcp' } }));
  await assert.rejects(listMcpTools(connection), /redirects are not allowed/);
});

test('caps total discovered catalog size even when individual schemas fit', async t => {
  let cursor = '';
  t.mock.method(globalThis, 'fetch', async (_input, init = {}) => {
    const body = JSON.parse(String(init.body));
    if (body.method === 'initialize') return rpc(body.id, initResult);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method === 'tools/list') {
      const page = Number(body.params.cursor ?? 0);
      cursor = String(page + 1);
      const tools = Array.from({ length: 4 }, (_, n) => ({ name: `tool_${page}_${n}`, inputSchema: { type: 'object', note: 'x'.repeat(60_000) } }));
      return rpc(body.id, { tools, ...(page < 2 ? { nextCursor: cursor } : {}) });
    }
    throw new Error('unexpected MCP method');
  });
  await assert.rejects(listMcpTools(connection), /catalog exceeds the size limit/);
});

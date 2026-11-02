import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { remoteGateway, BackendError, type Api } from '../src/remote';

async function fixture(api: Api) {
  const server = remoteGateway(api, 'https://jump.example');
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, close: async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); } };
}

test('HTTP SDK negotiation, public tool isolation, exact scoped token per client', async () => {
  const calls: unknown[] = [];
  const f = await fixture(async (path, token, body, clientIp) => {
    calls.push({ path, token, body, clientIp });
    if (path === '/api/mcp/session') return { resource: 'https://jump.example/mcp/wallet', client_id: token, scope: 'jump:read jump:request jump:results', expires_at: Math.floor(Date.now()/1000)+60 };
    if (path.endsWith('capabilities')) return { execution_chain_id: 97 };
    return { token, items: [] };
  });
  const clients: Client[] = [];
  try {
    for (const token of [undefined, 'alice', 'bob']) {
      const c = new Client({ name: 'jump-remote-test', version: '1' }); clients.push(c);
      await c.connect(new StreamableHTTPClientTransport(new URL(f.url + (token ? '/mcp/wallet' : '/mcp')), { requestInit: { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Real-IP': '192.0.2.10' } } }));
      const { tools } = await c.listTools();
      assert.equal(tools.length, token ? 7 : 5);
      assert.ok(!tools.some(t => /execute|sign|broadcast/.test(t.name)));
      if (token) {
        const result = await c.callTool({ name: 'jump_request_action', arguments: { tokenId: 13, action: 'deposit', amount: '0.05', clientRequestId: '00000000-0000-4000-8000-000000000001' } });
        assert.equal(result.isError, undefined);
      } else {
        const bad = await c.callTool({ name: 'jump_info', arguments: { tokenId: 13, url: 'https://evil.example' } });
        assert.equal(bad.isError, true);
      }
    }
    assert.deepEqual(calls.filter((x: any) => x.path === '/api/mcp/requests').map((x: any) => [x.token, x.clientIp]), [['alice', '192.0.2.10'], ['bob', '192.0.2.10']]);
  } finally { await Promise.allSettled(clients.map(c => c.close())); await f.close(); }
});

test('gateway rejects foreign origins, missing auth, oversized bodies and distinguishes outages', async () => {
  const f = await fixture(async () => { throw new BackendError(503); });
  try {
    assert.equal((await fetch(f.url+'/mcp', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
    const unauthorized = await fetch(f.url+'/mcp/wallet', { method: 'POST' });
    assert.equal(unauthorized.status, 401);
    assert.match(unauthorized.headers.get('www-authenticate')!, /oauth-protected-resource/);
    assert.equal((await fetch(f.url+'/mcp/wallet', { method: 'POST', headers: { Authorization: 'Bearer outage' } })).status, 503);
    assert.equal((await fetch(f.url+'/mcp', { method: 'POST', body: 'x'.repeat(32769) })).status, 400);
    assert.equal((await fetch(f.url+'/mcp?token=leak')).status, 404);
  } finally { await f.close(); }
});

test('gateway bounds concurrent work and returns retry guidance under saturation', async () => {
  let release!: () => void, ready!: () => void, entered = 0;
  const gate = new Promise<void>(r => { release = r; });
  const started = new Promise<void>(r => { ready = r; });
  const server = remoteGateway(async () => {
    if (++entered === 2) ready();
    await gate;
    return { resource:'https://jump.example/mcp/wallet', client_id:'capacity', scope:'jump:read', expires_at:Math.floor(Date.now()/1000)+60 };
  }, 'https://jump.example', 2);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const url = `http://127.0.0.1:${(server.address() as {port:number}).port}/mcp/wallet`;
  const send = () => fetch(url,{method:'POST',headers:{Authorization:'Bearer capacity','Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'capacity',version:'1'}}})});
  try {
    const first = [send(), send()];
    await started;
    const saturated = await Promise.all(Array.from({length:18}, send));
    assert.ok(saturated.every(r => r.status === 429 && r.headers.get('retry-after') === '5'));
    assert.equal(entered,2);
    release();
    assert.ok((await Promise.all(first)).every(r => r.status === 200));
  } finally { release(); server.closeAllConnections(); await new Promise<void>(r => server.close(()=>r())); }
});

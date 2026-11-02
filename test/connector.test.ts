import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { once } from 'node:events';

test('connection helper only plans by default and rejects ambiguous origin/mode/client', () => {
  const script = resolve('connect/jump-connect.mjs');
  for (const client of ['codex','claude','openclaw']) {
    const output = execFileSync(process.execPath, [script, '--client',client,'--origin','https://app.jump.family','--mode','wallet'], {encoding:'utf8'});
    const plan = JSON.parse(output);
    assert.equal(plan.apply, false);
    assert.equal(plan.url,'https://app.jump.family/mcp/wallet');
    assert.ok(plan.args.includes('jump-wallet'));
    assert.ok(!output.includes('access_token'));
  }
  for (const [key,value] of [['--origin','https://u:p@example.com'],['--origin','https://example.com/evil'],['--client','sh'],['--mode','execute']]) {
    const args = ['--client','codex','--origin','https://app.jump.family','--mode','read'];
    args[args.indexOf(key)+1]=value;
    assert.throws(() => execFileSync(process.execPath,[script,...args],{stdio:'pipe'}));
  }
});

test('connection doctor accepts a finite legacy SSE initialization response', async () => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  let origin = '';
  const server = createServer((req,res) => {
    if (req.url === '/api/agent/v1/capabilities') res.end(JSON.stringify({code:0,data:{execution_chain_id:97,remote_mcp:{public_url:origin+'/mcp',wallet_url:origin+'/mcp/wallet'}}}));
    else { res.setHeader('Content-Type','text/event-stream'); res.end('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{serverInfo:{name:'test',version:'1'}}})+'\n\n'); }
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  origin = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    const p = spawn(process.execPath,[resolve('connect/jump-connect.mjs'),'--client','codex','--origin',origin,'--mode','read','--doctor']);
    let output=''; p.stdout.on('data',b=>output+=b);
    const [code] = await once(p,'close');
    assert.equal(code,0); assert.match(output,/"status":"PASS"/); assert.match(output,/"wallet_accessed":false/);
  } finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); }
});

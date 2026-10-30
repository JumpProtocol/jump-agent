import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';
import { startBridge, validatePairing } from '../src/bridge';
import { bridgeActivation, bridgeStatus } from '../src/shared/bridge';

const origin = 'https://jump.example';
const address = `0x${'22'.repeat(20)}`;
async function fixture(lifetimeMs?: number) {
  const calls: string[][] = [];
  let finish: (connect?: boolean) => void = () => {}, connected = false;
  const wallet = {
    call: async (args: string[], _timeout: number, signal?: AbortSignal) => {
      calls.push(args);
      if (args[0] === 'wallet') return { status: connected ? 'CONNECTED' : 'UNCONNECTED' };
      if (args[1] === 'signin') return { urlForWeb: 'https://app.binance.com/uni-qr/test-only',
        pairingCode: 'aB12cD', qrCodeId: 'test-only-code', expireAt: String(Date.now() + 300_000) };
      if (args[1] === 'verify') {
        await new Promise<void>((resolve, reject) => {
          finish = (connect = true) => { connected = connect; resolve(); };
          signal?.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
        });
        return { status: 'SUCCESS' };
      }
      throw new Error('Unexpected wallet command');
    },
    identity: async () => { if (!connected) throw new Error('Wallet not connected'); return address; },
  };
  const bridge = await startBridge({ origin, chainId: 56, port: 0, lifetimeMs, wallet: wallet as any });
  const post = (path = '/status', headers: Record<string, string> = {}, body = '{}') =>
    fetch(`http://127.0.0.1:${bridge.port}${path}`, { method: 'POST', headers: {
      Origin: origin, Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json', ...headers }, body });
  const state = async () => (await post()).json();
  const until = async (phase: string) => {
    for (let i = 0; i < 100; i++) { const result = await state(); if (result.phase === phase) return result; await delay(10); }
    assert.fail(`Did not reach ${phase}`);
  };
  return { bridge, post, state, until, calls, finish: (connect = true) => finish(connect) };
}

test('loopback bridge rejects other origins, credentials, Host rebinding and command forwarding', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post('/status', { Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await f.post('/status', { Authorization: 'Bearer wrong' })).status, 401);
    assert.equal((await f.post('/status', { Authorization: `Bearer ${'é'.repeat(64)}` })).status, 401);
    assert.equal((await f.post('/execute')).status, 404);
    assert.equal((await f.post('/status', {}, '{"cmd":"sign"}')).status, 400);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port: f.bridge.port, path: '/status', method: 'POST',
        headers: { Host: 'rebinding.example', Origin: origin, Authorization: `Bearer ${f.bridge.token}`, 'Content-Type': 'application/json' } },
      res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end('{}');
    });
    assert.equal(status, 403);
    const preflight = await fetch(`http://127.0.0.1:${f.bridge.port}/status`, { method: 'OPTIONS', headers: { Origin: origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    assert.equal((await f.state()).phase, 'IDLE');
    assert.equal(f.calls.length, 0);
  } finally { await f.bridge.close(); }
});

test('pairing keeps foreground verification alive and only wallet identity establishes connection', async () => {
  const f = await fixture();
  try {
    await Promise.all(Array.from({ length: 8 }, () => f.post('/connect')));
    const pending = await f.until('AWAITING_APP');
    assert.equal(pending.pairingCode, 'aB12cD');
    assert.match(pending.qrDataUrl, /^data:image\/png;base64,/);
    assert.equal(pending.qrCodeId, undefined);
    assert.equal(pending.address, undefined);
    assert.equal(f.calls.filter(c => c[1] === 'signin').length, 1);
    for (let i = 0; i < 100 && !f.calls.some(c => c[1] === 'verify'); i++) await delay(10);
    assert.ok(f.calls.some(c => c[1] === 'verify' && c[3] === 'test-only-code'));
    f.finish();
    const connected = await f.until('CONNECTED');
    assert.equal(connected.address, address);
    assert.equal(bridgeStatus({ ...connected, serverTime: Date.now() }, 56).address, address);
    assert.equal(connected.platformAuthenticated, false);
    assert.equal(connected.canSignFromBrowser, false);
    const detached = await (await f.post('/disconnect')).json();
    assert.equal(detached.phase, 'DISCONNECTED');
    assert.equal(f.calls.some(c => c[1] === 'signout' || c[1] === 'execute'), false);
  } finally { await f.bridge.close(); }
});

test('cancelled pairing cannot later replace page state with a stale completion', async () => {
  const f = await fixture();
  try {
    await f.post('/connect'); await f.until('AWAITING_APP');
    const cancelled = await (await f.post('/cancel')).json();
    assert.equal(cancelled.phase, 'IDLE');
    f.finish(); await delay(10);
    assert.equal((await f.state()).phase, 'IDLE');
  } finally { await f.bridge.close(); }
});

test('a verify SUCCESS without connected wallet identity never marks the page connected', async () => {
  const f = await fixture();
  try {
    await f.post('/connect'); await f.until('AWAITING_APP');
    for (let i = 0; i < 100 && !f.calls.some(c => c[1] === 'verify'); i++) await delay(10);
    f.finish(false);
    const result = await f.until('ERROR');
    assert.equal(result.address, undefined);
  } finally { await f.bridge.close(); }
});

test('bridge lifetime expires and closes the listener without wallet access', async () => {
  const f = await fixture(40);
  try { await delay(80); await assert.rejects(() => f.post()); assert.equal(f.calls.length, 0); }
  finally { await f.bridge.close(); }
});

test('pairing and frontend activation reject forged hosts, invalid scopes and stale addresses', () => {
  const good = { urlForWeb: 'https://web3.binance.com/en/agent-login?url=unchanged', qrCodeId: 'valid-id', pairingCode: 'ABC123', expireAt: Date.now() + 300_000 };
  assert.equal(validatePairing(good).url, good.urlForWeb);
  for (const urlForWeb of ['https://app.binance.com.attacker.example/qr', 'javascript:alert(1)', 'https://user@app.binance.com/qr', 'http://app.binance.com/qr']) {
    assert.throws(() => validatePairing({ ...good, urlForWeb }));
  }
  assert.throws(() => validatePairing({ ...good, expireAt: Date.now() - 1 }));
  const hash = `#jump-bridge=${'ab'.repeat(32)}&port=42819&chain=56`;
  assert.equal(bridgeActivation(hash)?.port, 42819);
  for (const bad of [hash + '&url=https://attacker.example', hash + '&chain=97', hash.replace('42819', '0')]) assert.equal(bridgeActivation(bad), null);
  assert.throws(() => bridgeStatus({ phase: 'CONNECTED', chainId: 97 }, 56));
  assert.throws(() => bridgeStatus({ phase: 'CONNECTED', chainId: 56, scope: 'LOCAL_AGENT_WALLET', platformAuthenticated: false,
    canSignFromBrowser: false, bridgeExpiresAt: Date.now() + 1000, address, verifiedAt: Date.now() - 60_000 }, 56));
});

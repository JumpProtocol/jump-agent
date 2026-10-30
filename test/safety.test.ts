import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store';
import { normalizeSignature } from '../src/wallet';
import { previewExpiry, validateLoginChallenge, Runner } from '../src/runner';
import { safeUrl, JumpApi } from '../src/api';

test('signature recovery is normalized and inconsistent values fail', () => {
  const rs = 'ab'.repeat(64);
  assert.equal(normalizeSignature(rs, '01'), `0x${rs}1c`);
  assert.equal(normalizeSignature(`${rs}00`), `0x${rs}1b`);
  assert.throws(() => normalizeSignature(`${rs}1b`, '01'));
  assert.throws(() => normalizeSignature(rs));
  assert.throws(() => normalizeSignature(rs, '01garbage'));
  assert.throws(() => normalizeSignature('ff', '00'));
});
test('preview expiry rejects missing provider data and bounds validity', () => {
  const now = Date.now();
  assert.equal(previewExpiry({ requestId: 'id', expiresAt: now + 500_000 }, now), now + 120_000);
  assert.throws(() => previewExpiry({ requestId: 'id', expiresAt: now - 1 }, now));
  assert.throws(() => previewExpiry({ expiresAt: now + 1000 }, now));
});
test('URLs reject plaintext remote endpoints and embedded credentials', () => {
  for (const bad of ['http://remote.example', 'https://user:secret@example.com', 'https://example.com?key=secret']) assert.throws(() => safeUrl(bad));
  assert.equal(safeUrl('http://127.0.0.1:8000').hostname, '127.0.0.1');
});
test('single-use local submission claim is atomic and records are private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jump-agent-test-'));
  try {
    const store = new Store(dir);
    await store.put('preview', { data: 1 });
    const outcomes = await Promise.allSettled([store.claim('preview'), store.claim('preview')]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await stat(join(dir, 'preview.json'))).mode & 0o777, 0o600);
    assert.throws(() => normalizeSignature('../secret'));
    await assert.rejects(() => store.get('../secret'));
  } finally { await rm(dir, { recursive: true }); }
});
test('API HTTP 200 business errors remain failures', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 40301, msg: 'denied' }));
  try { await assert.rejects(() => new JumpApi('https://example.com').request('/tokens'), /40301/); }
  finally { globalThis.fetch = old; }
});

test('local records reject symlinks and permissive file modes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jump-store-boundary-'));
  try {
    const store = new Store(dir);
    await store.put('session', { token: 'synthetic' });
    await symlink(join(dir, 'session.json'), join(dir, 'alias.json'));
    await assert.rejects(() => store.get('alias'));
    await chmod(join(dir, 'session.json'), 0o644);
    await assert.rejects(() => store.get('session'), /Unsafe Agent record/);
    await symlink(dir, join(dir, 'directory-alias'));
    await assert.rejects(() => new Store(join(dir, 'directory-alias')).init(), /Unsafe Agent state directory/);
  } finally { await rm(dir, { recursive: true }); }
});
test('execution rejects wrong confirmation before any wallet operation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jump-confirm-test-'));
  try {
    const store = new Store(dir);
    await store.put('preview', { plan: { kind: 'transaction' }, digest: 'different', state: 'previewed' });
    const runner = new Runner({ api: 'https://example.com', chainId: '56', audience: 'jump-platform' }, undefined, store);
    await assert.rejects(() => runner.execute('preview', 'wrong'), /Preview changed/);
  } finally { await rm(dir, { recursive: true }); }
});
test('Permit typed data cannot be used as a login challenge', () => {
  assert.throws(() => validateLoginChallenge({ challenge_id: 'a'.repeat(64), typed_data: { primaryType: 'Permit' } },
    '0x1111111111111111111111111111111111111111', 56, 'jump-platform'));
});

test('oversized API payloads are rejected before JSON validation', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response('x'.repeat(2_000_001));
  try { await assert.rejects(() => new JumpApi('https://example.com').request('/tokens'), /size limit/); }
  finally { globalThis.fetch = old; }
});

test('wrong-chain RPC is rejected before token/deployment lookup', async () => {
  const old = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.method, 'eth_chainId');
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '0x61' }));
  };
  try {
    const r = new Runner({ api: 'https://example.com', chainId: '56', audience: 'jump-platform',
      rpc: 'http://127.0.0.1:8545', engine: `0x${'33'.repeat(20)}`, factory: `0x${'44'.repeat(20)}` });
    await assert.rejects(() => r.context(1), /RPC chain mismatch/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = old; }
});

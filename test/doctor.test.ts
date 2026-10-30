import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Runner } from '../src/runner';
import { Store } from '../src/store';

test('doctor verifies deployment without a wallet and fails closed for stale blocks or mismatched pins', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jump-doctor-'));
  try {
    const engine = `0x${'33'.repeat(20)}`, factory = `0x${'44'.repeat(20)}`;
    const runner = new Runner({ api: 'https://example.com', chainId: '56', audience: 'jump-platform', engine, factory }, {
      preflight: async () => { throw new Error('Must never contact wallet'); },
      call: async () => { throw new Error('Must never call baw'); },
    } as any, new Store(dir));
    let age = 0;
    runner.rpcClient = async () => ({
      getCode: async () => '0x1234',
      getStorageAt: async () => `0x${'00'.repeat(12)}${'55'.repeat(20)}`,
      getBlock: async () => ({ timestamp: BigInt(Math.floor(Date.now() / 1000) - age), number: 10n }),
    }) as any;
    runner.api.request = async () => [{ chain_id: 56, auction_engine: engine, launch_factory: factory }];
    const pass = await runner.doctor();
    assert.equal(pass.status, 'READ_ONLY_CHECKS_PASSED');
    assert.equal(pass.walletContacted, false);
    assert.equal(pass.liveWalletAcceptance, 'NOT_ESTABLISHED');
    age = 300;
    assert.equal((await runner.doctor()).status, 'CHECKS_FAILED');
    age = 0;
    runner.api.request = async () => [{ chain_id: 56, auction_engine: factory, launch_factory: engine }];
    const fail = await runner.doctor();
    assert.equal(fail.status, 'CHECKS_FAILED');
    assert.match(JSON.stringify(fail), /differs from pinned/);
    assert.doesNotMatch(JSON.stringify(fail), /Must never/);
  } finally { await rm(dir, { recursive: true }); }
});

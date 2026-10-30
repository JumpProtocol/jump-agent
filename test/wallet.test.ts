import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { BinanceWallet } from '../src/wallet';
import { publicError } from '../src/errors';
import { historyHashes, nextAction } from '../src/recovery';

test('real subprocess adapter preserves argument boundaries and redacts failure payloads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jump-baw-double-'));
  const previous = process.env.PATH;
  try {
    await writeFile(join(dir, 'baw'), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('reject')) {
  console.error('stderr-secret-sentinel');
  console.log(JSON.stringify({ success: false, error: { code: 351803, message: 'message-secret-sentinel', data: { session: 'session-secret-sentinel' } } }));
  process.exit(1);
}
if (args.includes('invalid')) { console.log('invalid json'); process.exit(0); }
if (args.includes('timeout')) { setTimeout(() => {}, 10000); }
else console.log(JSON.stringify({ success: true, data: { args } }));
`, { mode: 0o700 });
    process.env.PATH = dir + delimiter + previous;
    const wallet = new BinanceWallet();
    const marker = join(dir, 'should-not-exist');
    const payload = '; touch ' + marker;
    const result = await wallet.call(['wallet', 'tx-history', '--nextCursor', payload]);
    assert.ok(result.args.includes(payload));
    await assert.rejects(() => access(marker));
    try { await wallet.call(['contract-call', 'execute', 'reject']); assert.fail('Expected rejection'); }
    catch (error) {
      const exposed = publicError(error);
      assert.equal(exposed.code, 'WALLET_REQUEST_REJECTED');
      assert.equal('providerCode' in exposed && exposed.providerCode, 351803);
      assert.equal('submissionMayHaveOccurred' in exposed && exposed.submissionMayHaveOccurred, true);
      assert.equal(JSON.stringify(exposed).includes('sentinel'), false);
    }
    await assert.rejects(() => wallet.call(['wallet', 'status', 'invalid']), error => publicError(error).code === 'WALLET_INVALID_RESPONSE');
    await assert.rejects(() => wallet.call(['contract-call', 'execute', 'timeout'], 150), error => {
      const exposed = publicError(error);
      return exposed.code === 'WALLET_COMMAND_INCOMPLETE' && 'submissionMayHaveOccurred' in exposed && exposed.submissionMayHaveOccurred === true;
    });
  } finally {
    process.env.PATH = previous;
    await rm(dir, { recursive: true });
  }
});

test('history parsing and recovery states never imply order identity or unsafe retry', () => {
  const hash = `0x${'12'.repeat(32)}`;
  assert.deepEqual(historyHashes({ transactions: [{ binanceChainId: '56', txHash: hash,
    txHashList: [{ binanceChainId: '56', txHash: hash }, { binanceChainId: '97', txHash: `0x${'34'.repeat(32)}` }] }] }, 56), [hash]);
  assert.throws(() => historyHashes({ rows: [] }, 56));
  assert.equal(nextAction('submission-unknown', 'transaction'), 'INVESTIGATE_WITHOUT_RESUBMITTING');
  assert.equal(nextAction('PENDING_CONFIRMATION', 'transaction'), 'WAIT_FOR_APP');
  assert.equal(nextAction('BROADCASTED', 'transaction', true), 'RECONCILE_RECEIPT');
  assert.equal(nextAction('REJECTED', 'login'), 'CREATE_NEW_LOGIN_PREVIEW');
});

test('wallet preflight accepts official CLI ISO expiry and documented numeric seconds', async () => {
  const wallet = new BinanceWallet();
  wallet.identity = async () => `0x${'22'.repeat(20)}`;
  for (const expiresAt of [new Date(Date.now() + 60_000).toISOString(), Math.floor(Date.now() / 1000) + 60]) {
    wallet.call = async () => ({ devMode: { enabled: true, expiresAt, balanceExceeded: false } });
    assert.equal((await wallet.preflight(97)).address, `0x${'22'.repeat(20)}`);
  }
  wallet.call = async () => ({ devMode: { enabled: true, expiresAt: 'not-a-date' } });
  await assert.rejects(() => wallet.preflight(97), /Developer Mode/);
});

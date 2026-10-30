import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { decodeFunctionData, zeroAddress } from 'viem';
import type { Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Store, sessionKey } from '../src/store';
import { Runner, validateLoginChallenge } from '../src/runner';
import { BinanceWallet } from '../src/wallet';
import { ERC20_ABI } from '../src/shared/auction';
import { AgentError } from '../src/errors';

const walletAddress = `0x${'22'.repeat(20)}` as const;
const engine = `0x${'33'.repeat(20)}` as const;
const factory = `0x${'44'.repeat(20)}` as const;

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'jump-runner-'));
  const calls: string[][] = [];
  let timeout = false;
  const wallet = {
    identity: async () => walletAddress,
    preflight: async () => ({ address: walletAddress, settings: {} }),
    call: async (args: string[]) => {
      calls.push(args);
      if (args[1] === 'preview') return { requestId: 'provider-request', expiresAt: Date.now() + 60_000, risks: { riskDetails: [] } };
      if (timeout) throw new Error('Submission timed out');
      return { status: 'BROADCASTED', txHash: `0x${'ab'.repeat(32)}`, orderId: 'order' };
    },
  };
  const store = new Store(dir);
  const runner = new Runner({ api: 'https://example.com', chainId: '56', audience: 'jump-platform' }, wallet as unknown as BinanceWallet, store);
  const context = {
    engine, factory, token: { id: 1, launch_id: 7, chain_id: 56, token_address: `0x${'55'.repeat(20)}` },
    launchId: 7n, fingerprint: 'implementation-v1', block: { timestamp: 15n, number: 1n },
    status: { state: 1, startTime: 10n, endTime: 20n, totalReachableQuote: 5n, targetRaiseQuote: 10n, individualCapQuote: 2n, auctionAsset: zeroAddress as Address },
    client: {
      estimateGas: async () => 21_000n, getGasPrice: async () => 1n, getBalance: async () => 10n ** 20n,
      call: async () => ({}),
      readContract: async () => ({ contributed: 1n, participantIndex: 0n, claimed: false }),
    },
  };
  await store.put(sessionKey(runner.api.base, 56, walletAddress), { token: 'test-agent-token', expiresAt: Date.now() + 1800_000 });
  let remoteId = '';
  runner.api.request = async (path) => {
    if (path === '/agent/v1/reservations') return { operation_id: remoteId = randomUUID() };
    if (path.endsWith('/dispatch')) return { operation_id: remoteId, state: 'SUBMISSION_UNKNOWN', guard_active: true };
    if (path.endsWith('/result')) return { operation_id: path.split('/')[4], chain_id: 56, wallet: walletAddress, state: 'CONFIRMED', guard_active: false };
    throw new Error('Unexpected API request: ' + path);
  };
  runner.context = async () => context as any;
  runner.rpcClient = async () => context.client as any;
  return { runner, context, calls, store, setTimeout: () => { timeout = true; }, cleanup: () => rm(dir, { recursive: true }) };
}

test('concurrent execute sends exactly once and a repeat is rejected', async () => {
  const f = await fixture();
  try {
    const preview = await f.runner.preview(1, 'deposit', '0.1');
    const results = await Promise.allSettled([f.runner.execute(preview.previewId, preview.confirmDigest), f.runner.execute(preview.previewId, preview.confirmDigest)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 1);
    await assert.rejects(() => f.runner.execute(preview.previewId, preview.confirmDigest));
  } finally { await f.cleanup(); }
});

test('implementation upgrade invalidates an already-confirmed preview', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    f.context.fingerprint = 'implementation-v2';
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /Deployment/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 0);
  } finally { await f.cleanup(); }
});

test('balance or simulation changes after preview prevent wallet submission', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    f.context.client.getBalance = async () => 0n;
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /current estimated gas/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 0);
    f.context.client.getBalance = async () => 10n ** 20n;
    f.context.client.estimateGas = async () => { throw new Error('Simulation reverted'); };
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /Simulation reverted/);
    assert.equal((await f.runner.pending(walletAddress)).state, 'NO_LOCAL_RESERVATION');
  } finally { await f.cleanup(); }
});

test('preview expiring during validation never reaches wallet execute', async () => {
  const f = await fixture();
  const originalNow = Date.now;
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    f.context.client.estimateGas = async () => { Date.now = () => p.expiresAt + 1; return 21_000n; };
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /expired during validation/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 0);
    assert.equal((await f.runner.pending(walletAddress)).state, 'NO_LOCAL_RESERVATION');
  } finally { Date.now = originalNow; await f.cleanup(); }
});

test('disk failure before execute retains the reservation across process restart', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    const originalPut = f.store.put.bind(f.store);
    f.store.put = async (key, value: any) => {
      if (value.state === 'submission-unknown') throw new Error('Disk unavailable');
      return originalPut(key, value);
    };
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /Disk unavailable/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 0);
    const restarted = new Runner(f.runner.options, f.runner.wallet, new Store(f.store.dir));
    const pending = await restarted.pending(walletAddress);
    assert.equal('previewId' in pending && pending.previewId, p.previewId);
    assert.equal(pending.state, 'submission-unknown');
    assert.equal('nextAction' in pending && pending.nextAction, 'INVESTIGATE_WITHOUT_RESUBMITTING');
    assert.equal((await restarted.journal())[0].state, 'submission-unknown');
    await assert.rejects(() => f.runner.preview(1, 'deposit', '0.1'), /unresolved submission/);
  } finally { await f.cleanup(); }
});

test('unknown broadcast preserves a single-use guard across retries', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    f.setTimeout();
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /timed out/);
    assert.equal((await f.store.get(p.previewId)).state, 'submission-unknown');
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /already submitted/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 1);
    await assert.rejects(() => f.runner.preview(1, 'deposit', '0.1'), /unresolved submission/);
    await assert.rejects(() => f.runner.reconcile(p.previewId), /has not returned a transaction hash/);
    const pending = await f.runner.pending(walletAddress);
    assert.equal('previewId' in pending && pending.previewId, p.previewId);
  } finally { await f.cleanup(); }
});

test('a proven missing executable is recorded as not submitted and permits a fresh preview', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    const original = f.runner.wallet.call;
    f.runner.wallet.call = async () => { throw new AgentError('WALLET_CLI_NOT_FOUND', 'Missing baw', 'INSTALL_OFFICIAL_BAW', false); };
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /Missing baw/);
    assert.equal((await f.store.get(p.previewId)).state, 'NOT_SUBMITTED');
    assert.equal((await f.runner.pending(walletAddress)).state, 'NO_LOCAL_RESERVATION');
    f.runner.wallet.call = original;
    await f.runner.preview(1, 'deposit', '0.1');
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /already submitted/);
  } finally { await f.cleanup(); }
});

test('a second preview cannot bypass a wallet reservation', async () => {
  const f = await fixture();
  try {
    const first = await f.runner.preview(1, 'deposit', '0.1');
    const second = await f.runner.preview(1, 'deposit', '0.2');
    await f.runner.execute(first.previewId, first.confirmDigest);
    await assert.rejects(() => f.runner.execute(second.previewId, second.confirmDigest), /unresolved submission/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 1);
  } finally { await f.cleanup(); }
});

test('only matching canonical confirmed receipts release the wallet reservation', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    const sent = await f.runner.execute(p.previewId, p.confirmDigest);
    assert.ok('txHash' in sent);
    const client: any = f.context.client;
    let head = 101n;
    let input = '0xdead';
    client.getTransaction = async () => ({ from: walletAddress, to: p.call.to, input, value: BigInt(p.call.value) });
    client.getTransactionReceipt = async () => ({ status: 'success', blockNumber: 100n, blockHash: 'block', transactionHash: sent.txHash });
    client.getBlockNumber = async () => head;
    client.getBlock = async () => ({ hash: 'block' });
    await assert.rejects(() => f.runner.reconcile(p.previewId), /does not match/);
    input = p.call.data;
    assert.equal((await f.runner.reconcile(p.previewId)).state, 'AWAITING_CONFIRMATIONS');
    await assert.rejects(() => f.runner.preview(1, 'deposit', '0.1'), /unresolved submission/);
    head = 111n;
    assert.equal((await f.runner.reconcile(p.previewId)).state, 'CONFIRMED');
    const newer = await f.runner.preview(1, 'deposit', '0.1');
    await f.runner.execute(newer.previewId, newer.confirmDigest);
    assert.equal((await f.runner.reconcile(p.previewId)).state, 'CONFIRMED');
    await assert.rejects(() => f.runner.preview(1, 'deposit', '0.1'), /unresolved submission/);
  } finally { await f.cleanup(); }
});

test('ERC20 insufficient allowance creates an approval-only preview', async () => {
  const f = await fixture();
  try {
    f.context.status.auctionAsset = `0x${'66'.repeat(20)}`;
    f.context.client.readContract = async (args?: any) => {
      if (args.functionName === 'decimals') return 6 as any;
      if (args.functionName === 'allowance') return 1n as any;
      if (args.functionName === 'balanceOf') return 10n ** 20n as any;
      return { contributed: 1n, participantIndex: 0n, claimed: false };
    };
    const p = await f.runner.preview(1, 'deposit', '1');
    const call = decodeFunctionData({ abi: ERC20_ABI, data: p.call.data });
    assert.equal(call.functionName, 'approve');
    assert.deepEqual(call.args, [engine, 0n]);
    assert.equal(p.detail.step, 'approval-only');
    assert.equal(p.call.value, '0');
  } finally { await f.cleanup(); }
});

for (const mode of ['direct', 'app-confirmation'] as const) test(`${mode} login persists one scoped session without replaying its challenge`, async () => {
  const f = await fixture();
  try {
    const account = privateKeyToAccount(generatePrivateKey());
    let typed: any;
    let exchanges = 0;
    f.runner.wallet.preflight = async () => ({ address: account.address, settings: {} });
    const now = Math.floor(Date.now() / 1000);
    const challenge = {
      challenge_id: 'ab'.repeat(32), expires_at: now + 300,
      typed_data: {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
          JumpAgentLogin: [{ name: 'wallet', type: 'address' }, { name: 'nonce', type: 'bytes32' }, { name: 'audience', type: 'string' },
            { name: 'issuedAt', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' }, { name: 'purpose', type: 'string' }],
        }, primaryType: 'JumpAgentLogin', domain: { name: 'Jump Agent Login', version: '1', chainId: 56 },
        message: { wallet: account.address, nonce: `0x${'ab'.repeat(32)}`, audience: 'jump-platform', issuedAt: now, expiresAt: now + 300,
          purpose: 'Authenticate with Jump. No transaction or token approval.' },
      },
    };
    // Preserve semantic validation independent from the provider double.
    validateLoginChallenge(challenge, account.address, 56, 'jump-platform');
    f.runner.api.request = async (path, options) => {
      if (path.endsWith('/challenge')) return challenge;
      assert.equal(path, '/auth/agent/login');
      exchanges++;
      assert.equal((options?.body as any).signature.length, 132);
      return { access_token: 'synthetic-jump-token', expires_in: 1800 };
    };
    f.runner.wallet.call = async args => {
      if (args[1] === 'preview') {
        typed = JSON.parse(JSON.parse(args[args.indexOf('--message') + 1]).params[1]);
        return { requestId: 'login-request', expiresAt: Date.now() + 60_000 };
      }
      if (mode === 'app-confirmation' && args[1] === 'execute') return { status: 'PENDING_CONFIRMATION', orderId: 'login-order' };
      const signature = await account.signTypedData(typed);
      return { status: 'COMPLETED', signature: signature.slice(2, 130), signatureRecovery: signature.slice(130) };
    };
    const p = await f.runner.loginPreview();
    const result = await f.runner.execute(p.previewId, p.confirmDigest);
    assert.equal(result.status, mode === 'direct' ? 'AUTHENTICATED' : 'PENDING_CONFIRMATION');
    if (mode === 'app-confirmation') {
      const results = await Promise.allSettled([f.runner.result(p.previewId), f.runner.result(p.previewId)]);
      assert.ok(results.some(result => result.status === 'fulfilled'));
    }
    assert.equal(exchanges, 1);
    assert.equal(JSON.stringify(result).includes('synthetic-jump-token'), false);
    const stored = await f.store.get(sessionKey(f.runner.api.base, 56, account.address));
    assert.equal(stored.token, 'synthetic-jump-token');
    const completed = await f.runner.result(p.previewId);
    assert.ok('state' in completed);
    assert.equal(completed.state, 'AUTHENTICATED');
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest));
  } finally { await f.cleanup(); }
});

test('journal survives restart without revealing signatures or another API scope', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    const record = await f.store.get(p.previewId);
    record.result = { signature: 'private-signature-sentinel', access_token: 'private-token-sentinel' };
    await f.store.put(p.previewId, record);
    await f.store.put(randomUUID(), { ...record, plan: { ...record.plan, api: 'https://other.example' } });
    const callCount = f.calls.length;
    const entries = await f.runner.journal();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].previewId, p.previewId);
    assert.equal(entries[0].nextAction, 'REVIEW_AND_CONFIRM');
    assert.equal(JSON.stringify(entries).includes('sentinel'), false);
    assert.equal(f.calls.length, callCount);
  } finally { await f.cleanup(); }
});

test('wallet history is investigative only and works without Developer Mode', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    await f.runner.execute(p.previewId, p.confirmDigest);
    f.runner.wallet.preflight = async () => { throw new Error('Developer Mode expired'); };
    const hash = `0x${'ab'.repeat(32)}`;
    f.runner.wallet.call = async args => {
      assert.deepEqual(args.slice(0, 2), ['wallet', 'tx-history']);
      return { transactions: [{ binanceChainId: '56', txHash: hash }, { binanceChainId: '97', txHash: `0x${'cd'.repeat(32)}` }], hasMore: false };
    };
    (f.context.client as any).getTransaction = async () => ({ from: walletAddress, to: p.call.to, input: p.call.data, value: BigInt(p.call.value) });
    const result = await f.runner.history(p.previewId);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].intentMatches, true);
    assert.equal(result.candidates[0].orderBinding, 'UNVERIFIED');
    assert.equal(result.reservationReleased, false);
    assert.equal((await f.store.get(p.previewId)).state, 'BROADCASTED');
  } finally { await f.cleanup(); }
});

test('lost shared dispatch acknowledgement never reaches the wallet execute command', async () => {
  const f = await fixture();
  try {
    const p = await f.runner.preview(1, 'deposit', '0.1');
    f.runner.api.request = async path => {
      if (path === '/agent/v1/reservations') return { operation_id: '00000000-0000-4000-8000-000000000001' };
      throw new Error('Dispatch acknowledgement lost');
    };
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /acknowledgement lost/);
    assert.equal(f.calls.filter(c => c[1] === 'execute').length, 0);
    assert.equal((await f.store.get(p.previewId)).remoteOperationId, '00000000-0000-4000-8000-000000000001');
    await assert.rejects(() => f.runner.execute(p.previewId, p.confirmDigest), /already submitted/);
  } finally { await f.cleanup(); }
});

test('read-only domain resolution validates provider identity and preserves fallback warning', async () => {
  const f = await fixture();
  try {
    f.runner.wallet.call = async () => ({ name: 'alice.ai', binanceChainId: '56', address: walletAddress, isFallback: true, addressType: 'EOA' });
    const result = await f.runner.resolveDomain('alice.ai');
    assert.equal(result.address, walletAddress);
    assert.equal(result.isFallback, true);
    assert.equal(result.verifiedAgentIdentity, false);
    await assert.rejects(() => f.runner.resolveDomain('bob.ai'), /Unsupported domain/);
  } finally { await f.cleanup(); }
});

test('dual-approved server closure synchronizes only the matching local reservation', async () => {
  const f = await fixture();
  try {
    const preview = await f.runner.preview(1, 'deposit', '0.1');
    f.setTimeout();
    await assert.rejects(() => f.runner.execute(preview.previewId, preview.confirmDigest), /timed out/);
    const record = await f.store.get(preview.previewId);
    f.runner.api.request = async () => ({ operation_id: record.remoteOperationId, chain_id: 56, wallet: walletAddress,
      state: 'MANUALLY_CLOSED', guard_active: false });
    assert.equal((await f.runner.result(preview.previewId)).state, 'MANUALLY_CLOSED');
    assert.equal((await f.runner.pending(walletAddress)).state, 'NO_LOCAL_RESERVATION');
    const next = await f.runner.preview(1, 'deposit', '0.1');
    assert.ok(next.previewId);
  } finally { await f.cleanup(); }
});

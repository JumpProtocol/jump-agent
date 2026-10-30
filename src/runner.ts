import { createHash, randomUUID } from 'node:crypto';
import { createPublicClient, getAddress, http, keccak256, zeroAddress, formatUnits } from 'viem';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import { JumpApi, safeUrl } from './api';
import { BinanceWallet, normalizeSignature } from './wallet';
import { Store, sessionKey, submissionKey } from './store';
import { AUCTION_ENGINE_ABI, ERC20_ABI, approvalCall, assertActionState, auctionCall, exactAmount, uint } from './shared/auction';
import type { AllocationProof, AuctionAction, EncodedCall } from './shared/auction';
import { LAUNCH_FACTORY_ABI } from './abis/LaunchFactory';
import { historyHashes, journalEntry, matchesIntent, nextAction } from './recovery';
import { AgentError, publicError } from './errors';

export interface Options { api: string; chainId: string; rpc?: string; engine?: string; factory?: string; audience: string }
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => getAddress(value));
const rawAmount = z.string().regex(/^\d+$/);
const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(v => v as Hex);
const tokenSchema = z.object({ id: z.number().int().positive(), launch_id: z.number().int().positive(),
  chain_id: z.number().int(), token_address: address });
const proofSchema = z.object({ allocation_version: z.literal(2), launch_id: z.number().int().positive(),
  participant_index: z.number().int().nonnegative(), participant_address: address,
  contributed_wei: rawAmount, accepted_wei: rawAmount, refund_wei: rawAmount, token_amount: rawAmount,
  merkle_proof: z.array(hex32).max(256), merkle_proof_sums: z.array(rawAmount).max(256),
  merkle_proof_token_sums: z.array(rawAmount).max(256) });
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v));

export function chainId(options: Options) {
  const id = Number(options.chainId);
  if (![56, 97].includes(id)) throw new Error('Jump supports only BSC 56 and 97');
  return id;
}

export function previewExpiry(provider: any, now = Date.now()) {
  const n = Number(provider.expiresAt);
  const expiry = n < 1e12 ? n * 1000 : n;
  if (typeof provider.requestId !== 'string' || !provider.requestId || !Number.isFinite(expiry) || expiry <= now) throw new Error('Wallet preview is missing a valid request ID or expiry');
  return Math.min(expiry, now + 120_000);
}

export function validateLoginChallenge(challenge: any, wallet: Address, chain: number, audience: string) {
  const data = challenge.typed_data;
  const expectedTypes = {
    EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
    JumpAgentLogin: [{ name: 'wallet', type: 'address' }, { name: 'nonce', type: 'bytes32' },
      { name: 'audience', type: 'string' }, { name: 'issuedAt', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' }, { name: 'purpose', type: 'string' }],
  };
  const now = Math.floor(Date.now() / 1000);
  if (!/^[a-f0-9]{64}$/.test(challenge.challenge_id) || data?.primaryType !== 'JumpAgentLogin' ||
      JSON.stringify(data.types) !== JSON.stringify(expectedTypes) ||
      JSON.stringify(data.domain) !== JSON.stringify({ name: 'Jump Agent Login', version: '1', chainId: chain }) ||
      getAddress(data.message.wallet) !== wallet || data.message.audience !== audience ||
      data.message.nonce !== `0x${challenge.challenge_id}` || data.message.expiresAt !== challenge.expires_at ||
      data.message.purpose !== 'Authenticate with Jump. No transaction or token approval.' ||
      !Number.isInteger(data.message.issuedAt) || data.message.issuedAt > now + 30 ||
      !Number.isInteger(challenge.expires_at) || challenge.expires_at <= now || challenge.expires_at > now + 300 ||
      challenge.expires_at - data.message.issuedAt !== 300 || Object.keys(data.message).length !== 6) {
    throw new Error('Jump returned an unexpected login challenge; no signature requested');
  }
}

export class Runner {
  readonly api: JumpApi;
  constructor(readonly options: Options, readonly wallet = new BinanceWallet(), readonly store = new Store()) {
    chainId(options); this.api = new JumpApi(options.api);
  }

  async session(wallet: Address) {
    const session = await this.store.get(sessionKey(this.api.base, chainId(this.options), wallet)).catch(() => null);
    if (!session || typeof session.token !== 'string' || !session.token || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new Error('Jump login expired. Run login preview, then execute');
    return session.token as string;
  }

  async rpcClient() {
    if (!this.options.rpc) throw new Error('Set --rpc using verified chain configuration');
    const rpc = safeUrl(this.options.rpc);
    const client = createPublicClient({ transport: http(rpc.href, { timeout: 10_000, retryCount: 0 }) });
    if (await client.getChainId() !== chainId(this.options)) throw new Error('RPC chain mismatch');
    return client;
  }

  private async deployment(client: Awaited<ReturnType<Runner['rpcClient']>>) {
    if (!this.options.engine || !this.options.factory) throw new Error('Set --rpc, --engine and --factory using verified deployment configuration');
    const engine = address.parse(this.options.engine), factory = address.parse(this.options.factory);
    if (engine === zeroAddress || factory === zeroAddress) throw new Error('Deployment addresses must be nonzero');
    const configs = await this.api.request('/chains');
    const config = z.array(z.object({ chain_id: z.number(), auction_engine: address, launch_factory: address })).parse(configs)
      .find(c => c.chain_id === chainId(this.options));
    if (!config || config.auction_engine !== engine || config.launch_factory !== factory) throw new Error('API deployment differs from pinned contract addresses');
    return { engine, factory, fingerprint: await this.fingerprint(client, engine, factory) };
  }

  /** Read-only deployment diagnostics. Never requests wallet identity, signatures or challenges. */
  async doctor() {
    const checks: { name: string; status: 'PASS' | 'FAIL'; error?: ReturnType<typeof publicError>; details?: unknown }[] = [];
    const check = async (name: string, action: () => Promise<unknown>) => {
      try { checks.push({ name, status: 'PASS', details: json(await action()) }); }
      catch (error) { checks.push({ name, status: 'FAIL', error: publicError(error) }); }
    };
    await check('local-state', async () => { await this.store.init(); return { privateDirectory: true }; });
    await check('deployment', async () => {
      const client = await this.rpcClient();
      const [deployment, block] = await Promise.all([this.deployment(client), client.getBlock()]);
      const ageSeconds = Math.floor(Date.now() / 1000) - Number(block.timestamp);
      if (!Number.isSafeInteger(ageSeconds) || ageSeconds < -30 || ageSeconds > 120) throw new Error('RPC latest block is stale or clock differs; verify RPC and system time');
      return { chainId: chainId(this.options), engine: deployment.engine, factory: deployment.factory,
        deploymentFingerprint: deployment.fingerprint, observedBlock: block.number, ageSeconds };
    });
    return { status: checks.every(c => c.status === 'PASS') ? 'READ_ONLY_CHECKS_PASSED' : 'CHECKS_FAILED', checks,
      walletContacted: false, liveWalletAcceptance: 'NOT_ESTABLISHED',
      note: 'Checks verify configured endpoints and local storage, not deployment trust, wallet availability or live execution.' };
  }

  async context(tokenId: number) {
    if (!Number.isSafeInteger(tokenId) || tokenId <= 0) throw new Error('Invalid token database ID');
    const client = await this.rpcClient();
    const [deployment, data, block] = await Promise.all([
      this.deployment(client), this.api.request(`/tokens/${tokenId}?chain_id=${chainId(this.options)}`), client.getBlock(),
    ]);
    const { engine, factory, fingerprint } = deployment;
    const token = tokenSchema.parse(data);
    if (token.id !== tokenId || token.chain_id !== chainId(this.options)) throw new Error('API token identity mismatch');
    const launchId = uint(token.launch_id);
    const [status, canonicalToken] = await Promise.all([
      client.readContract({ address: engine, abi: AUCTION_ENGINE_ABI, functionName: 'getAuctionStatus', args: [launchId] }),
      client.readContract({ address: factory, abi: LAUNCH_FACTORY_ABI, functionName: 'getTokenByLaunchId', args: [launchId] }),
    ]);
    if (getAddress(canonicalToken) !== token.token_address || canonicalToken === zeroAddress) throw new Error('On-chain launch token differs from API');
    return { client, engine, factory, token, launchId, status, block, fingerprint };
  }

  private async fingerprint(client: ReturnType<typeof createPublicClient>, ...contracts: Address[]) {
    const entries = await Promise.all(contracts.map(async contract => {
      const [code, slot] = await Promise.all([client.getCode({ address: contract }), client.getStorageAt({ address: contract, slot: IMPLEMENTATION_SLOT })]);
      if (!code || code === '0x' || !slot || slot.length !== 66) throw new Error('Cannot verify deployment');
      const implementation = getAddress(`0x${slot.slice(-40)}`);
      const implementationCode = await client.getCode({ address: implementation });
      if (!implementationCode || implementationCode === '0x') throw new Error('Cannot verify proxy implementation');
      return { contract, code: keccak256(code), implementation, implementationCode: keccak256(implementationCode) };
    }));
    return digest(entries);
  }

  async info(tokenId: number) {
    const c = await this.context(tokenId);
    return json({ token: c.token, status: c.status, observedBlock: c.block.number, deploymentFingerprint: c.fingerprint });
  }

  async quote(tokenId: number, wallet: string, amount: string) {
    const c = await this.context(tokenId);
    const decimals = c.status.auctionAsset === zeroAddress ? 18 : Number(await c.client.readContract({ address: c.status.auctionAsset, abi: ERC20_ABI, functionName: 'decimals' }));
    const raw = exactAmount(amount, decimals);
    const estimate = await this.api.request(`/tokens/${tokenId}/auction/estimate/${getAddress(wallet)}?chain_id=${chainId(this.options)}&additional_amount=${formatUnits(raw, decimals)}`);
    return { auctionAsset: c.status.auctionAsset, amountRaw: raw.toString(), decimals, estimate,
      estimateSource: 'Jump canonical capped allocation; indexed snapshot, not a guaranteed fill', observedBlock: String(c.block.number) };
  }

  private async prepare(tokenId: number, action: AuctionAction, wallet: Address, amount?: string) {
    const c = await this.context(tokenId);
    assertActionState(action, c.status, c.block.timestamp);
    const position = await c.client.readContract({ address: c.engine, abi: AUCTION_ENGINE_ABI, functionName: 'getContributionInfo', args: [c.launchId, wallet] });
    if (action !== 'deposit' && action !== 'deferred-refund' && (position.claimed || position.contributed === 0n)) throw new Error('No outstanding participation');
    let call: EncodedCall, detail: unknown;
    if (action === 'deposit' || action === 'withdraw') {
      const decimals = c.status.auctionAsset === zeroAddress ? 18 : Number(await c.client.readContract({ address: c.status.auctionAsset, abi: ERC20_ABI, functionName: 'decimals' }));
      if (!amount) throw new Error('Amount is required');
      const raw = exactAmount(amount, decimals);
      if (action === 'withdraw' && raw > position.contributed) throw new Error('Withdrawal exceeds contribution');
      call = auctionCall(c.engine, c.launchId, action, { amount: raw, asset: c.status.auctionAsset });
      detail = { asset: c.status.auctionAsset, decimals, amount, amountRaw: String(raw), finalAcceptedCap: String(c.status.individualCapQuote) };
      if (action === 'deposit' && c.status.auctionAsset !== zeroAddress) {
        const [allowance, tokenBalance] = await Promise.all([
          c.client.readContract({ address: c.status.auctionAsset, abi: ERC20_ABI, functionName: 'allowance', args: [wallet, c.engine] }),
          c.client.readContract({ address: c.status.auctionAsset, abi: ERC20_ABI, functionName: 'balanceOf', args: [wallet] }),
        ]);
        if (tokenBalance < raw) throw new Error('Insufficient auction asset balance');
        if (allowance < raw) {
          const approval = allowance === 0n ? raw : 0n;
          call = approvalCall(c.status.auctionAsset, c.engine, approval);
          detail = { ...detail as object, step: 'approval-only', approvedRaw: String(approval), spender: c.engine,
            next: 'After confirmation, run deposit preview again. This preview does not deposit funds.' };
        }
      }
    } else {
      let proof: AllocationProof | undefined;
      if (action === 'claim') proof = proofSchema.parse(await this.api.request(`/agent/v1/allocation/${tokenId}`, { token: await this.session(wallet) }));
      call = auctionCall(c.engine, c.launchId, action, { proof, participant: wallet });
      detail = action === 'claim' ? { acceptedRaw: proof!.accepted_wei, refundRaw: proof!.refund_wei, tokenRaw: proof!.token_amount } : { action };
    }
    return { c, call, detail };
  }

  async preview(tokenId: number, action: AuctionAction, amount?: string) {
    const { address: wallet } = await this.wallet.preflight(chainId(this.options));
    if (await this.store.optional(submissionKey(chainId(this.options), wallet))) throw new Error('Wallet has an unresolved submission; use result/reconcile first');
    const { c, call, detail } = await this.prepare(tokenId, action, wallet, amount);
    const [gas, gasPrice, balance] = await Promise.all([
      c.client.estimateGas({ account: wallet, ...call }), c.client.getGasPrice(), c.client.getBalance({ address: wallet }),
    ]);
    if (balance < call.value + gas * gasPrice) throw new Error('Insufficient BNB for value plus estimated gas');
    const provider = await this.wallet.call(['contract-call', 'preview', '--binanceChainId', String(chainId(this.options)),
      '--from', wallet, '--to', call.to, '--value', String(call.value), '--inputData', call.data]);
    const plan = json({ kind: 'transaction', api: this.api.base, chainId: chainId(this.options), wallet, tokenId, action, amount,
      call, deploymentFingerprint: c.fingerprint, detail, observedBlock: c.block.number, gas, gasPrice,
      provider, expiresAt: previewExpiry(provider) });
    const id = randomUUID();
    await this.store.put(id, { plan, digest: digest(plan), state: 'previewed' });
    return { previewId: id, confirmDigest: digest(plan), ...plan };
  }

  async loginPreview() {
    const { address: wallet } = await this.wallet.preflight(chainId(this.options));
    const challenge = await this.api.request('/auth/agent/challenge', { body: { wallet_address: wallet, chain_id: chainId(this.options) } });
    validateLoginChallenge(challenge, wallet, chainId(this.options), this.options.audience);
    const provider = await this.wallet.call(['sign-message', 'preview', '--binanceChainId', String(chainId(this.options)),
      '--signType', 'EIP712', '--message', JSON.stringify({ method: 'eth_signTypedData_v4', params: [wallet, JSON.stringify(challenge.typed_data)] })]);
    const plan = { kind: 'login', api: this.api.base, chainId: chainId(this.options), wallet, challenge, provider,
      expiresAt: Math.min(previewExpiry(provider), challenge.expires_at * 1000) };
    const id = randomUUID();
    await this.store.put(id, { plan, digest: digest(plan), state: 'previewed' });
    return { previewId: id, confirmDigest: digest(plan), ...plan };
  }

  async execute(id: string, confirmedDigest: string) {
    const record = await this.store.get(id);
    const { plan } = record;
    if (record.state !== 'previewed' || digest(plan) !== record.digest || record.digest !== confirmedDigest) throw new Error('Preview changed or already submitted; do not retry');
    if (plan.api !== this.api.base || plan.chainId !== chainId(this.options) || plan.expiresAt <= Date.now()) throw new Error('Preview scope mismatch or expired; preview again');
    const { address: wallet } = await this.wallet.preflight(chainId(this.options));
    if (plan.wallet !== wallet) throw new Error('Wallet changed; preview again');
    if (plan.kind === 'transaction') {
      const { c, call } = await this.prepare(plan.tokenId, plan.action, wallet, plan.amount);
      if (c.fingerprint !== plan.deploymentFingerprint || digest(json(call)) !== digest(plan.call)) throw new Error('Deployment or required transaction changed; preview again');
      const [gas, gasPrice, balance] = await Promise.all([
        c.client.estimateGas({ account: wallet, ...call }), c.client.getGasPrice(), c.client.getBalance({ address: wallet }),
      ]);
      if (balance < call.value + gas * gasPrice) throw new Error('Insufficient BNB for value plus current estimated gas');
    } else if (plan.kind === 'login') {
      validateLoginChallenge(plan.challenge, wallet, chainId(this.options), this.options.audience);
    } else throw new Error('Invalid preview kind');
    if (plan.expiresAt <= Date.now()) throw new Error('Preview expired during validation; preview again');
    // Claim on disk BEFORE signing/broadcast. A crash or timeout leaves an uncertain record, never an automatic retry.
    if (plan.kind === 'transaction') await this.store.reserve(submissionKey(plan.chainId, wallet), id);
    try { await this.store.claim(id); }
    catch (error) {
      if (plan.kind === 'transaction') await this.store.release(submissionKey(plan.chainId, wallet), id);
      throw error;
    }
    record.state = 'submission-unknown';
    record.submittedAt = Date.now();
    await this.store.put(id, record);
    if (plan.kind === 'transaction') {
      // Fail closed: every updated installation and hosted session shares this SQL guard.
      // Persist the reservation ID before requesting dispatch; an ambiguous ACK is never retried.
      const token = await this.session(wallet);
      const reservation = await this.api.request('/agent/v1/reservations', { token, body: {
        chain_id: plan.chainId, token_id: plan.tokenId, action: plan.action,
        ...(plan.amount !== undefined ? { amount: plan.amount } : {}),
        call: plan.call, provider_request_id: plan.provider.requestId,
      } });
      if (typeof reservation.operation_id !== 'string' || !/^[a-f0-9-]{36}$/.test(reservation.operation_id)) throw new Error('Invalid shared reservation; no wallet execute requested');
      record.remoteOperationId = reservation.operation_id;
      await this.store.put(id, record);
      const dispatch = await this.api.request(`/agent/v1/reservations/${record.remoteOperationId}/dispatch`, { token, body: {} });
      if (dispatch.operation_id !== record.remoteOperationId || dispatch.state !== 'SUBMISSION_UNKNOWN' || dispatch.guard_active !== true) throw new Error('Shared dispatch not acknowledged; never execute or retry');
    }
    let result;
    try {
      result = await this.wallet.call([plan.kind === 'login' ? 'sign-message' : 'contract-call', 'execute', '--requestId', plan.provider.requestId]);
    } catch (error) {
      record.lastError = publicError(error);
      if (error instanceof AgentError && error.code === 'WALLET_CLI_NOT_FOUND' && !error.submissionMayHaveOccurred) {
        record.state = 'NOT_SUBMITTED';
        if (plan.kind === 'transaction') await this.store.complete(submissionKey(plan.chainId, wallet), id, record);
        else await this.store.put(id, record);
      } else await this.store.put(id, record);
      throw error;
    }
    record.result = result; record.state = typeof result.status === 'string' ? result.status : 'submission-unknown';
    await this.store.put(id, record);
    if (record.remoteOperationId) {
      try { await this.reportRemote(record, false); }
      catch { record.coordinationWarning = 'Shared result update unavailable; never repeat execute. Run reconcile later.'; await this.store.put(id, record); }
    }
    if (plan.kind === 'login' && result.signature) return this.finishLogin(record, id);
    return { previewId: id, status: result.status, orderId: result.orderId, txHash: result.txHash,
      next: 'Check the App, then use result or tx status. Broadcast is not confirmation.' };
  }

  private async reportRemote(record: any, reconcile: boolean) {
    const { plan } = record;
    const shared = await this.api.request(`/agent/v1/reservations/${record.remoteOperationId}/result`, {
      token: await this.session(plan.wallet), body: { reconcile,
        ...(record.result ? { result: Object.fromEntries(['status', 'orderId', 'txHash'].filter(k => record.result[k] != null).map(k => [k, record.result[k]])) } : {}),
      },
    });
    if (shared.operation_id !== record.remoteOperationId || shared.chain_id !== plan.chainId ||
        typeof shared.wallet !== 'string' || getAddress(shared.wallet) !== plan.wallet || typeof shared.guard_active !== 'boolean') {
      throw new Error('Shared recovery identity mismatch; local wallet guard retained');
    }
    return shared;
  }

  private async finishLogin(record: any, id: string) {
    return this.store.locked(`login-${id}`, async () => {
      record = await this.store.get(id);
      if (record.state === 'AUTHENTICATED') return { status: 'AUTHENTICATED', wallet: record.plan.wallet };
      const { plan, result } = record;
      const signature = normalizeSignature(result.signature, result.signatureRecovery);
      const token = await this.api.request('/auth/agent/login', { body: { challenge_id: plan.challenge.challenge_id, signature } });
      if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Invalid Jump login response');
      await this.store.put(sessionKey(this.api.base, plan.chainId, plan.wallet), { token: token.access_token,
        expiresAt: Date.now() + Math.min(token.expires_in, 1800) * 1000 });
      record.state = 'AUTHENTICATED';
      record.result = { status: 'COMPLETED', orderId: result.orderId };
      await this.store.update(id, () => record);
      return { status: 'AUTHENTICATED', wallet: plan.wallet, expiresIn: Math.min(token.expires_in, 1800) };
    });
  }

  async result(id: string) {
    const record = await this.store.get(id);
    if (record.plan.api !== this.api.base || record.plan.chainId !== chainId(this.options)) throw new Error('Preview scope mismatch');
    if (digest(record.plan) !== record.digest) throw new Error('Stored preview changed');
    if (record.state === 'previewed' && await this.store.isClaimed(id)) record.state = 'submission-unknown';
    if (record.state === 'MANUALLY_CLOSED') return journalEntry(id, record);
    if (record.plan.kind === 'transaction' && record.remoteOperationId) {
      const shared = await this.reportRemote(record, false);
      if (shared.state === 'MANUALLY_CLOSED' && shared.guard_active === false) {
        record.state = 'MANUALLY_CLOSED';
        await this.store.complete(submissionKey(record.plan.chainId, record.plan.wallet), id, record);
        return journalEntry(id, record);
      }
      if (shared.tx_hash) {
        const originalHash = hex32.parse(shared.tx_hash);
        if (record.result?.txHash && record.result.txHash.toLowerCase() !== originalHash.toLowerCase()) throw new Error('Original shared hash changed; guard retained');
        record.result = { ...record.result, txHash: originalHash, ...(shared.order_id ? { orderId: shared.order_id } : {}) };
        await this.store.put(id, record);
      }
    }
    if (record.plan.kind === 'login' && ['AUTHENTICATED', 'REJECTED', 'EXPIRED'].includes(record.state)) return journalEntry(id, record);
    if (record.plan.kind === 'login' && record.state !== 'AUTHENTICATED' && record.result?.orderId && !record.result.signature) {
      const result = await this.wallet.call(['sign-message', 'result', '--order-id', record.result.orderId]);
      const updated = await this.store.update(id, current => current.state === 'AUTHENTICATED' ? current : {
        ...current, result, state: typeof result.status === 'string' ? result.status : 'submission-unknown',
      });
      if (updated.result?.signature) return this.finishLogin(updated, id);
      return journalEntry(id, updated);
    }
    return { state: record.state, orderId: record.result?.orderId, txHash: record.result?.txHash,
      nextAction: nextAction(record.state, record.plan.kind, !!record.result?.txHash),
      next: 'For unknown submissions, inspect history and the chain without resubmitting.' };
  }

  async reconcile(id: string) {
    const record = await this.store.get(id);
    const { plan } = record;
    if (plan.kind !== 'transaction' || plan.api !== this.api.base || plan.chainId !== chainId(this.options)) throw new Error('Transaction scope mismatch');
    if (digest(plan) !== record.digest) throw new Error('Stored transaction plan changed');
    if (!record.result?.txHash) throw new Error('Provider has not returned a transaction hash. Check the App/order with Binance; the wallet reservation remains in place');
    const hash = hex32.parse(record.result.txHash);
    // Only the provider-returned hash is eligible. A supplied historical lookalike must not clear an unknown order.
    const client = await this.rpcClient();
    const [transaction, receipt, head] = await Promise.all([
      client.getTransaction({ hash }), client.getTransactionReceipt({ hash }), client.getBlockNumber(),
    ]);
    if (!matchesIntent(transaction, plan) || receipt.transactionHash !== hash) {
      throw new Error('Receipt does not match the submitted transaction');
    }
    const canonical = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (canonical.hash !== receipt.blockHash) throw new Error('Receipt is not in the canonical chain');
    const confirmations = head - receipt.blockNumber + 1n;
    if (confirmations < 12n) return json({ state: 'AWAITING_CONFIRMATIONS', confirmations, required: 12, txHash: hash });
    if (receipt.status !== 'success' && receipt.status !== 'reverted') throw new Error('Unknown receipt status');
    if (record.remoteOperationId) {
      const shared = await this.reportRemote(record, true);
      if (shared.guard_active || !['CONFIRMED', 'REVERTED'].includes(shared.state)) throw new Error('Shared receipt verification is still pending; wallet reservation retained');
    }
    record.state = receipt.status === 'success' ? 'CONFIRMED' : 'REVERTED';
    await this.store.complete(submissionKey(plan.chainId, plan.wallet), id, record);
    return json({ state: record.state, confirmations, txHash: hash });
  }

  async preflight() {
    const { address, settings } = await this.wallet.preflight(chainId(this.options));
    return { address, chainId: chainId(this.options), developerMode: settings.devMode,
      developerModeQuotaUsed: settings.developerModeQuotaUsed, tradeAllTokens: settings.tradeAllTokens,
      sessionExpireTime: settings.sessionExpireTime, pending: await this.store.optional(submissionKey(chainId(this.options), address)),
      integrationStatus: 'requires-live-wallet-acceptance' };
  }

  async list(page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid page');
    return this.api.request(`/tokens?chain_id=${chainId(this.options)}&page=${page}&limit=20`);
  }

  async resolveDomain(name: string) {
    if (typeof name !== 'string' || name.length > 253 || !name.includes('.') || /[\s/\\]/.test(name)) throw new Error('Enter a domain name');
    const result = await this.wallet.call(['wallet', 'resolve-domain', '--name', name, '--binanceChainId', String(chainId(this.options))]);
    if (result?.name !== name || String(result.binanceChainId) !== String(chainId(this.options)) || typeof result.isFallback !== 'boolean' ||
        !['EOA', 'CONTRACT', 'UNKNOWN'].includes(result.addressType)) throw new Error('Unsupported domain response; do not assume an address');
    return { name, chainId: chainId(this.options), address: getAddress(result.address), isFallback: result.isFallback,
      addressType: result.addressType, purpose: 'READ_ONLY_LOOKUP', verifiedAgentIdentity: false };
  }

  async position(wallet: string) {
    return this.api.request(`/portfolio/${getAddress(wallet)}?chain_id=${chainId(this.options)}`);
  }

  async journal(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Journal limit must be 1–100');
    return (await this.store.previews()).filter(({ record }) => record.plan?.api === this.api.base &&
      record.plan.chainId === chainId(this.options)).slice(0, limit).map(({ id, record, claimed }) =>
        journalEntry(id, claimed && record.state === 'previewed' ? { ...record, state: 'submission-unknown' } : record));
  }

  async pending(wallet: string) {
    const pending = await this.store.optional(submissionKey(chainId(this.options), getAddress(wallet)));
    if (!pending) return { state: 'NO_LOCAL_RESERVATION' };
    const record = await this.store.get(pending.previewId);
    if (record.plan?.wallet !== getAddress(wallet) || record.plan?.chainId !== chainId(this.options) || digest(record.plan) !== record.digest) throw new Error('Pending operation record is inconsistent');
    return { ...journalEntry(pending.previewId, record.state === 'previewed' ? { ...record, state: 'submission-unknown' } : record), api: record.plan.api,
      configuredApiMatches: record.plan.api === this.api.base };
  }

  async history(id: string, cursor?: string) {
    const record = await this.store.get(id);
    const { plan } = record;
    if (plan.kind !== 'transaction' || plan.api !== this.api.base || plan.chainId !== chainId(this.options) || digest(plan) !== record.digest) throw new Error('Transaction scope mismatch');
    if (!Number.isSafeInteger(record.submittedAt)) throw new Error('No recorded submission time; inspect this preview without resubmitting');
    if (cursor !== undefined && !/^[A-Za-z0-9_:=+./-]{1,2048}$/.test(cursor)) throw new Error('Invalid history cursor');
    if (await this.wallet.identity(plan.chainId) !== plan.wallet) throw new Error('Wallet changed; use the original wallet to inspect its history');
    const response = await this.wallet.call(['wallet', 'tx-history', '--binanceChainId', String(plan.chainId), '--size', '100',
      '--startTime', String(Math.max(1_577_836_800_000, record.submittedAt - 5000)), ...(cursor ? ['--nextCursor', cursor] : [])]);
    const hashes = historyHashes(response, plan.chainId);
    const client = await this.rpcClient();
    // Bounded parallel RPC work. Matching intent does not prove order identity.
    const candidates = await Promise.all(hashes.slice(0, 10).map(async hash => {
      try {
        const transaction = await client.getTransaction({ hash: hash as Hex });
        return { txHash: hash, intentMatches: matchesIntent(transaction, plan), orderBinding: 'UNVERIFIED' };
      } catch { return { txHash: hash, intentMatches: null, lookup: 'UNAVAILABLE', orderBinding: 'UNVERIFIED' }; }
    }));
    return { previewId: id, orderId: record.result?.orderId, candidates,
      hasMore: response.hasMore === true, nextCursor: typeof response.nextCursor === 'string' ? response.nextCursor : undefined,
      inspectedHashes: Math.min(10, hashes.length), pageHashes: hashes.length,
      uninspectedHashes: hashes.slice(10),
      reservationReleased: false, nextAction: 'VERIFY_ORIGINAL_ORDER_WITH_PROVIDER',
      note: 'History matches are investigative evidence only. They do not replace the original order hash or unlock this wallet.' };
  }
}

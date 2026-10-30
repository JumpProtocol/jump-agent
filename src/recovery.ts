import { getAddress } from 'viem';

export function nextAction(state: string, kind: string, hasHash = false) {
  if (['AUTHENTICATED', 'CONFIRMED', 'REVERTED'].includes(state)) return 'COMPLETE';
  if (['REJECTED', 'EXPIRED'].includes(state) && kind === 'login') return 'CREATE_NEW_LOGIN_PREVIEW';
  if (state === 'previewed') return 'REVIEW_AND_CONFIRM';
  if (state === 'NOT_SUBMITTED') return 'INSTALL_WALLET_AND_CREATE_NEW_PREVIEW';
  if (hasHash && kind === 'transaction') return 'RECONCILE_RECEIPT';
  if (state === 'PENDING_CONFIRMATION') return 'WAIT_FOR_APP';
  return 'INVESTIGATE_WITHOUT_RESUBMITTING';
}

export function matchesIntent(transaction: any, plan: any) {
  return !!transaction.to && getAddress(transaction.from) === plan.wallet &&
    getAddress(transaction.to) === plan.call.to && transaction.input === plan.call.data &&
    transaction.value === BigInt(plan.call.value);
}

/** Deliberately omits calldata, signatures, typed messages, API tokens and provider payloads. */
export function journalEntry(previewId: string, record: any) {
  const { plan } = record;
  return { previewId, kind: plan.kind, chainId: plan.chainId, wallet: plan.wallet,
    tokenId: plan.tokenId, action: plan.action, state: record.state, expiresAt: plan.expiresAt,
    submittedAt: record.submittedAt, orderId: record.result?.orderId, txHash: record.result?.txHash,
    errorCode: typeof record.lastError?.code === 'string' ? record.lastError.code : undefined,
    nextAction: nextAction(record.state, plan.kind, !!record.result?.txHash) };
}

export function historyHashes(history: any, chain: number): string[] {
  if (!Array.isArray(history?.transactions) || history.transactions.length > 100) throw new Error('Unsupported wallet history response');
  const hashes = new Set<string>();
  const add = (row: any) => {
    if (String(row?.binanceChainId) === String(chain) && /^0x[0-9a-fA-F]{64}$/.test(row.txHash)) hashes.add(row.txHash);
  };
  for (const row of history.transactions) {
    add(row);
    if (Array.isArray(row.txHashList)) for (const nested of row.txHashList.slice(0, 10)) add(nested);
  }
  return [...hashes];
}

export class AgentError extends Error {
  constructor(readonly code: string, message: string, readonly nextAction: string,
    readonly submissionMayHaveOccurred = false, readonly providerCode?: string | number) { super(message); }
}

/** CLI and MCP share one public envelope; never serialize a transport error or its request. */
export function publicError(error: unknown) {
  if (error instanceof AgentError) return { code: error.code, message: error.message,
    nextAction: error.nextAction, submissionMayHaveOccurred: error.submissionMayHaveOccurred, providerCode: error.providerCode };
  const value = error as { code?: string; name?: string } | null;
  if (value?.code === 'EEXIST') return { code: 'LOCAL_OPERATION_BUSY', message: 'Operation is already claimed or a recovery lock exists',
    nextAction: 'INSPECT_JOURNAL_WITHOUT_RESUBMITTING' };
  if (value?.code === 'ENOENT') return { code: 'LOCAL_RECORD_NOT_FOUND', message: 'Local operation record was not found', nextAction: 'INSPECT_JOURNAL' };
  if (value?.name === 'TransactionReceiptNotFoundError') return { code: 'RECEIPT_NOT_AVAILABLE',
    message: 'Receipt is not available yet; no submission state was cleared', nextAction: 'WAIT_AND_RECHECK_RECEIPT' };
  return { code: 'OPERATION_FAILED', message: error instanceof Error && error.constructor === Error ? error.message :
    'Operation failed; inspect configuration or provider status', nextAction: 'INSPECT_STATE_BEFORE_RETRY' };
}

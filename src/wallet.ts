import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAddress } from 'viem';
import { AgentError } from './errors';

const run = promisify(execFile);

export class BinanceWallet {
  async call(args: string[], timeout = 30_000, signal?: AbortSignal): Promise<any> {
    const submitting = args[1] === 'execute';
    let stdout: string;
    try { ({ stdout } = await run('baw', [...args, '--json'], { timeout, signal, maxBuffer: 2_000_000, encoding: 'utf8' })); }
    catch (error: any) {
      // A nonzero exit can still carry a structured provider error. Never expose stderr/session logs.
      stdout = error.stdout || '';
      if (!stdout) throw new AgentError(error.code === 'ENOENT' ? 'WALLET_CLI_NOT_FOUND' : 'WALLET_COMMAND_INCOMPLETE',
        error.code === 'ENOENT' ? 'Install the official Binance baw CLI first' : 'Wallet command did not complete; check order/history before retrying',
        error.code === 'ENOENT' ? 'INSTALL_OFFICIAL_BAW' : 'INSPECT_ORDER_WITHOUT_RESUBMITTING', submitting && error.code !== 'ENOENT');
    }
    let result;
    try { result = JSON.parse(stdout); } catch { throw new AgentError('WALLET_INVALID_RESPONSE', 'Wallet returned invalid JSON', 'INSPECT_PROVIDER_STATUS', submitting); }
    if (result?.success !== true) {
      const code = result?.error?.code;
      const providerCode = (typeof code === 'number' && Number.isSafeInteger(code)) ||
        (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code)) ? code : undefined;
      throw new AgentError('WALLET_REQUEST_REJECTED', 'Wallet request rejected; inspect its public error code and the Binance App',
        'INSPECT_PROVIDER_ERROR', submitting, providerCode);
    }
    return result.data;
  }

  async identity(chainId: number, signal?: AbortSignal) {
    const status = await this.call(['wallet', 'status'], 30_000, signal);
    if (status.status !== 'CONNECTED') throw new Error('Wallet is not connected. Run the official baw auth signin / verify flow');
    const [result, chains] = await Promise.all([
      this.call(['wallet', 'address'], 30_000, signal), this.call(['wallet', 'chains'], 30_000, signal),
    ]);
    if (!Array.isArray(chains) || !chains.some((c: any) => String(c.binanceChainId) === String(chainId))) throw new Error('Selected chain is not reported by the wallet');
    const entry = result.addresses?.find((a: any) => String(a.binanceChainId) === String(chainId));
    if (!entry) throw new Error('Wallet has no address for this chain');
    return getAddress(entry.address);
  }

  async preflight(chainId: number) {
    const [address, settings] = await Promise.all([this.identity(chainId), this.call(['wallet', 'settings'])]);
    const expiry = settings.devMode?.expiresAt;
    const numeric = typeof expiry === 'number' || (typeof expiry === 'string' && /^\d+$/.test(expiry)) ? Number(expiry) : NaN;
    const expires = Number.isFinite(numeric) ? (numeric > 1e12 ? numeric / 1000 : numeric) :
      typeof expiry === 'string' ? Date.parse(expiry) / 1000 : NaN;
    if (settings.devMode?.enabled !== true || !Number.isFinite(expires) || expires <= Date.now() / 1000) throw new Error('Enable Developer Mode in the Binance App, then retry');
    if (settings.devMode.balanceExceeded === true) throw new Error('Wallet exceeds the Developer Mode balance limit');
    return { address, settings };
  }
}

export function normalizeSignature(signature: string, recovery?: string): `0x${string}` {
  const hex = signature.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex) || ![128, 130].includes(hex.length)) throw new Error('Unsupported wallet signature length');
  if (recovery !== undefined && (typeof recovery !== 'string' || !/^(0x)?(00|01|1b|1c|0|1)$/i.test(recovery))) throw new Error('Invalid signature recovery');
  const provided = recovery === undefined ? undefined : Number.parseInt(recovery.replace(/^0x/, ''), 16);
  const normalize = (v: number) => { if (v === 0 || v === 1) return v + 27; if (v === 27 || v === 28) return v; throw new Error('Invalid signature recovery'); };
  if (hex.length === 128 && provided === undefined) throw new Error('Signature recovery missing');
  const v = normalize(hex.length === 130 ? Number.parseInt(hex.slice(128), 16) : provided!);
  if (provided !== undefined && normalize(provided) !== v) throw new Error('Signature recovery mismatch');
  return `0x${hex.slice(0, 128)}${v.toString(16)}`;
}

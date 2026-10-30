import { getAddress, isAddress } from 'viem';

export interface WebWalletStatus {
  server_time: number; received_at: number;
  phase: 'IDLE' | 'AWAITING_APP' | 'CREATING' | 'VERIFYING' | 'CONNECTED' | 'EXPIRED';
  chain_id: number;
  deployment_available: boolean;
  signing_enabled: boolean;
  platform_authenticated: boolean;
  execution_chain_id: number;
  environment: 'local' | 'production';
  url?: string;
  pairing_code?: string;
  expires_at?: number;
  session_expires_at?: number;
  wallet_address?: `0x${string}`;
  wallet_chain_id?: number;
  chain_supported?: boolean;
  verified_at?: number;
  provider_revocation_confirmed?: boolean;
}

export function webWalletStatus(value: unknown, chainId: number): WebWalletStatus {
  const v = value as Record<string, unknown> | null;
  if (!v || !Number.isSafeInteger(v.server_time) || v.chain_id !== chainId || typeof v.signing_enabled !== 'boolean' || typeof v.platform_authenticated !== 'boolean' || typeof v.deployment_available !== 'boolean' ||
      !['local', 'production'].includes(String(v.environment)) || !Number.isSafeInteger(v.execution_chain_id) || Number(v.execution_chain_id) <= 0 ||
      !['IDLE', 'AWAITING_APP', 'CREATING', 'VERIFYING', 'CONNECTED', 'EXPIRED'].includes(String(v.phase))) throw new Error('Unsupported wallet response');
  const result: WebWalletStatus = { server_time: Number(v.server_time), received_at: performance.now(), phase: v.phase as WebWalletStatus['phase'], chain_id: chainId, deployment_available: v.deployment_available,
    signing_enabled: v.signing_enabled, platform_authenticated: v.platform_authenticated, execution_chain_id: Number(v.execution_chain_id), environment: v.environment as 'local' | 'production' };
  if (result.phase !== 'CONNECTED' && (result.signing_enabled || result.platform_authenticated)) throw new Error('Unverified wallet permissions');
  if (v.session_expires_at !== undefined) {
    if (!Number.isSafeInteger(v.session_expires_at)) throw new Error('Invalid session expiry');
    result.session_expires_at = Number(v.session_expires_at);
  }
  if (result.phase === 'AWAITING_APP') {
    const url = new URL(String(v.url));
    if (url.protocol !== 'https:' || !['app.binance.com', 'web3.binance.com'].includes(url.hostname) || url.port || url.username || url.password ||
        typeof v.url !== 'string' || v.url.length > 8192 || !Number.isSafeInteger(v.expires_at) ||
        typeof v.pairing_code !== 'string' || !/^[a-f0-9]{6}$/.test(v.pairing_code)) throw new Error('Invalid pairing response');
    result.url = v.url; result.pairing_code = v.pairing_code; result.expires_at = Number(v.expires_at);
  }
  if (result.phase === 'CONNECTED') {
    if (typeof v.wallet_address !== 'string' || !isAddress(v.wallet_address) || !Number.isSafeInteger(v.wallet_chain_id) || Number(v.wallet_chain_id) <= 0 ||
        typeof v.chain_supported !== 'boolean' || !Number.isSafeInteger(v.verified_at) ||
        !Number.isSafeInteger(v.server_time) || Number(v.server_time) - Number(v.verified_at) > 45_000 || Number(v.verified_at) > Number(v.server_time) + 1000) throw new Error('Wallet verification is stale');
    if (v.chain_supported && v.wallet_chain_id !== chainId) throw new Error('Wallet chain mismatch');
    if (result.signing_enabled && (!v.chain_supported || !v.deployment_available || chainId !== result.execution_chain_id)) throw new Error('Execution chain mismatch');
    result.wallet_address = getAddress(v.wallet_address); result.wallet_chain_id = Number(v.wallet_chain_id);
    result.chain_supported = v.chain_supported; result.verified_at = Number(v.verified_at);
  }
  if (typeof v.provider_revocation_confirmed === 'boolean') result.provider_revocation_confirmed = v.provider_revocation_confirmed;
  return result;
}

import { getAddress, isAddress } from 'viem';

export interface BridgeActivation { token: string; port: number; chainId: number }
export interface BridgeStatus {
  serverTime: number; receivedAt: number;
  phase: 'IDLE' | 'STARTING' | 'AWAITING_APP' | 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'DISCONNECTED';
  chainId: number;
  bridgeExpiresAt: number;
  address?: `0x${string}`;
  verifiedAt?: number;
  url?: string;
  pairingCode?: string;
  expireAt?: number;
  qrDataUrl?: string;
  error?: { message: string };
}

/** Capability stays in memory; only the fixed loopback host can receive it. */
export function bridgeActivation(hash: string): BridgeActivation | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (Array.from(p.keys()).length !== 3 || !['jump-bridge', 'port', 'chain'].every(k => p.getAll(k).length === 1)) return null;
  const token = p.get('jump-bridge') ?? '', port = Number(p.get('port')), chainId = Number(p.get('chain'));
  if (!/^[a-f0-9]{64}$/.test(token) || !Number.isInteger(port) || port < 1 || port > 65535 || !Number.isSafeInteger(chainId) || chainId <= 0) return null;
  return { token, port, chainId };
}

export function bridgeStatus(data: unknown, chainId: number): BridgeStatus {
  const v = data as Record<string, unknown> | null;
  if (!v || !Number.isSafeInteger(v.serverTime) || v.chainId !== chainId || v.scope !== 'LOCAL_AGENT_WALLET' || v.platformAuthenticated !== false ||
      v.canSignFromBrowser !== false || !Number.isSafeInteger(v.bridgeExpiresAt) ||
      !['IDLE', 'STARTING', 'AWAITING_APP', 'CONNECTED', 'ERROR', 'EXPIRED', 'DISCONNECTED'].includes(String(v.phase))) throw new Error('Unsupported bridge response');
  const result: BridgeStatus = { serverTime: Number(v.serverTime), receivedAt: performance.now(), phase: v.phase as BridgeStatus['phase'], chainId, bridgeExpiresAt: Number(v.bridgeExpiresAt) };
  if (result.phase === 'CONNECTED') {
    if (typeof v.address !== 'string' || !isAddress(v.address) || !Number.isSafeInteger(v.verifiedAt) ||
        !Number.isSafeInteger(v.serverTime) || Number(v.verifiedAt) > Number(v.serverTime) + 1000 || Number(v.serverTime) - Number(v.verifiedAt) > 45_000) throw new Error('Wallet connection is not fresh');
    result.address = getAddress(v.address); result.verifiedAt = Number(v.verifiedAt);
  }
  if (result.phase === 'AWAITING_APP') {
    const url = new URL(String(v.url));
    if (url.protocol !== 'https:' || !['web3.binance.com', 'app.binance.com'].includes(url.hostname) || url.port || url.username || url.password ||
        typeof v.url !== 'string' || v.url.length > 8192 || typeof v.pairingCode !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(v.pairingCode) ||
        !Number.isSafeInteger(v.expireAt) || typeof v.qrDataUrl !== 'string' || v.qrDataUrl.length > 100_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.qrDataUrl)) throw new Error('Unsupported pairing response');
    result.url = v.url; result.pairingCode = v.pairingCode; result.expireAt = Number(v.expireAt); result.qrDataUrl = v.qrDataUrl;
  }
  if (v.error) result.error = { message: 'Wallet connection failed. Check the Binance App and local agent, then create a fresh connection.' };
  return result;
}

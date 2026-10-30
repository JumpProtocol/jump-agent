import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import { BinanceWallet } from './wallet';
import { safeUrl } from './api';
import { publicError } from './errors';

const MAX_LIFETIME = 15 * 60_000;
export function validatePairing(data: any, now = Date.now()) {
  const url = new URL(data.urlForWeb);
  const expireAt = Number(data.expireAt);
  if (url.protocol !== 'https:' || !['web3.binance.com', 'app.binance.com'].includes(url.hostname) ||
      url.username || url.password || url.port ||
      typeof data.urlForWeb !== 'string' || data.urlForWeb.length > 8192 ||
      typeof data.pairingCode !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(data.pairingCode) ||
      typeof data.qrCodeId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.qrCodeId) ||
      !Number.isSafeInteger(expireAt) || expireAt <= now || expireAt > now + 600_000) {
    throw new Error('Wallet returned an unsupported pairing response');
  }
  // Preserve the official URL and pairing code verbatim. Never reconstruct a Binance sign-in link.
  return { url: data.urlForWeb as string, pairingCode: data.pairingCode as string, expireAt, qrCodeId: data.qrCodeId as string };
}

export async function startBridge(options: { origin: string; chainId: number; port?: number; wallet?: BinanceWallet; lifetimeMs?: number }) {
  const page = safeUrl(options.origin);
  if (page.href !== `${page.origin}/` || ![56, 97].includes(options.chainId)) throw new Error('Bridge requires a page origin and BSC 56 or 97');
  const port = options.port ?? 42819;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid bridge port');
  const wallet = options.wallet ?? new BinanceWallet();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + Math.min(options.lifetimeMs ?? MAX_LIFETIME, MAX_LIFETIME);
  let state: any = { phase: 'IDLE' }, epoch = 0, controller: AbortController | undefined;
  let lastChecked = 0, refreshing: Promise<void> | undefined, closed = false;
  const errorState = (error: unknown) => ({ phase: 'ERROR', error: publicError(error) });
  const cancel = () => { epoch++; controller?.abort(); controller = undefined; };
  const snapshot = () => ({ ...state, serverTime: Date.now(), chainId: options.chainId, bridgeExpiresAt: expiresAt,
    scope: 'LOCAL_AGENT_WALLET', platformAuthenticated: false, canSignFromBrowser: false });
  const begin = async (generation: number, signal: AbortSignal) => {
    try {
      const current = await wallet.call(['wallet', 'status'], 30_000, signal);
      if (generation !== epoch) return;
      if (current.status !== 'CONNECTED') {
        const response = await wallet.call(['auth', 'signin'], 30_000, signal);
        if (generation !== epoch) return;
        if (response.status !== 'ALREADY_CONNECTED') {
          const pairing = validatePairing(response);
          const qrDataUrl = await QRCode.toDataURL(pairing.url, { width: 256, margin: 2, errorCorrectionLevel: 'M' });
          if (generation !== epoch) return;
          state = { phase: 'AWAITING_APP', url: pairing.url, pairingCode: pairing.pairingCode, expireAt: pairing.expireAt, qrDataUrl };
          // Keep the official foreground verify alive; the HTTP endpoint itself does not block for five minutes.
          const verified = await wallet.call(['auth', 'verify', '--qrCodeId', pairing.qrCodeId],
            Math.min(315_000, pairing.expireAt - Date.now() + 15_000), signal);
          if (generation !== epoch) return;
          if (verified.status !== 'SUCCESS') throw new Error('Wallet verification did not complete; create a fresh pairing code');
        }
      }
      const address = await wallet.identity(options.chainId, signal);
      if (generation !== epoch) return;
      lastChecked = Date.now(); state = { phase: 'CONNECTED', address, verifiedAt: lastChecked };
    } catch (error) { if (generation === epoch) state = errorState(error); }
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const expectedHost = `127.0.0.1:${(server.address() as { port: number })?.port}`;
    if (closed || req.headers.host !== expectedHost || req.headers.origin !== page.origin) { res.writeHead(403).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', page.origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.writeHead(204).end(); return;
    }
    const credential = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!/^[a-f0-9]{64}$/.test(credential) || !timingSafeEqual(Buffer.from(credential), Buffer.from(token))) { res.writeHead(401).end(); return; }
    if (Date.now() >= expiresAt) { res.writeHead(410).end(); return; }
    if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' ||
        !['/status', '/connect', '/cancel', '/disconnect'].includes(req.url ?? '')) { res.writeHead(404).end(); return; }
    // No request arguments or arbitrary command forwarding. Read at most an empty JSON object.
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 16) { res.writeHead(413).end(); return; }
      }
      if (body.trim() !== '{}') { res.writeHead(400).end(); return; }
      if (req.url === '/connect') {
        if (!['STARTING', 'AWAITING_APP', 'CONNECTED'].includes(state.phase)) {
          cancel(); controller = new AbortController(); state = { phase: 'STARTING' };
          void begin(epoch, controller.signal);
        }
      } else if (req.url === '/cancel') { cancel(); state = { phase: 'IDLE' }; }
      else if (req.url === '/disconnect') {
        cancel(); state = { phase: 'DISCONNECTED' };
        res.setHeader('Content-Type', 'application/json');
        res.once('finish', () => { void close(); }); res.end(JSON.stringify(snapshot())); return;
      } else if (state.phase === 'CONNECTED' && Date.now() - lastChecked >= 5000) {
        const generation = epoch, originalAddress = state.address;
        refreshing ??= (async () => {
          try {
            if (await wallet.identity(options.chainId, controller?.signal) !== originalAddress) throw new Error('Local wallet changed; connect again');
            if (generation === epoch) { lastChecked = Date.now(); state = { phase: 'CONNECTED', address: originalAddress, verifiedAt: lastChecked }; }
          } catch (error) { if (generation === epoch) state = errorState(error); }
        })().finally(() => { refreshing = undefined; });
        await refreshing;
      }
      if (state.phase === 'AWAITING_APP' && Date.now() >= state.expireAt) { cancel(); state = { phase: 'EXPIRED' }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(snapshot()));
    } catch { res.writeHead(500).end(); }
  });
  server.maxConnections = 16; server.requestTimeout = 10_000; server.headersTimeout = 5000;
  const close = async () => {
    if (closed) return;
    closed = true; cancel(); clearTimeout(expiryTimer);
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  };
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const actualPort = (server.address() as { port: number }).port;
  const expiryTimer = setTimeout(() => { void close(); }, Math.max(1, expiresAt - Date.now()));
  return { port: actualPort, token, expiresAt, close,
    activationUrl: `${page.origin}/agent#jump-bridge=${token}&port=${actualPort}&chain=${options.chainId}` };
}

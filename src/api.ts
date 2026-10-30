export function safeUrl(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use HTTPS (or HTTP on localhost), without credentials, query or fragment');
  }
  return url;
}

export class JumpApi {
  readonly base: string;
  constructor(base: string) {
    const url = safeUrl(base);
    if (url.pathname !== '/') throw new Error('Jump API configuration must be an origin, without /api');
    this.base = url.href.replace(/\/$/, '');
  }

  async request(path: string, options: { body?: unknown; token?: string } = {}): Promise<any> {
    const response = await fetch(`${this.base}/api${path}`, {
      method: options.body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (!response.ok) throw new Error(`Jump API HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Jump API returned an empty body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error('Jump API response exceeds size limit'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const result = JSON.parse(new TextDecoder().decode(bytes)) as { code: number; data: unknown; msg: string };
    if (!Number.isSafeInteger(result.code)) throw new Error('Jump API returned an invalid status code');
    if (result.code !== 0) throw new Error(`Jump API ${result.code}: request rejected`);
    return result.data;
  }
}

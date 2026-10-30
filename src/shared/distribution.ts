export interface Artifact { path: string; sha256: string; bytes: number }
export interface Distribution { schema_version: number; version: string; node: string; skill: Artifact; runtime: Artifact; remote_mcp: null; release_state?: 'development' | 'candidate' }

export function validateDistribution(value: unknown): Distribution {
  const v = value as Distribution;
  if (!v || v.schema_version !== 1 || !/^\d+\.\d+\.\d+$/.test(v.version) || v.node !== '>=22' || v.remote_mcp !== null || !['development', 'candidate'].includes(v.release_state ?? 'development')) throw new Error('Unsupported release manifest');
  for (const [kind, suffix] of [['skill', 'zip'], ['runtime', 'tgz']] as const) {
    const artifact = v[kind];
    const prefix = kind === 'skill' ? 'skill' : 'agent';
    if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > 2_000_000 ||
      artifact.path !== `/agent-distribution/v${v.version}/jump-${prefix}-${artifact.sha256}.${suffix}`) throw new Error('Invalid release artifact');
  }
  return v;
}


/** Bound streaming bytes before parsing even when Content-Length is absent. */
export async function readReleaseManifest(response: Response): Promise<Distribution> {
  if (!response.ok || !response.body) throw new Error('Agent downloads unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16000) { await reader.cancel(); throw new Error('Release manifest too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return validateDistribution(JSON.parse(new TextDecoder().decode(bytes)));
}

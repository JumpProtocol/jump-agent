import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDistribution, readReleaseManifest } from '../src/shared/distribution';

test('release downloads are same-origin content-hashed artifacts, not arbitrary installer URLs', () => {
  const hash = 'a'.repeat(64);
  const valid = { schema_version: 1, version: '0.1.0', node: '>=22', remote_mcp: null,
    runtime: { sha256: hash, bytes: 123, path: `/agent-distribution/v0.1.0/jump-agent-${hash}.tgz` },
    skill: { sha256: hash, bytes: 234, path: `/agent-distribution/v0.1.0/jump-skill-${hash}.zip` } };
  assert.equal(validateDistribution(valid).version, '0.1.0');
  for (const path of ['https://other.example/install.sh', '//other.example/a.tgz', '/agent-distribution/../private', valid.runtime.path+'?redirect=1']) {
    assert.throws(() => validateDistribution({ ...valid, runtime: { ...valid.runtime, path } }));
  }
  assert.throws(() => validateDistribution({ ...valid, runtime: { ...valid.runtime, bytes: 3_000_000 } }));
  assert.throws(() => validateDistribution({ ...valid, runtime: { ...valid.runtime, sha256: 'b'.repeat(64) } }));
});


test('oversized chunked manifests are cancelled before JSON parsing', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(16001)); }, cancel() { cancelled = true; } });
  await assert.rejects(readReleaseManifest(new Response(body)), /too large/);
  assert.equal(cancelled, true);
});

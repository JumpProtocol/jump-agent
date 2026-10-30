import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp';
import { Runner } from '../src/runner';

test('MCP negotiates, exposes safe tools, validates input and reuses Runner', async () => {
  const calls: unknown[] = [];
  const runner = { list: async (page: number) => { calls.push(page); return { items: [] }; },
    execute: async () => { throw new Error('Preview changed or already submitted; do not retry'); } } as unknown as Runner;
  const server = createMcpServer(runner);
  const client = new Client({ name: 'jump-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 15);
    assert.equal(tools.find(t => t.name === 'jump_execute')?.annotations?.readOnlyHint, false);
    assert.equal(tools.find(t => t.name === 'jump_list')?.annotations?.readOnlyHint, true);
    const result = await client.callTool({ name: 'jump_list', arguments: { page: 2 } });
    assert.equal(result.isError, undefined);
    assert.deepEqual(calls, [2]);
    const invalid = await client.callTool({ name: 'jump_list', arguments: { page: -1, api: 'https://attacker.example' } });
    assert.equal(invalid.isError, true);
    assert.deepEqual(calls, [2]);
    const denied = await client.callTool({ name: 'jump_execute', arguments: { previewId: '00000000-0000-4000-8000-000000000001', confirmDigest: 'a'.repeat(64) } });
    assert.equal(denied.isError, true);
  } finally { await client.close(); await server.close(); }
});

test('built CLI provides a clean stdio MCP handshake without using a wallet', async () => {
  const client = new Client({ name: 'jump-stdio-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [resolve('dist/cli.js'), '--api', 'https://example.com', '--chain-id', '56', 'mcp'], stderr: 'pipe' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some(t => t.name === 'jump_preview'));
    assert.ok(tools.some(t => t.name === 'jump_reconcile'));
  } finally { await client.close(); }
});

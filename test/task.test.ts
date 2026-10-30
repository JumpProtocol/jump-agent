import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { agentTask } from '../src/shared/task';

test('ordinary agent task uses public HTTP without assuming a Jump CLI installation', () => {
  const task = agentTask('https://jump.example', 3, 97);
  assert.equal(task.command, "curl --fail --silent --show-error 'https://jump.example/api/tokens/3/auction/agent?chain_id=97'");
  assert.equal(task.localOnly, false);
  assert.doesNotMatch(task.command, /node|agent\/dist|npx|npm/);
  assert.match(task.prompt, /No Jump CLI or wallet is needed for this read/);
  assert.match(task.prompt, /If it is unavailable, stop at read-only inspection/);
  const args = task.command.slice('curl '.length);
  const parsed = spawnSync('/bin/sh', ['-c', `set -- ${args}; printf '%s' "$4"`], { encoding: 'utf8' });
  assert.equal(parsed.status, 0);
  assert.equal(parsed.stdout, task.endpoint);
});

test('loopback tasks explicitly reject the assumption that remote agents can reach this computer', () => {
  for (const origin of ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://[::1]:8080']) {
    const task = agentTask(origin, 3, 97);
    assert.equal(task.localOnly, true);
    assert.match(task.prompt, /another device or a remote service/);
  }
  for (const origin of ['https://user:password@jump.example', 'https://jump.example/?secret=1']) assert.throws(() => agentTask(origin, 3, 97));
});

test('developer-only source command preserves shell argument boundaries', () => {
  const rpc = "https://rpc.example/$(printf BAD)'suffix";
  const pins = { rpc, engine: `0x${'11'.repeat(20)}`, factory: `0x${'22'.repeat(20)}` };
  const task = agentTask('https://jump.example', 3, 97, pins);
  assert.match(task.developerCommand, / info --token-id 3$/);
  const args = task.developerCommand.slice('node agent/dist/cli.js '.length);
  const parsed = spawnSync('/bin/sh', ['-c', `set -- ${args}; printf '%s' "$6"`], { encoding: 'utf8' });
  assert.equal(parsed.status, 0);
  assert.equal(parsed.stdout, rpc);
});

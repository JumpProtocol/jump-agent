#!/usr/bin/env node
/** Dependency-free setup helper. No wallet credentials, shell execution or config edits. */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function connectionPlan(client, origin, mode = 'read') {
  const u = new URL(origin);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !(u.protocol === 'https:' || u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))) throw new Error('Use a trusted HTTPS origin or a local preview');
  if (!['read', 'wallet'].includes(mode)) throw new Error('Mode must be read or wallet');
  const url = u.origin + (mode === 'wallet' ? '/mcp/wallet' : '/mcp');
  const name = mode === 'wallet' ? 'jump-wallet' : 'jump';
  const commands = {
    codex: { args: ['mcp', 'add', name, '--url', url], inspect: ['mcp', 'get', name], remove: ['mcp', 'remove', name], login: ['mcp', 'login', name] },
    claude: { args: ['mcp', 'add', '--scope', 'user', '--transport', 'http', name, url], inspect: ['mcp', 'get', name], remove: ['mcp', 'remove', '--scope', 'user', name], login: null },
    openclaw: { args: ['mcp', 'add', name, '--url', url], inspect: ['mcp', 'show', name], remove: ['mcp', 'unset', name], login: ['mcp', 'login', name] },
  };
  if (!Object.hasOwn(commands, client)) throw new Error('Client must be codex, claude or openclaw');
  return { client, name, url, mode, ...commands[client] };
}

async function boundedText(response) {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new Error('Response exceeds diagnostic limit'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function doctor(origin) {
  const u = new URL(origin);
  connectionPlan('codex', origin);
  const response = await fetch(new URL('/api/agent/v1/capabilities', u), { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const result = JSON.parse(await boundedText(response));
  if (!response.ok || result.code !== 0 || !result.data.remote_mcp || result.data.remote_mcp.public_url !== u.origin + '/mcp' || result.data.remote_mcp.wallet_url !== u.origin + '/mcp/wallet') throw new Error('Remote MCP is not enabled for this exact origin');
  const handshake = await fetch(new URL('/mcp', u), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'jump-connect-doctor', version: '0.2.0' } } }) });
  const text = await boundedText(handshake);
  const initialized = handshake.headers.get('content-type')?.includes('text/event-stream')
    ? text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5).trim())).find(value => value.id === 1)
    : JSON.parse(text);
  if (!handshake.ok || !initialized?.result?.serverInfo) throw new Error('MCP handshake failed');
  return { status: 'PASS', chain_id: result.data.execution_chain_id, remote_mcp: result.data.remote_mcp, wallet_accessed: false };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required');
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) { console.log('node jump-connect.mjs --client codex|claude|openclaw --origin https://app.jump.family --mode read|wallet [--doctor] [--apply]\nDefault: print a plan only. --apply uses the installed official client CLI, refuses existing names, and never signs in automatically.'); return; }
  const values = {};
  for (let i=0; i<args.length; i++) {
    if (['--apply', '--doctor'].includes(args[i])) values[args[i].slice(2)] = true;
    else if (['--client', '--origin', '--mode'].includes(args[i]) && args[i+1] && !args[i+1].startsWith('--')) values[args[i].slice(2)] = args[++i];
    else throw new Error('Unknown or incomplete option');
  }
  const plan = connectionPlan(values.client, values.origin, values.mode);
  console.log(JSON.stringify({ ...plan, apply: !!values.apply, credential_handling: 'Official client OAuth storage only; no Jump wallet credentials in this helper' }, null, 2));
  if (values.doctor || values.apply) console.log(JSON.stringify(await doctor(values.origin)));
  if (!values.apply) return;
  // Resolve only known executable names through PATH; never accept commands from the network.
  const help = execFileSync(plan.client, ['mcp', 'add', '--help'], { encoding: 'utf8', timeout: 15000, stdio: ['ignore','pipe','pipe'] });
  if (!help.includes('--url') && plan.client !== 'claude' || plan.client === 'claude' && !help.includes('--transport')) throw new Error('Installed client lacks remote MCP configuration; update it using its official instructions');
  let exists = false;
  try { const existing = execFileSync(plan.client, plan.inspect, { encoding: 'utf8', timeout: 15000, stdio: ['ignore','pipe','pipe'] }); exists = existing.trim() !== '' && existing.trim() !== 'null'; }
  catch (e) { if (e.code === 'ENOENT' || e.signal || !/not found|no mcp server|unknown server/i.test(String(e.stderr ?? ''))) throw new Error('Client inspection failed; no changes made'); }
  if (exists) throw new Error('That server name already exists. Inspect it in your client; this helper will not overwrite it');
  execFileSync(plan.client, plan.args, { timeout: 15000, stdio: 'inherit' });
  console.log(plan.mode === 'wallet' ? plan.login ? `Next: ${plan.client} ${plan.login.join(' ')}. Review consent on the trusted Jump website.` : 'Next: run /mcp in Claude Code and select jump-wallet to authorize.' : 'Connected for public reads. Ask your Agent to call jump_capabilities.');
  console.log(`Remove configuration: ${plan.client} ${plan.remove.join(' ')}. Revoke active wallet access separately at ${new URL('/agent/access', values.origin)}. Removing config does not revoke or cancel a submitted transaction.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Setup could not complete. Check options, trusted origin, client version and existing MCP configuration. No wallet signing or transaction is performed by this helper.'); process.exitCode = 1; });

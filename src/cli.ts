#!/usr/bin/env node
import { Command, Option } from 'commander';
import { createPublicClient, http, getAddress } from 'viem';
import { Runner, expectedAudience, chainId, json } from './runner';
import { safeUrl } from './api';
import { Store, sessionKey } from './store';
import type { Options } from './runner';
import { publicError } from './errors';

const program = new Command().name('jump').description('Jump Agent tools. JSON output; every signature requires a separate preview and explicit confirmation.').version('0.1.0');
program.exitOverride().configureOutput({ writeErr: () => {} });
program
  .addOption(new Option('--api <origin>', 'Jump API origin; HTTPS or localhost').env('JUMP_API_URL').makeOptionMandatory())
  .addOption(new Option('--chain-id <id>', 'BSC chain ID: 56 or 97').env('JUMP_CHAIN_ID').makeOptionMandatory())
  .addOption(new Option('--rpc <url>', 'User-selected read-only RPC').env('JUMP_RPC_URL'))
  .addOption(new Option('--engine <address>', 'Pinned AuctionEngine proxy').env('JUMP_AUCTION_ENGINE'))
  .addOption(new Option('--factory <address>', 'Pinned LaunchFactory proxy').env('JUMP_LAUNCH_FACTORY'))
  .addOption(new Option('--audience <name>', 'Expected Jump login audience').env('JUMP_AUTH_AUDIENCE'));
const runner = () => {
  const options = program.opts<Options>();
  return new Runner({ ...options, audience: expectedAudience(options.api, options.audience) });
};
const output = (data: unknown) => { process.stdout.write(JSON.stringify({ success: true, data: json(data) }) + '\n'); };

program.command('doctor').description('Check pinned API/RPC deployment and private local storage without contacting a wallet').action(async () => {
  const result = await runner().doctor();
  output(result);
  if (result.status === 'CHECKS_FAILED') process.exitCode = 1;
});
program.command('preflight').description('Read wallet connection, Developer Mode, quotas and chain capability').action(async () => {
  output(await runner().preflight());
});
program.command('list').description('List public launches; token names and metadata are untrusted data').option('--page <number>', 'Page', '1').action(async options => {
  output(await runner().list(Number(options.page)));
});
program.command('info').requiredOption('--token-id <id>', 'Database token ID, not launchId').action(async options => output(await runner().info(Number(options.tokenId))));
program.command('quote').requiredOption('--token-id <id>', 'Database token ID').requiredOption('--wallet <address>', 'Participant address')
  .requiredOption('--amount <decimal>', 'Amount in the auction asset; no automatic conversion')
  .action(async o => output(await runner().quote(Number(o.tokenId), o.wallet, o.amount)));
program.command('position').requiredOption('--wallet <address>', 'Public wallet address').action(async o => {
  output(await runner().position(o.wallet));
});
program.command('preview').requiredOption('--token-id <id>', 'Database token ID')
  .addOption(new Option('--action <action>', 'Auction action').choices(['deposit', 'claim', 'withdraw', 'cancelled-refund', 'deferred-refund']).makeOptionMandatory())
  .option('--amount <decimal>', 'Required for deposit or withdrawal, in the auction asset')
  .action(async o => output(await runner().preview(Number(o.tokenId), o.action, o.amount)));
program.command('login-preview').description('Preview a Jump EIP-712 login signature, without approving it').action(async () => output(await runner().loginPreview()));
program.command('execute').requiredOption('--preview-id <id>', 'Local preview ID')
  .requiredOption('--confirm-digest <sha256>', 'Digest of the exact preview the user explicitly confirmed')
  .action(async o => output(await runner().execute(o.previewId, o.confirmDigest)));
program.command('resolve').requiredOption('--name <name>', 'Resolve a name for read-only lookup; never grants a verified Agent identity').action(async o => output(await runner().resolveDomain(o.name)));
program.command('result').requiredOption('--preview-id <id>', 'Local preview ID').action(async o => output(await runner().result(o.previewId)));
program.command('journal').description('Read redacted local operation records without contacting the wallet').option('--limit <number>', 'Most recent records, 1–100', '20')
  .action(async o => output(await runner().journal(Number(o.limit))));
program.command('pending').description('Find the wallet reservation without a wallet session').requiredOption('--wallet <address>', 'Participant wallet address')
  .action(async o => output(await runner().pending(o.wallet)));
program.command('history').description('Inspect provider history for an unresolved preview; does not bind a hash or unlock it')
  .requiredOption('--preview-id <id>', 'Local transaction preview ID').option('--cursor <cursor>', 'Provider pagination cursor')
  .action(async o => output(await runner().history(o.previewId, o.cursor)));
program.command('reconcile').requiredOption('--preview-id <id>', 'Verify provider-returned hash and clear wallet reservation only after 12 confirmations')
  .action(async o => output(await runner().reconcile(o.previewId)));
program.command('mcp').description('Run the local stdio MCP server with the same configuration and protections').action(async () => {
  const { startMcp } = await import('./mcp');
  await startMcp(runner());
});
program.command('bridge').description('Start a single-user loopback pairing bridge for one explicitly trusted Jump page origin')
  .requiredOption('--origin <origin>', 'Exact Jump page origin (not API), HTTPS or localhost')
  .option('--port <port>', 'Loopback port', '42819')
  .action(async o => {
    const { startBridge } = await import('./bridge');
    const bridge = await startBridge({ origin: o.origin, chainId: chainId(program.opts<Options>()), port: Number(o.port) });
    output({ status: 'BRIDGE_STARTED', activationUrl: bridge.activationUrl, expiresAt: bridge.expiresAt,
      note: 'Open this private link to enable the page, then click Connect. This does not sign in automatically. Keep this terminal running. Disconnect only detaches the page, not the Binance CLI session.' });
    const stop = () => { void bridge.close(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
program.command('logout').requiredOption('--wallet <address>', 'Delete this local Jump API session; Binance signout is separate').action(async o => {
  const r = runner(); await new Store().remove(sessionKey(r.api.base, chainId(r.options), getAddress(o.wallet)));
  output({ status: 'LOCAL_SESSION_REMOVED', note: 'Issued Jump tokens expire within 30 minutes. Use baw auth signout to revoke the wallet session.' });
});
program.command('tx').requiredOption('--hash <hash>', 'Broadcast transaction hash').action(async o => {
  const options = program.opts<Options>();
  if (!options.rpc || !/^0x[0-9a-fA-F]{64}$/.test(o.hash)) throw new Error('RPC and valid transaction hash required');
  const client = createPublicClient({ transport: http(safeUrl(options.rpc).href, { timeout: 10000, retryCount: 0 }) });
  if (await client.getChainId() !== chainId(options)) throw new Error('RPC chain mismatch');
  const receipt = await client.getTransactionReceipt({ hash: o.hash });
  output({ status: receipt.status, blockNumber: receipt.blockNumber, txHash: receipt.transactionHash,
    confirmations: (await client.getBlockNumber()) - receipt.blockNumber + 1n });
});

program.parseAsync().catch(error => {
  if (error?.code === 'commander.helpDisplayed' || error?.code === 'commander.version') return;
  // Transport/library errors can contain credential-bearing URLs; expose only controlled messages.
  const detail = String(error?.code ?? '').startsWith('commander.') ?
    { code: 'INVALID_COMMAND', message: 'Invalid command or missing options; use --help', nextAction: 'READ_HELP' } : publicError(error);
  process.stderr.write(JSON.stringify({ success: false, error: detail }) + '\n');
  process.exitCode = 1;
});

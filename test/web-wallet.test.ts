import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webWalletStatus } from '../src/shared/webWallet';

const scope = { server_time: Date.now(), chain_id: 97, signing_enabled: false, platform_authenticated: false, deployment_available: true, execution_chain_id: 97, environment: 'local' };
test('hosted pairing validates exact provider links and does not infer a wallet connection', () => {
  const waiting = { ...scope, phase: 'AWAITING_APP', url: 'https://app.binance.com/uni-qr/test-only',
    pairing_code: 'ab1234', expires_at: Date.now() + 300_000 };
  assert.equal(webWalletStatus(waiting, 97).wallet_address, undefined);
  for (const patch of [{ url: 'https://app.binance.com.attacker.example/qr' }, { signing_enabled: true },
    { platform_authenticated: true }, { chain_id: 56 }, { pairing_code: '<script>' }]) {
    assert.throws(() => webWalletStatus({ ...waiting, ...patch }, 97));
  }
});

test('a paired mainnet wallet does not imply testnet support or platform authentication', () => {
  const ready = { ...scope, phase: 'CONNECTED', wallet_address: `0x${'22'.repeat(20)}`, wallet_chain_id: 56,
    chain_supported: false, verified_at: Date.now(), session_expires_at: Date.now() + 100_000 };
  const actual = webWalletStatus(ready, 97);
  assert.equal(actual.chain_supported, false);
  assert.equal(actual.wallet_chain_id, 56);
  assert.throws(() => webWalletStatus({ ...ready, chain_supported: true }, 97));
  assert.throws(() => webWalletStatus({ ...ready, verified_at: Date.now() - 60_000 }, 97));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentEnvironment as selectEnvironment } from '../src/shared/deploymentEnvironment';

const deploymentEnvironment = (mode: string | undefined, chain: string | undefined, dev: boolean) => selectEnvironment(mode, chain, dev, { local: 97, production: 56 });

test('local remains 97 and production remains 56 across build modes', () => {
  assert.equal(deploymentEnvironment('local', '97', false).chainId, 97);
  assert.equal(deploymentEnvironment('production', '56', true).chainId, 56);
  assert.equal(deploymentEnvironment(undefined, undefined, false).chainId, 56);
  assert.equal(deploymentEnvironment(undefined, undefined, true).chainId, 97);
  for (const [environment, chain] of [['local', '56'], ['production', '97'], ['production', '31337'], ['unknown', '56']]) {
    assert.throws(() => deploymentEnvironment(environment, chain, false));
  }
});

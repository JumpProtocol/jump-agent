/** Validate explicit environments; legacy chain-only configurations remain usable. */
export function deploymentEnvironment(mode: string | undefined, chain: string | undefined, development: boolean,
  networks: { local: number; production: number }) {
  const selected = chain ? Number(chain) : undefined;
  const environment = mode || (selected === networks.local ? 'local' : selected === networks.production ? 'production' : development ? 'local' : 'production');
  if (environment !== 'local' && environment !== 'production') throw new Error('Invalid deployment environment');
  const expected = networks[environment];
  if (selected !== undefined && selected !== expected) throw new Error('Deployment environment and default chain disagree');
  return { environment, chainId: expected };
}

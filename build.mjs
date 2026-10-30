import { build } from 'esbuild';

await build({
  entryPoints: { cli: 'src/cli.ts', sdk: 'src/shared/auction.ts' },
  outdir: 'dist', platform: 'node', target: 'node22', format: 'esm',
  bundle: true, packages: 'external', sourcemap: true, tsconfigRaw: { compilerOptions: {} },
});

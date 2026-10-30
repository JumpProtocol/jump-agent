import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tests = readdirSync('test').filter(file => file.endsWith('.test.ts'));
await build({ entryPoints: { cli: 'src/cli.ts' }, outdir: 'dist', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external', tsconfigRaw: { compilerOptions: {} } });
await build({ entryPoints: tests.map(file => `test/${file}`), outdir: 'dist/test',
  bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', tsconfigRaw: { compilerOptions: {} } });
const result = spawnSync(process.execPath, ['--test', ...tests.map(file => `dist/test/${file.replace(/\.ts$/, '.js')}`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;

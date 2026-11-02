#!/usr/bin/env node
/** Standalone installer. Downloads are never executed before explicit --apply. */
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { constants } from 'node:fs';
import { open, mkdir, lstat, readFile, writeFile, rename, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const sha = b => createHash('sha256').update(b).digest('hex');
const version = /^\d+\.\d+\.\d+$/;
const address = /^0x[0-9a-fA-F]{40}$/;
const requiredFiles = ['dist/cli.js', 'dist/sdk.js', 'npm-shrinkwrap.json', 'package.json'];
export function safeOrigin(value) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !(u.protocol === 'https:' || u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname))) throw new Error('Use a trusted HTTPS origin');
  return u.origin;
}
function safeRpc(value) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !(u.protocol === 'https:' || u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname))) throw new Error('Use a credential-free HTTPS RPC origin');
  return u.href;
}
export async function bounded(url, maximum) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error('Download unavailable');
  const reader = response.body.getReader(); const parts = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) throw new Error('Download exceeds limit');
      parts.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(parts);
}
async function api(origin, path) {
  const data = JSON.parse((await bounded(origin + path, 100000)).toString());
  if (data.code !== 0) throw new Error('Deployment discovery unavailable');
  return data.data;
}
export function validateManifest(m) {
  if (m?.schema_version !== 1 || !version.test(m.version) || m.node !== '>=22' ||
      m.release_state !== 'candidate' || m.working_tree_dirty !== false) throw new Error('Not a clean release candidate');
  for (const [key, prefix, suffix] of [['runtime','agent','tgz'],['skill','skill','zip']]) {
    const a = m[key];
    if (!a || !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.bytes) || a.bytes < 1 || a.bytes > 2000000 ||
        a.path !== '/agent-distribution/v'+m.version+'/jump-'+prefix+'-'+a.sha256+'.'+suffix) throw new Error('Invalid release artifact');
  }
  return m;
}
export function unpackRuntime(data) {
  const tar = gunzipSync(data, { maxOutputLength: 8 * 1024 * 1024 }); const files = new Map(); let offset = 0;
  while (offset + 512 <= tar.length) {
    const h = tar.subarray(offset, offset + 512); if (h.every(b => b === 0)) break;
    const field = (start, end) => h.subarray(start,end).toString().replace(/\0.*$/s,'');
    const stored = parseInt(field(148,156).trim(),8);
    const sum = [...h].reduce((a,b,i) => a + (i >=148 && i <156 ? 32 : b),0);
    if (sum !== stored || field(345,500) || ![0,48].includes(h[156])) throw new Error('Unsafe archive header');
    const name = field(0,100); const rawSize = field(124,136).trim();
    if (!/^[0-7]+$/.test(rawSize)) throw new Error('Invalid archive size');
    const size = parseInt(rawSize,8);
    const relative = name.startsWith('package/') ? name.slice(8) : '';
    if (!requiredFiles.includes(relative) || files.has(relative) || size > 4*1024*1024 || offset+512+size > tar.length) throw new Error('Unexpected archive entry');
    files.set(relative,tar.subarray(offset+512,offset+512+size));
    offset += 512 + Math.ceil(size/512)*512;
  }
  if (files.size !== requiredFiles.length) throw new Error('Incomplete runtime');
  return files;
}
async function privateDirectory(path) {
  await mkdir(path,{recursive:true,mode:0o700});
  const s = await lstat(path);
  if (s.isSymbolicLink() || !s.isDirectory() || (process.getuid && s.uid !== process.getuid()) || s.mode & 0o077) throw new Error('Installer directory must be private and owned by you');
  if (await realpath(path) !== path) throw new Error('Installer directory must not traverse symlinks');
}
async function privateJson(path, optional = false) {
  let f;
  try { f = await open(path,constants.O_RDONLY|constants.O_NOFOLLOW); }
  catch(e) { if (optional && e.code === 'ENOENT') return null; throw e; }
  try {
    const s = await f.stat();
    if (!s.isFile() || s.size > 65536 || s.mode & 0o077 || process.getuid && s.uid !== process.getuid()) throw new Error('Unsafe installer record');
    return JSON.parse(await f.readFile('utf8'));
  } finally { await f.close(); }
}
async function atomicJson(path,data) {
  const tmp=path+'.'+randomUUID()+'.tmp';
  const file=await open(tmp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try { await file.writeFile(JSON.stringify(data,null,2)+'\n'); await file.sync(); } finally { await file.close(); }
  await rename(tmp,path);
  const dir=await open(dirname(path),constants.O_RDONLY);
  try { await dir.sync(); } finally { await dir.close(); }
}
export async function assertNoPending(stateDir) {
  let entries; try { entries=await readdir(stateDir); } catch(e) { if(e.code==='ENOENT') return; throw e; }
  const stat=await lstat(stateDir);
  if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(stateDir)!==stateDir) throw new Error('Unsafe operation-state directory');
  if (entries.some(n=>/^pending-.*\.json$/.test(n))) throw new Error('Resolve pending wallet submissions before upgrade; operation records are preserved');
}
function configIdentity(c) {
  return JSON.stringify([c.JUMP_API_URL,c.JUMP_CHAIN_ID,c.JUMP_AUCTION_ENGINE?.toLowerCase(),c.JUMP_LAUNCH_FACTORY?.toLowerCase(),c.JUMP_AUTH_AUDIENCE,c.JUMP_AGENT_DIR]);
}
async function doctor(directory,config) {
  const { stdout } = await exec(process.execPath,[join(directory,'dist/cli.js'),'doctor'],{
    env:{...process.env,...config}, timeout:120000,maxBuffer:65536,
  });
  const r=JSON.parse(stdout);
  if(!r.success || r.data?.status!=='READ_ONLY_CHECKS_PASSED') throw new Error('Installed deployment checks failed');
}
export async function setup(options) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ required');
  const origin=safeOrigin(options.origin);
  const root=resolve(options.directory || join(homedir(),'.jump-install'));
  const stateDir=resolve(options.stateDir || process.env.JUMP_AGENT_DIR || join(homedir(),'.jump-agent'));
  if(stateDir===root || stateDir.startsWith(root+'/') || root.startsWith(stateDir+'/')) throw new Error('Installation and operation-state directories must be separate');
  try {
    const existing = await lstat(root);
    if (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(root) !== root) throw new Error('Unsafe installer directory');
  } catch(e) { if(e.code !== 'ENOENT') throw e; }
  const current=await privateJson(join(root,'current.json'),true);
  const [m,caps,chains]=await Promise.all([
    bounded(origin+'/agent-distribution/manifest.json',16000).then(b=>validateManifest(JSON.parse(b))),
    api(origin,'/api/agent/v1/capabilities'),api(origin,'/api/chains'),
  ]);
  const chain=chains.find(c=>c.chain_id===caps.execution_chain_id);
  if(!chain || !caps.local_mcp?.enabled || !address.test(chain.auction_engine) || !address.test(chain.launch_factory) ||
      caps.authentication_audience!==origin) throw new Error('Unsupported or inconsistent deployment');
  const rpc=safeRpc(options.rpc || current?.config?.JUMP_RPC_URL || '');
  const config={JUMP_API_URL:origin,JUMP_CHAIN_ID:String(chain.chain_id),JUMP_RPC_URL:rpc,
    JUMP_AUCTION_ENGINE:chain.auction_engine,JUMP_LAUNCH_FACTORY:chain.launch_factory,
    JUMP_AUTH_AUDIENCE:caps.authentication_audience,JUMP_AGENT_DIR:stateDir};
  const changed=current && configIdentity(current.config)!==configIdentity(config);
  const downgrade=current && compareVersions(m.version,current.version)<0;
  const plan={installedVersion:current?.version || null,availableVersion:m.version,updateAvailable:current?.version!==m.version,
    releaseArtifactChanged:!!current && current.version===m.version && current.runtimeSha256!==m.runtime.sha256,
    deploymentChanged:!!changed,downgrade:!!downgrade,configuration:config,installationDirectory:root,operationStatePreserved:stateDir,
    runtimeSha256:m.runtime.sha256,skillSha256:m.skill.sha256,
    apply:!!options.apply,trust:'HTTPS publisher and same-origin hashes; doctor checks chain consistency, not independent publisher authenticity'};
  if(!options.apply) return plan;
  if(changed) throw new Error('Deployment/state configuration changed; inspect the plan and use a separate installation directory');
  if(downgrade) throw new Error('Automatic downgrade refused');
  if(plan.releaseArtifactChanged) throw new Error('Same-version artifact changed; install refused');
  await assertNoPending(stateDir);
  await privateDirectory(root);
  const lock=await open(join(root,'install.lock'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try {
    // Never overwrite old versions or touch wallet journals, sessions, guards or Binance files.
    const bytes=await bounded(origin+m.runtime.path,2000000);
    if(bytes.length!==m.runtime.bytes || sha(bytes)!==m.runtime.sha256) throw new Error('Runtime checksum mismatch');
    const files=unpackRuntime(bytes);
    const pkg=JSON.parse(files.get('package.json'));
    const shrink=JSON.parse(files.get('npm-shrinkwrap.json'));
    if(pkg.version!==m.version || pkg.scripts || pkg.engines?.node!=='>=22' || shrink.version!==m.version) throw new Error('Unexpected package metadata');
    for(const item of Object.values(shrink.packages || {})) {
      if(item.resolved && (!item.resolved.startsWith('https://registry.npmjs.org/') || !item.integrity)) throw new Error('Untrusted dependency source');
    }
    const versions=join(root,'versions'); await privateDirectory(versions);
    const destination=join(versions,'v'+m.version+'-'+m.runtime.sha256.slice(0,12)+'-'+randomUUID());
    await mkdir(destination,{mode:0o700});
    for(const [name,content] of files) {
      await mkdir(dirname(join(destination,name)),{recursive:true,mode:0o700});
      await writeFile(join(destination,name),content,{flag:'wx',mode:0o600});
    }
    const skill=await bounded(origin+m.skill.path,2000000);
    if(skill.length!==m.skill.bytes || sha(skill)!==m.skill.sha256) throw new Error('Skill checksum mismatch');
    await writeFile(join(destination,'jump-skill.zip'),skill,{flag:'wx',mode:0o600});
    await exec(process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{
      cwd:destination,timeout:120000,maxBuffer:200000,env:{...process.env,npm_config_registry:'https://registry.npmjs.org/'},
    });
    await doctor(destination,config);
    const record={version:m.version,directory:destination,config,runtimeSha256:m.runtime.sha256,skillSha256:m.skill.sha256};
    // Stable launcher has no credential material. Only current.json switches after all checks pass.
    const launcher=`import {readFileSync} from 'node:fs';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';const c=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'current.json'),'utf8'));const p=spawn(process.execPath,[join(c.directory,'dist/cli.js'),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,...c.config}});p.on('error',()=>{process.exitCode=1});p.on('exit',code=>{process.exitCode=code??1});\n`;
    const launcherPath=join(root,'jump.mjs');
    try { const s = await lstat(launcherPath); if (!s.isFile() || s.isSymbolicLink() || s.mode & 0o077) throw new Error('Unsafe launcher'); } catch(e) { if(e.code!=='ENOENT') throw e; await writeFile(launcherPath,launcher,{flag:'wx',mode:0o600}); }
    await atomicJson(join(root,'mcp-config.json'),{mcpServers:{'jump-local':{command:process.execPath,args:[launcherPath,'mcp']}}});
    if(current) await atomicJson(join(root,'previous.json'),current);
    await atomicJson(join(root,'current.json'),record);
    return {...plan,status:'INSTALLED_AND_VERIFIED',mcp:{command:process.execPath,args:[launcherPath,'mcp']},
      skillArchive:join(destination,'jump-skill.zip'),next:'Import this MCP command and Skill in your Agent client; restart MCP after upgrade. Wallet pairing/login are separate.'};
  } finally { await lock.close(); const {unlink}=await import('node:fs/promises'); await unlink(join(root,'install.lock')); }
}
export function compareVersions(a,b) {
  const x=a.split('.').map(Number),y=b.split('.').map(Number);
  for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i]?1:-1;
  return 0;
}
async function main() {
  const args=process.argv.slice(2),o={};
  if(!args.length || args.includes('--help')) {
    console.log('Jump setup / check / safe upgrade: node jump-setup.mjs --origin https://app.jump.family --rpc https://YOUR-RPC/ [--directory /ABSOLUTE/INSTALL] [--state-dir /EXISTING/STATE] [--apply]\nWithout --apply: discover deployment and show versions/configuration only. With --apply: verify, install side-by-side, run doctor, then atomically switch launcher. Re-run for updates. Skill archive is downloaded; import it in your client. Pending guards block upgrade. No wallet signing or pairing is performed.');return;
  }
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--apply') o.apply=true;
    else if(['--origin','--rpc','--directory','--state-dir'].includes(args[i]) && args[i+1] && !args[i+1].startsWith('--')) {
      const k={'--origin':'origin','--rpc':'rpc','--directory':'directory','--state-dir':'stateDir'}[args[i]];o[k]=args[++i];
    } else throw new Error('Unknown or incomplete option');
  }
  console.log(JSON.stringify(await setup(o),null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{console.error('Jump setup failed; current installation and wallet records are retained. Check origin, RPC, private directories, pending submissions and release integrity.');process.exitCode=1;});
}

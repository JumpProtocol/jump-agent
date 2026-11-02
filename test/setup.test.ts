import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const load = () => import(pathToFileURL(resolve('connect/jump-setup.mjs')).href);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function archive(version: string, passed = true) {
  const pkg = { name: 'jump-install-test', version, type: 'module', engines: { node: '>=22' }, dependencies: {} };
  const files: Record<string, string> = {
    'package.json': JSON.stringify(pkg),
    'npm-shrinkwrap.json': JSON.stringify({ name: pkg.name, version, lockfileVersion: 3, packages: { '': pkg } }),
    'dist/cli.js': 'console.log(JSON.stringify({success:true,data:{status:"'+(passed ? 'READ_ONLY_CHECKS_PASSED' : 'CHECKS_FAILED')+'"}}));',
    'dist/sdk.js': 'export {};',
  };
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.from(text), h = Buffer.alloc(512);
    h.write('package/'+name); h.write(bytes.length.toString(8).padStart(11,'0')+'\0',124);
    h.fill(32,148,156); h[156]=48;
    h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
    blocks.push(h, bytes, Buffer.alloc((512-bytes.length%512)%512));
  }
  return gzipSync(Buffer.concat([...blocks,Buffer.alloc(1024)]));
}

test('installer rejects unsafe archives and untrusted download paths', async () => {
  const { unpackRuntime, validateManifest, safeOrigin } = await load();
  assert.equal(unpackRuntime(archive('1.0.0')).size,4);
  assert.throws(()=>unpackRuntime(gzipSync(Buffer.from('not tar'))));
  const bytes = archive('1.0.0'); bytes[15]^=1;
  assert.throws(()=>unpackRuntime(bytes));
  assert.throws(()=>validateManifest({schema_version:1,version:'1.0.0',node:'>=22',release_state:'candidate',working_tree_dirty:false,runtime:{path:'https://evil.example/code',sha256:'a'.repeat(64),bytes:1}}));
  assert.throws(()=>safeOrigin('https://user:secret@example.com'));
});

test('setup installs side-by-side, verifies before switching and preserves all operation records', async () => {
  const { setup } = await load();
  const parent = await mkdtemp(join(await import('node:fs/promises').then(f=>f.realpath(tmpdir())), 'jump-setup-'));
  const root=join(parent,'install'),state=join(parent,'state');
  await mkdir(state,{mode:0o700});
  const evidence=Buffer.from('pending transaction evidence and private session stay unchanged');
  await writeFile(join(state,'journal.json'),evidence,{mode:0o600});
  let origin='',ver='1.0.0',pass=true;
  let race = false;
  const server=createServer(async (req,res)=>{
    const runtime=archive(ver,pass),skill=Buffer.from('test skill download');
    if (race && req.url==='/agent-distribution/manifest.json') {
      const active=JSON.parse(await readFile(join(root,'current.json'),'utf8'));
      await writeFile(join(root,'current.json'),JSON.stringify({...active,version:'9.9.9'}),{mode:0o600});
    }
    const item=(kind: string,b: Buffer,suffix: string)=>({path:'/agent-distribution/v'+ver+'/jump-'+kind+'-'+sha(b)+'.'+suffix,sha256:sha(b),bytes:b.length});
    if(req.url==='/agent-distribution/manifest.json') res.end(JSON.stringify({schema_version:1,version:ver,node:'>=22',release_state:'candidate',working_tree_dirty:false,runtime:item('agent',runtime,'tgz'),skill:item('skill',skill,'zip')}));
    else if(req.url==='/api/agent/v1/capabilities') res.end(JSON.stringify({code:0,data:{execution_chain_id:97,local_mcp:{enabled:true},authentication_audience:origin}}));
    else if(req.url==='/api/chains') res.end(JSON.stringify({code:0,data:[{chain_id:97,auction_engine:'0x'+'11'.repeat(20),launch_factory:'0x'+'22'.repeat(20)}]}));
    else if(req.url?.endsWith('.tgz')) res.end(runtime);
    else if(req.url?.endsWith('.zip')) res.end(skill);
    else {res.statusCode=404;res.end();}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const options={origin,rpc:origin,directory:root,stateDir:state};
  try {
    const plan=await setup(options);
    assert.equal(plan.apply,false);
    await assert.rejects(()=>readFile(join(root,'current.json')));
    const first=await setup({...options,apply:true});
    assert.equal(first.status,'INSTALLED_AND_VERIFIED');
    assert.deepEqual(first.mcp.args,[join(root,'jump.mjs'),'mcp']);
    const current=await readFile(join(root,'current.json'));
    ver='1.0.1';race=true;
    await assert.rejects(()=>setup({...options,apply:true}),/Installation changed/);
    race=false;await writeFile(join(root,'current.json'),current,{mode:0o600});
    pass=false;
    await assert.rejects(()=>setup({...options,apply:true}),/checks failed/);
    assert.deepEqual(await readFile(join(root,'current.json')),current);
    pass=true;
    await writeFile(join(state,'pending-test.json'),'{"previewId":"original"}',{mode:0o600});
    await assert.rejects(()=>setup({...options,apply:true}),/pending/);
    assert.deepEqual(await readFile(join(root,'current.json')),current);
    await rm(join(state,'pending-test.json'));
    const second=await setup({...options,apply:true});
    assert.equal(second.availableVersion,'1.0.1');
    assert.deepEqual(await readFile(join(root,'previous.json')),current);
    assert.deepEqual(await readFile(join(state,'journal.json')),evidence);
    assert.ok(await readFile(JSON.parse(current.toString()).directory+'/dist/cli.js'));
  } finally { server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(parent,{recursive:true,force:true}); }
});

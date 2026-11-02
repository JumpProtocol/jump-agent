"""Create content-hashed downloads from four runtime files and three Skill files.

No checkout archive, environment files, credentials, install hooks or private RPC.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
agent = root
output = root / 'release/agent-distribution'
parser = argparse.ArgumentParser()
parser.add_argument('--production', action='store_true')
args = parser.parse_args()
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=root, text=True).strip())
if args.production:
    tag = subprocess.run(['git', 'describe', '--exact-match', '--tags', 'HEAD'], cwd=root, text=True, capture_output=True)
    version = json.loads((agent / 'package.json').read_text())['version']
    if dirty or tag.returncode or tag.stdout.strip() != 'v'+version:
        raise SystemExit('Production artifacts require a clean checkout at the matching vVERSION tag; no artifacts were changed')
subprocess.run(['node', 'build.mjs'], cwd=agent, check=True)
source = json.loads((agent / 'package.json').read_text())
lock = json.loads((agent / 'package-lock.json').read_text())
pkg = {key: source[key] for key in ('name', 'version', 'private', 'type', 'engines', 'bin', 'exports', 'dependencies')}
pkg['files'] = ['dist/cli.js', 'dist/sdk.js', 'npm-shrinkwrap.json']
for entry in lock['packages'].values():
    if entry.get('resolved') and (not entry['resolved'].startswith('https://registry.npmjs.org/') or not entry.get('integrity')):
        raise RuntimeError('Unexpected or unlocked dependency source')
lock['packages'][''] = {key: pkg[key] for key in ('name', 'version', 'dependencies', 'bin', 'engines')}
files = {'package.json': (json.dumps(pkg, indent=2)+'\n').encode(),
         'npm-shrinkwrap.json': (json.dumps(lock, indent=2)+'\n').encode()}
for file in ('dist/cli.js', 'dist/sdk.js'):
    path = agent / file
    if path.is_symlink() or not path.is_file():
        raise RuntimeError('Release input is not a regular file')
    files[file] = path.read_bytes()
raw = io.BytesIO()
with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as archive:
    for name, data in sorted(files.items()):
        info = tarfile.TarInfo('package/'+name)
        info.mode, info.mtime, info.size = 0o644, 0, len(data)
        archive.addfile(info, io.BytesIO(data))
compressed = io.BytesIO()
with gzip.GzipFile(fileobj=compressed, mode='wb', mtime=0) as stream:
    stream.write(raw.getvalue())
runtime = compressed.getvalue()
skill_buffer = io.BytesIO()
with zipfile.ZipFile(skill_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in ('SKILL.md', 'references/installation.md', 'references/public-api.md'):
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('Skill input is not a regular file')
        info = zipfile.ZipInfo('jump/'+name, date_time=(2026, 10, 30, 0, 0, 0))
        info.compress_type, info.external_attr = zipfile.ZIP_DEFLATED, 0o100644 << 16
        archive.writestr(info, path.read_bytes())
skill = skill_buffer.getvalue()
version_dir = 'v'+source['version']
(output / version_dir).mkdir(parents=True, exist_ok=True)
def publish(kind, data, suffix):
    digest = hashlib.sha256(data).hexdigest()
    relative = f'{version_dir}/jump-{kind}-{digest}.{suffix}'
    destination = output / relative
    if destination.exists() and destination.read_bytes() != data:
        raise RuntimeError('Immutable release collision')
    destination.write_bytes(data)
    return {'path': '/agent-distribution/'+relative, 'sha256': digest, 'bytes': len(data)}
manifest = {'schema_version': 1, 'version': source['version'], 'node': source['engines']['node'],
    'api_capabilities': '/api/agent/v1/capabilities', 'remote_mcp': None,
    'source_commit': commit, 'working_tree_dirty': dirty, 'release_state': 'candidate' if args.production else 'development',
    'live_wallet_acceptance': 'pending', 'runtime': publish('agent', runtime, 'tgz'),
    'skill': publish('skill', skill, 'zip'), 'connector': publish('connect', (agent / 'connect/jump-connect.mjs').read_bytes(), 'mjs'), 'runtime_files': sorted(files),
    'install': 'Extract into a new directory; in package run npm ci --omit=dev --ignore-scripts --no-audit --no-fund. No global install or administrator privileges.',
    'notes': 'Downloads do not grant wallet access. HTTP reads need no runtime. Execution requires official baw, verified configuration, an exact confirmed preview and durable receipt reconciliation.'}
temporary = output / 'manifest.next.json'
temporary.write_text(json.dumps(manifest, indent=2)+'\n')
temporary.replace(output / 'manifest.json')
print(json.dumps({'version': manifest['version'], 'runtime_sha256': manifest['runtime']['sha256'],
                  'skill_sha256': manifest['skill']['sha256']}))

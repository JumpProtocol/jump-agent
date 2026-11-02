"""Install a generated runtime into an isolated temp directory and test read-only startup.

Does not call baw, read a wallet session, sign, broadcast, or contact the app DB.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--public-root', type=Path)
args = parser.parse_args()
public = args.public_root.resolve() if args.public_root else root / 'release'
manifest = json.loads((public / 'agent-distribution/manifest.json').read_text())
expected = {'package/package.json', 'package/npm-shrinkwrap.json', 'package/dist/cli.js', 'package/dist/sdk.js'}
for kind in ('runtime', 'skill', *(['connector'] if manifest.get('connector') else [])):
    artifact = manifest[kind]
    path = public / artifact['path'].removeprefix('/')
    if hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
        raise RuntimeError('Checksum mismatch')
with zipfile.ZipFile(public / manifest['skill']['path'].removeprefix('/')) as skill:
    if set(skill.namelist()) != {'jump/SKILL.md', 'jump/references/installation.md', 'jump/references/public-api.md'}:
        raise RuntimeError('Unexpected Skill archive entries')
with tempfile.TemporaryDirectory(prefix='jump-agent-install-') as temp:
    with tarfile.open(public / manifest['runtime']['path'].removeprefix('/')) as runtime:
        if {entry.name for entry in runtime} != expected:
            raise RuntimeError('Unexpected runtime archive entries')
        if any(not entry.isfile() for entry in runtime):
            raise RuntimeError('Only regular files may be extracted')
        for entry in runtime:
            destination = Path(temp) / entry.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(runtime.extractfile(entry).read())
    package = Path(temp) / 'package'
    config = json.loads((package / 'package.json').read_text())
    if config.get('scripts'):
        raise RuntimeError('Runtime package must not have lifecycle scripts')
    result = subprocess.run(['npm', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
        cwd=package, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError('Isolated dependency install failed; raw diagnostics withheld')
    result = subprocess.run(['node', 'dist/cli.js', '--help'], cwd=package, capture_output=True, text=True, timeout=20)
    if result.returncode or 'Jump Agent tools' not in result.stdout:
        raise RuntimeError('Installed CLI did not start')
    child = subprocess.Popen(['node', 'dist/cli.js', '--api', 'http://127.0.0.1:9', '--chain-id', '97', 'mcp'],
        cwd=package, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    # initialise is protocol-only and must not require a wallet or live API.
    try:
        request = {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
            'protocolVersion': '2025-11-25', 'capabilities': {}, 'clientInfo': {'name': 'isolated-release-check', 'version': '1'}}}
        out, err = child.communicate(json.dumps(request)+'\n', timeout=20)
        replies = [json.loads(line) for line in out.splitlines() if line.startswith('{')]
        if not any(reply.get('id') == 1 and reply.get('result', {}).get('serverInfo') for reply in replies):
            raise RuntimeError('Installed MCP did not initialise')
    finally:
        if child.poll() is None:
            child.kill()
            child.wait()
print(json.dumps({'status': 'PASS', 'isolated_install': True, 'cli_help': True, 'mcp_initialise': True,
                  'wallet_accessed': False, 'archive_allowlist': True, 'checksums_verified': True, 'node_version': subprocess.check_output(['node', '-p', 'process.versions.node'], text=True).strip()}))

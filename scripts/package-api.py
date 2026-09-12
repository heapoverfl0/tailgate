"""Package the built API and installed, lockfile-listed production dependencies.

No downloads or lifecycle scripts. Run npm run build first.
"""
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / 'package-lock.json').read_text())
files = {}
for folder in ['dist/apps/api/src', 'dist/apps/poller/src', 'dist/packages']:
    for path in (root / folder).rglob('*.js'):
        if path.name.endswith('.test.js') or path.name in {'fixture.js', 'local.js'}:
            continue
        files[path.relative_to(root).as_posix()] = path.read_bytes()
if 'dist/apps/api/src/index.js' not in files:
    raise SystemExit('Build the API before packaging')
# Follow only dependencies reachable from API/shared workspaces; never ship web dependencies.
def resolve_dependency(package, parent):
    base = Path(parent)
    while True:
        candidate = (base / 'node_modules' / package).as_posix()
        if candidate in lock['packages']:
            entry = lock['packages'][candidate]
            return entry['resolved'] if entry.get('link') else candidate
        if base == Path('.'):
            raise SystemExit(f'Unresolved runtime dependency: {package}')
        base = base.parent

pending = ['apps/api'] + [p.parent.relative_to(root).as_posix() for p in (root / 'packages').glob('*/package.json')]
visited = set()
while pending:
    name = pending.pop()
    if name in visited:
        continue
    visited.add(name)
    info = lock['packages'][name]
    for dependency in {**info.get('dependencies', {}), **info.get('optionalDependencies', {})}:
        pending.append(resolve_dependency(dependency, name))
for name in sorted(visited):
    info = lock['packages'][name]
    if not name.startswith('node_modules/'):
        continue
    folder = root / name
    installed = json.loads((folder / 'package.json').read_text())
    if installed['version'] != info['version']:
        raise SystemExit(f'Installed version differs from reviewed lockfile: {name}')
    for path in sorted(folder.rglob('*')):
        if path.is_symlink():
            raise SystemExit(f'Unexpected dependency symlink: {path}')
        if path.is_file() and 'node_modules' not in path.relative_to(folder).parts:
            files[path.relative_to(root).as_posix()] = path.read_bytes()
files['package.json'] = b'{"type":"module","private":true}\n'
out = root / 'artifacts/api.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', compression=ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        entry = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, data)
print(f'Packaged {len(files)} files into {out} ({out.stat().st_size} bytes)')

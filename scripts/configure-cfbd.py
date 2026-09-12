"""Store a personal CFBD API key outside the repository without echoing it."""
from getpass import getpass
from pathlib import Path
import os
import tempfile

folder = Path.home() / '.config' / 'tailgate'
folder.mkdir(mode=0o700, parents=True, exist_ok=True)
key = getpass('CFBD API key (input hidden): ').strip()
if not key or any(c.isspace() for c in key):
    raise SystemExit('Expected a nonempty key without whitespace; nothing saved.')
fd, name = tempfile.mkstemp(prefix='.cfbd-', dir=folder)
try:
    with os.fdopen(fd, 'w') as stream:
        stream.write(key + '\n')
    os.replace(name, folder / 'cfbd-api-key')
finally:
    if os.path.exists(name):
        os.unlink(name)
print('Saved personal CFBD key with owner-only permissions. The key was not printed.')

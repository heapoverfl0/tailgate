"""Create a validated contest once through the personal deployed API.

Usage: python3 scripts/seed-contest.py contests/CONTEST.json
Existing contests are never overwritten.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from personal_aws import ROOT, verified_environment

if len(sys.argv) != 2:
    raise SystemExit(__doc__)
payload = Path(sys.argv[1]).resolve()
if payload.parent != ROOT / 'contests' or payload.suffix != '.json':
    raise SystemExit('Use a reviewed JSON file directly under contests/')
env = verified_environment()
with tempfile.NamedTemporaryFile(mode='w', prefix='tailgate-tf-', suffix='.tfrc') as config:
    env['TF_CLI_CONFIG_FILE'] = config.name
    url = subprocess.check_output(['/opt/homebrew/bin/terraform', '-chdir=infra/terraform', 'output', '-raw', 'web_url'], cwd=ROOT, env=env, text=True)
    raise SystemExit(subprocess.call([shutil.which('node'), 'scripts/seed-contest.mjs', url, str(payload)], cwd=ROOT, env=env))

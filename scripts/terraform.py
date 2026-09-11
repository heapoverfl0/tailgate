"""Run Terraform in one of Tailgate's two stacks with isolated personal AWS auth.

Usage: python3 scripts/terraform.py foundation|bootstrap plan [arguments...]
"""
import subprocess
import sys
import tempfile
from personal_aws import ROOT, verified_environment

if len(sys.argv) < 3 or sys.argv[1] not in {'foundation', 'bootstrap'}:
    raise SystemExit(__doc__)
stack = 'infra/terraform' + ('/bootstrap' if sys.argv[1] == 'bootstrap' else '')
env = verified_environment()
with tempfile.NamedTemporaryFile(mode='w', prefix='tailgate-tf-', suffix='.tfrc') as config:
    env['TF_CLI_CONFIG_FILE'] = config.name
    raise SystemExit(subprocess.call(['/opt/homebrew/bin/terraform', '-chdir=' + stack, *sys.argv[2:]], cwd=ROOT, env=env))

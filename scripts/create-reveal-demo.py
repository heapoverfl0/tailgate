"""Create a persistent, clearly labeled demo contest with fictional players and scores."""
import json
import shutil
import subprocess
import tempfile
from personal_aws import ROOT, verified_environment

env = verified_environment()
with tempfile.NamedTemporaryFile(mode='w', prefix='tailgate-tf-', suffix='.tfrc') as config:
    env['TF_CLI_CONFIG_FILE'] = config.name
    url = subprocess.check_output(['/opt/homebrew/bin/terraform', '-chdir=infra/terraform', 'output', '-raw', 'web_url'], cwd=ROOT, env=env, text=True)
    raise SystemExit(subprocess.call([shutil.which('node'), 'scripts/create-reveal-demo.mjs', url], cwd=ROOT, env=env))

"""Personal AWS child-process environment; never reads shared work profiles."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CLI = Path.home() / '.local/share/tailgate/aws-cli/2.36.42/aws'

def environment():
    home = Path.home()
    config = home / '.config/tailgate/aws'
    return {
        'HOME': str(home), 'PATH': '/usr/bin:/bin',
        'AWS_CONFIG_FILE': str(config / 'config'),
        'AWS_SHARED_CREDENTIALS_FILE': str(config / 'credentials'),
        'AWS_LOGIN_CACHE_DIRECTORY': str(config / 'login-cache'),
        'AWS_EC2_METADATA_DISABLED': 'true', 'AWS_REGION': 'us-east-2',
        'AWS_PROFILE': 'tailgate-personal', 'AWS_PAGER': '',
        'CHECKPOINT_DISABLE': '1',
    }

def verified_environment():
    env = environment()
    result = subprocess.check_output([str(CLI), 'sts', 'get-caller-identity'], env=env, text=True)
    if json.loads(result)['Account'] != '965984382163':
        raise SystemExit('Wrong AWS account; refusing operation')
    os.umask(0o077)
    return env

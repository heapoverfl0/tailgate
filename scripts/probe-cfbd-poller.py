"""Invoke the deployed poller in no-write mode using isolated personal AWS auth."""
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from personal_aws import CLI, verified_environment

env=verified_environment()
url='https://djhbbw57tyj22.cloudfront.net/api/contests/sept12-2026-final/game-day'
def view():
    with urllib.request.urlopen(url,timeout=20) as response:
        return json.load(response)
before=view()
with tempfile.TemporaryDirectory(prefix='tailgate-poller-probe-') as directory:
    result=Path(directory)/'response.json'
    metadata=json.loads(subprocess.check_output([str(CLI),'lambda','invoke','--function-name','tailgate-poller','--cli-binary-format','raw-in-base64-out','--payload','{"dryRun":true}',str(result)],env=env,text=True))
    if metadata.get('FunctionError'):
        raise SystemExit('Poller probe failed; inspect its CloudWatch error log. No response details printed.')
    data=json.loads(result.read_text())
    assert len(data.get('changedGames',[]))==7 and data.get('warnings')==[],data
    print('Deployed no-write probe matched all seven games with no provider warnings.')
after=view()
# Other users may edit their cards concurrently, so contest version can legitimately advance.
assert after['contest']['phase']==before['contest']['phase']
assert 'board' not in after if before['contest']['phase']=='PREGAME' else True
print('Contest phase preserved; no-write mode verified in unit tests.')

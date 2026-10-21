#!/usr/bin/env python3
"""Run once from QA worktree root; restore exact fixed source even on failure."""
import hashlib,json,subprocess
from pathlib import Path
source=Path('tixmoapi2/src/services/paid-sales-query.ts')
tests=[Path('tixmoapi2/tests/integration/paid-sales-utc.test.ts'),Path('tixmoapi2/tests/smoke/v1-market-smoke.test.ts')]
final='b0bc7e833345d847efa84d2a4957e289a1494bfc'
base='4ec8594850eb547dafc145a14bb1b85cdeaa235c'
fixed=subprocess.check_output(['git','show',final+':'+str(source)])
baseline=subprocess.check_output(['git','show',base+':'+str(source)])
assert source.read_bytes()==fixed
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in tests}
assert tests[1].read_bytes()==subprocess.check_output(['git','show',base+':'+str(tests[1])])
record={'baseline':base,'fixed':final,'baselineSourceSHA256':hashlib.sha256(baseline).hexdigest(),'fixedSourceSHA256':hashlib.sha256(fixed).hexdigest(),'testHashesBefore':before}
try:
 source.write_bytes(baseline)
 with open('docs/team/evidence/task-336/red-baseline/runtime.log','w') as log:
  run=subprocess.run(['bash','docs/team/evidence/task-336/red-baseline/runtime.sh'],stdout=log,stderr=subprocess.STDOUT)
 record['exitCode']=run.returncode
finally:
 source.write_bytes(fixed)
 record['sourceRestored']=source.read_bytes()==fixed
 record['testHashesAfter']={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in tests}
 record['testsUnchanged']=before==record['testHashesAfter']
 Path('docs/team/evidence/task-336/red-baseline/source-identity.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))

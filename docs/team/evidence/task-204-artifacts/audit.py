from pathlib import Path
import subprocess,json,hashlib,datetime
p=Path('docs/team/evidence/task-202-artifacts'); git=lambda *x:subprocess.check_output(['git',*x],text=True)
c='195f96d55187d1544f4373599b72652d87b0eb35'; e='e9dc30fea85c678ab6a7cc4533b9787780e8584e'
assert git('rev-parse',e+'^').strip()==c
files=git('diff','--name-only',c,e).splitlines(); assert len(files)==16 and all(f.startswith('docs/team/evidence/task-202') for f in files)
for line in (p/'SHA256SUMS').read_text().splitlines():
 h,f=line.split(); assert hashlib.sha256((p/f).read_bytes()).hexdigest()==h
for line in (p/'source-identity.log').read_text().splitlines():
 if len(line.split())==2 and len(line.split()[0])==64:
  h,f=line.split(); assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h
assert (p/'product-sha.txt').read_text().strip()==c
for f in ['package.json','package-lock.json']: assert Path('tixmoapi2',f).read_bytes()==Path('/home/daniel/projects/projectTixmo/worktrees/task-177/tixmoapi2',f).read_bytes()
print('PASS exact parent/candidate;16 docs-only files;14 raw checksums;source hashes;177 API manifests/locks identical')
r=(p/'runtime.sh').read_text(); old=git('show','e37f806:docs/team/evidence/task-196-artifacts/runtime.sh')
old=old.replace('196','202').replace('payment-paused-owner.baseline.test.ts tests/integration/payment-expired-successor.test.ts','payment-old-processing.baseline.test.ts')
assert r==old
b141=Path('docs/team/evidence/task-141-runtime.sh').read_text()
for name,end in [('alive','owned_identity'),('owned_identity','stop_exact'),('stop_exact','cleanup')]: assert r[r.index(name+'()'):r.index(end+'()')]==b141[b141.index(name+'()'):b141.index(end+'()')]
assert r.index('owned_identity pg "$pg_pid"\nowned_identity redis')<r.index('"$pgbin/createdb"')<r.index('validateVerificationTargets')<r.index('prisma db push')
assert 'umask 077' in r and 'TIXMO_EXPERIMENTAL_RECOVERY=1' in r and r.index('trap cleanup EXIT')<r.index('"$pgbin/initdb"')
print('PASS full196 script parity normalized labels and two focused paths replaced by one;141 lifecycle helper parity; fail-closed disk/identity/loopback/disposable-target checks before schema')
for f in ['schema.exit','focused.exit','runtime.exit']: assert (p/f).read_text().strip()=='0'
log=(p/'focused.log').read_text(); rows=[json.loads(x.split('TASK137_DURABLE ',1)[1]) for x in log.splitlines() if 'TASK137_DURABLE {' in x]; repeats=[json.loads(x.split('TASK198_TERMINAL_REPEAT ',1)[1]) for x in log.splitlines() if 'TASK198_TERMINAL_REPEAT {' in x]
assert len(rows)==2 and len(repeats)==1
fresh,anc=rows; assert fresh['ancient'] is False and anc['ancient'] is True
assert fresh['before']==fresh['after'] and fresh['before']['event']['attemptGeneration']=='0' and fresh['after']['emails']==0
b,a=anc['before'],anc['after']; assert b['event']['attemptGeneration']=='0' and a['event']['attemptGeneration']=='1'
assert a['event']==dict(b['event'],status='PROCESSED',attemptGeneration='1',processingStartedAt=a['event']['processingStartedAt'],processedAt=a['event']['processedAt'],updatedAt=a['event']['updatedAt'])
stamp=lambda x:datetime.datetime.fromisoformat(x.replace('Z','+00:00'))
assert stamp(a['event']['processingStartedAt'])>stamp(b['event']['processingStartedAt']) and stamp(a['event']['processedAt'])>=stamp(a['event']['processingStartedAt']) and stamp(a['event']['updatedAt'])>stamp(b['event']['updatedAt'])
assert a['target']==dict(b['target'],status='PAID',paymentStatus='SUCCEEDED',updatedAt=a['target']['updatedAt'])
assert a['target']['paymentIntentId']==b['target']['paymentIntentId']==a['event']['paymentIntentId']
assert a['other']==b['other'] and a['target']['tickets']==b['target']['tickets']
assert a['inventory']==dict(b['inventory'],quantityHeld=2,quantitySold=2,updatedAt=a['inventory']['updatedAt'])
for s in [b,a,fresh['before'],fresh['after']]:
 inv=s['inventory']; q=[inv[k] for k in ['quantityAvailable','quantityHeld','quantitySold']]; assert min(q)>=0 and sum(q)==inv['quantityTotal']; assert (s['tickets'],s['events'])==(4,1)
assert [b['inventory'][k] for k in ['quantityAvailable','quantityHeld','quantitySold']]==[6,4,0]
assert [a['inventory'][k] for k in ['quantityAvailable','quantityHeld','quantitySold']]==[6,2,2]
assert (b['emails'],a['emails'])==(0,1) and repeats[0]['ancient'] is True and repeats[0]['after']==a==repeats[0]['repeated']
assert 'Test Suites: 1 passed, 1 total' in log and 'Tests:       2 passed, 2 total' in log and 'skipped' not in log.lower()
print('PASS independently parsed raw fresh full equality0;ancient PROCESSED1 complete event lifecycle/time and business identity;PAID/SUCCEEDED original intent/tickets;6/4/0->6/2/2 nonnegative conservation;other/counts unchanged;one email;full terminal repeat equality ALL timestamps/generation/email/counts;schema/runtime/Jest0;1suite2tests no skips')
src=Path('tixmoapi2/tests/integration/payment-old-processing.baseline.test.ts').read_text()
for token in ['generateTestHeaderString','}, 15000)','finally { email.mockRestore(); }','await prisma.$disconnect()','toBe(0n)','toBe(1n)']: assert token in src
assert src.count('handleWebhook(signature, Buffer.from(payload))')==2 and '.skip' not in src
for sha,f in [('e389b6f3f526133607fb349f4b7d2384fb115c71','task-200-independent-lead-review.md'),('4f243da798cf834cadd4a099678cb18f68d2db01','task-201-independent-qa.md')]:
 body=git('show',sha+':docs/team/evidence/'+f); assert 'APPROVE' in body and c in body
print('PASS signed public repeat/nativeBigInt/15000ms/finally/disconnect preserved;lead200 andQA201 exactcandidate approvals exist')
for pid in [1359190,1359203]: assert not Path('/proc',str(pid)).exists()
assert not subprocess.check_output(['ss','-H','-ltnp','sport = :36207 or sport = :55877'],text=True).strip()
print('PASS independently observed exact PID1359190/1359203 and TCP36207/55877 absent')

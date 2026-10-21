import pathlib,json,hashlib,subprocess,os,stat
base=pathlib.Path('docs/team/evidence/task-390-nullpath')
raw=pathlib.Path('/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.w3oFCn')
assert stat.S_IMODE(raw.stat().st_mode)==0o700 and raw.stat().st_uid==os.getuid()
hash=lambda x:hashlib.sha256(x).hexdigest()
manifest=json.loads((base/'artifact-sha256.json').read_text())
raw_count=0
for name,digest in manifest.items():
 assert hash((base/name).read_bytes())==digest,name
 if (raw/name).exists():
  assert (raw/name).read_bytes()==(base/name).read_bytes(),name
  raw_count+=1
 else: print('REPORT_ONLY_ARTIFACT',name)
print(f'PASS {len(manifest)} manifest hashes; {raw_count} raw artifacts byte-identical retained owned0700 runtime')
m=json.loads((base/'measurement.json').read_text()); p=json.loads((base/'partial.json').read_text()); summary=json.loads((base/'summary.json').read_text())
r=m['results']; assert len(r)==200 and p['results']==r
for route,status in [('read',200),('order',201)]:
 items=[x for x in r if x['route']==route]; assert len(items)==100 and all(x['status']==status for x in items)
 assert set(x['i'] for x in items)==set(range(100))
 vals=sorted(x['ms'] for x in items)
 import math
 for pct in [50,95,99,100]:assert vals[math.ceil(len(vals)*pct/100)-1]==m['routeStats'][route]['p'+str(pct)]
assert len(set(x['id'] for x in r if x['route']=='order'))==100
assert m['arrived']==m['completed']==100 and m['maxActive']==2 and m['maxQueue']==1 and p['active']==0 and 'failure' not in p
samples=[s for s in m['samples'] if 'connections' in s]
assert len(samples)==63
for k in ['connections','lock_waiters','ungranted','rss','leases','backlog']:assert max(s[k] for s in samples)==summary['peaks'][k]
assert m['routeStats']==summary['routeStats']
print('PASS actual 100GET200+100POST201, 200results, unique100order IDs, percentiles recomputed, maxActive2 cap30, 63samples/peaks match')
identity=json.loads((base/'jest-identity.json').read_text()); listener=json.loads((base/'http-listener.json').read_text()); cleanup=json.loads((base/'cleanup.json').read_text()); observer=json.loads((base/'process-cleanup.json').read_text())
assert identity['runtimeRoot']==str(raw) and len(identity['runId'])==64
for k,v in identity.items():assert listener[k]==v
assert cleanup['identity']==observer['identity']==identity
assert identity['pid']==3292058 and identity['ppid']==3292057
assert listener['address']=={'address':'127.0.0.1','family':'IPv4','port':32911}
assert observer['errors']==cleanup['cleanupErrors']==[] and observer['pidAbsent'] and observer['listenerRows']=='' and cleanup['serverListening']==False
assert (base/'exit.txt').read_text().strip()=='0' and 'PASS ' in (base/'acceptance.log').read_text()
print('PASS cross-receipt current run/root/process/IPv4-port binding and cleanup errors[]; exit0/JestPASS')
prov=json.loads((base/'provenance.json').read_text()); deps=pathlib.Path(prov['dependencies'])
assert hash(pathlib.Path('tixmoapi2/package-lock.json').read_bytes())==hash((deps.parent/'package-lock.json').read_bytes())==prov['lock_sha256']==prov['dependency_lock_sha256']
schema=pathlib.Path('tixmoapi2/prisma/schema.prisma').read_bytes(); gen=(deps/'.prisma/client/schema.prisma').read_bytes()
assert hash(schema)==prov['schema_sha256'] and hash(gen)==prov['generated_schema_sha256'] and schema.split()==gen.split()
source='971275ba7c87b7d6d3d8831d6334922dcf618a05'
files=['docs/team/evidence/task-379/runtime.sh','docs/team/evidence/task-379/network-guard.cjs','docs/team/evidence/task-393/process-cleanup.cjs','tixmoapi2/tests/integration/orders-http-pressure.local.test.ts']
for file in files:
 blob=subprocess.check_output(['git','show',source+':'+file]);assert pathlib.Path(file).read_bytes()==blob
 print('SOURCE_SHA256',hash(blob),file)
print('PASS reviewed source files unchanged; actual installed exactlock/normalized generatedschema provenance')
for pid in [3291903,3291916,3292058]:assert not pathlib.Path('/proc/'+str(pid)).exists()
for port in [38404,55714,32911]:
 proc=subprocess.run(['ss','-H','-ltnp','sport = :'+str(port)],capture_output=True,text=True);assert proc.returncode==0 and proc.stdout.strip()==''
assert not (raw/'pg/postmaster.pid').exists() and not (raw/'.s.PGSQL.38404').exists()
print('PASS fresh live local /proc three exactPIDs absent; ss three exactports empty; postmaster and PGsocket absent (no connection/probe)')

import re,os,sys,glob,json,subprocess
from pathlib import Path
p=Path(sys.argv[1]);s=(p/'runtime.log').read_text();m=re.search(r'TASK338_RUNTIME path=(\S+) pg_pid=(\d+) redis_pid=(\d+) pgport=(\d+) redisport=(\d+)',s);assert m and 'TASK338_CLEANUP' in s
run,pg,redis,pp,rp=m.groups()
a={'runtime':run,'pids':{x:subprocess.run(['ps','-o','stat=,args=','-p',x],capture_output=True,text=True).stdout.strip() for x in [pg,redis]},'ports':[pp,rp],'listeners':subprocess.run(['ss','-H','-ltnp','sport = :'+pp+' or sport = :'+rp],capture_output=True,text=True).stdout,'sockets':glob.glob(run+'/*.sock')+glob.glob(run+'/.s.PGSQL.*'),'pidfile':os.path.exists(run+'/pg/postmaster.pid'),'blockedNetworkLog':(p/'blocked-network.jsonl').exists(),'runtimeMode':oct(os.stat(run).st_mode&0o777),'parentMode':oct(os.stat(os.path.dirname(run)).st_mode&0o777),'filesystem':subprocess.run(['findmnt','-n','-o','SOURCE,FSTYPE','-T',run],capture_output=True,text=True).stdout.strip()}
workers=[]
for d in glob.glob('/proc/[0-9]*'):
 try:
  exe=os.readlink(d+'/exe');cmd=open(d+'/cmdline','rb').read().replace(b'\0',b' ').decode();cwd=os.readlink(d+'/cwd')
  if 'node' in os.path.basename(exe) and ('task-338' in cmd or 'task-338' in cwd):workers.append({'pid':d.split('/')[-1],'cmd':cmd,'cwd':cwd})
 except (OSError,UnicodeError):pass
a['workers']=workers;a['rootContextFiles']=glob.glob(run+'/*context*')+glob.glob(str(p/'context-*.json'))
(p/'cleanup.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a,indent=2))
assert not any(a['pids'].values()) and not a['listeners'] and not a['sockets'] and not a['pidfile'] and not a['blockedNetworkLog'] and not workers and not a['rootContextFiles']

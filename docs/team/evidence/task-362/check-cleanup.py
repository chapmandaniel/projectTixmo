import json,subprocess,pathlib,os,re,stat
p=pathlib.Path(__file__).parent;log=(p/'runtime.log').read_text()
m=re.search(r'path=(\S+) pg_pid=(\d+) redis_pid=(\d+) pgport=(\d+) redisport=(\d+)',log);run,pg,redis,pp,rp=m.groups()
assert 'TASK362_CLEANUP' in log
ports=subprocess.check_output(['ss','-H','-ltnp',f'sport = :{pp} or sport = :{rp}'],text=True)
workers=[]
for q in pathlib.Path('/proc').iterdir():
 if not q.name.isdigit():continue
 try:
  exe=os.path.realpath(q/'exe');cmd=(q/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
 except (FileNotFoundError,ProcessLookupError,PermissionError):continue
 if ('node' in os.path.basename(exe) or 'postgres' in os.path.basename(exe) or 'redis-server' in os.path.basename(exe)) and (run in cmd or '/worktrees/task362/' in cmd):workers.append({'pid':q.name,'cmd':cmd})
d={'runtime':run,'mode':oct(stat.S_IMODE(os.stat(run).st_mode)),'servicePidsAbsent':{pg:not os.path.exists('/proc/'+pg),redis:not os.path.exists('/proc/'+redis)},'ports':[int(pp),int(rp)],'listenerOutput':ports,'remainingSocketFiles':[str(q) for q in pathlib.Path(run).rglob('*') if q.is_socket()],'postmasterPidfileAbsent':not pathlib.Path(run+'/pg/postmaster.pid').exists(),'remainingWorkers':workers,'blockedNetworkAttempts':(p/'blocked-network.jsonl').read_text() if (p/'blocked-network.jsonl').exists() else ''}
assert all(d['servicePidsAbsent'].values()) and not ports and not d['remainingSocketFiles'] and d['postmasterPidfileAbsent'] and not workers and not d['blockedNetworkAttempts'];(p/'cleanup.json').write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d))

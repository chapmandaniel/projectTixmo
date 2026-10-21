#!/usr/bin/env python3
"""Synthetic loopback render only; never loads Tixmo, DB, env or providers."""
import functools,hashlib,http.server,json,os,pathlib,signal,socket,subprocess,tempfile,threading,time
os.umask(0o077)
root=pathlib.Path(__file__).resolve().parents[2]; runtime=pathlib.Path('/home/daniel/projects/projectTixmo/runtime/task-283');out=root/'docs/evidence/task-283'
launcher=root/'scripts/runtime/task-283-chromium'
binary=pathlib.Path('/home/daniel/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell')
env=dict(os.environ,LD_LIBRARY_PATH=str(runtime/'root/usr/lib/x86_64-linux-gnu'))
ldd=subprocess.check_output(['ldd',str(binary)],env=env,text=True);assert 'not found' not in ldd
(out/'ldd.txt').write_text(ldd)
with socket.socket() as probe:
 probe.settimeout(1);assert probe.connect_ex(('127.0.0.1',9))!=0,'Proxy sink port must have no listener'
version=subprocess.check_output([str(launcher),'--version'],text=True).strip()
requests=[]
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  requests.append(self.path);self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(b'<html><body id="proof">before<script>document.getElementById("proof").textContent="TASK283_RENDER_EXECUTED";fetch("http://task283-external.invalid/").then(()=>document.body.dataset.network="UNEXPECTED").catch(()=>document.body.dataset.network="BLOCKED");</script></body></html>')
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
p=None;pgid=None;clean=False
try:
 with tempfile.TemporaryDirectory(dir=runtime,prefix='profile-') as profile:
  p=subprocess.Popen([str(launcher),'--user-data-dir='+profile,'--dump-dom','--virtual-time-budget=2000','http://127.0.0.1:'+str(server.server_port)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True);pgid=p.pid
  try: stdout,stderr=p.communicate(timeout=25)
  finally:
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   p.wait(timeout=5)
  assert p.returncode==0,(p.returncode,stderr)
  assert 'TASK283_RENDER_EXECUTED</body>' in stdout and 'data-network="BLOCKED"' in stdout,stdout
  (out/'render.html').write_text(stdout);(out/'browser-stderr.txt').write_text(stderr)
finally:
 server.shutdown();server.server_close();thread.join(timeout=3)
 if pgid:
  # Check the owned process group, never terminate unrelated processes.
  members=[]
  for item in pathlib.Path('/proc').iterdir():
   if item.name.isdigit():
    try:
     stat=(item/'stat').read_text().rsplit(')',1)[1].split()
     if int(stat[2])==pgid and stat[0]!='Z':members.append(int(item.name))
    except (FileNotFoundError,ProcessLookupError,PermissionError):pass
  assert not members,members
  clean=True
result=dict(status='PASS synthetic loopback DOM render; not Tixmo acceptance',version=version,binary=str(binary),binary_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),requests=requests,external_fetch='BLOCKED via dead proxy; reserved .invalid hostname',browser_pid=p.pid,browser_exit=p.returncode,owned_process_group_cleanup=clean,loopback_server_closed=not thread.is_alive(),network_boundary='Application-level dead proxy with exact 127.0.0.1 bypass and wildcard DNS failure; no OS network namespace; unshare denied by host')
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

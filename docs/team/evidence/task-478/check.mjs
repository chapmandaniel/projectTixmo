import a from 'node:assert/strict';import fs from 'node:fs';import {spawn,spawnSync} from 'node:child_process';
const src=fs.readFileSync('docs/team/evidence/task-432/retained-shell.sh','utf8');
const fixture=`
owned_run=/nonexistent-lead478-owned;pgbin=/nonexistent-lead478-bin
pg_pid=811;redis_pid=812;pgport=23001;redisport=43001;jest_attempted=0
phase=ready
alive(){ test "$phase" = ready; }
owned_identity(){ return 0; }
stop_exact(){ builtin printf 'STOP:%s:%s\\n' "$1" "$2"; }
wait(){ return 0; }
ss(){ case "$*" in *' or '*) return "\${OBSERVER_STATUS:-0}";; *23001*) echo 'LISTEN 0 1 127.0.0.1:23001 users:((fixture,pid=811,fd=1))';; *43001*) echo 'LISTEN 0 1 127.0.0.1:43001 users:((fixture,pid=812,fd=1))';; esac; }
printf(){ if test "$1" = 'TASK432_SHELL_HELD\\n';then phase=stopped;fi;builtin printf "$@"; }
read(){ builtin printf 'READ_BOUND:%s\\n' "$3" >&2;builtin read "$@"; }
`;
const env={PATH:'/usr/bin:/bin',PWD:process.cwd(),TMPDIR:process.env.TMPDIR};
function program(partial=false){return src.replace('  trap cleanup EXIT',fixture+(partial?'\npg_pid=;phase=stopped\n':'\n')+'  trap cleanup EXIT')+'\nretain_owned_shell\n';}
let n=0;const count=(s,p)=>(s.match(p)||[]).length;
function verify(r,status,held=true,marker=true){a.equal(r.status,status,r.stdout+r.stderr);a.equal(count(r.stdout,/TASK432_SHELL_HELD/g),held?1:0);a.equal(count(r.stdout,/STOP:redis:812/g),1);a.equal(count(r.stdout,/TASK379_CLEANUP/g),marker?1:0);n++;}
function sync(bound,input,status,{partial=false,observer='0',held=true,marker=true}={}){const e={...env,OBSERVER_STATUS:observer};if(bound!==undefined)e.TASK432_HELD_WAIT_SECONDS=bound;const r=spawnSync('/bin/bash',['--noprofile','--norc','-c',program(partial)],{env:e,input,encoding:'utf8',timeout:2500});verify(r,status,held,marker);return r;}
for(const b of ['', '0','00','01','001','301','999','1000','-1','+1','1.0','1e0',' 1','1 ','1\n','Infinity','NaN','999999999999999999999999999999999999']){const r=sync(b,'close\n',76,{partial:true,held:false});a.match(r.stderr,/Invalid TASK432_HELD_WAIT_SECONDS/);a.doesNotMatch(r.stderr,/READ_BOUND/);}
for(const b of [undefined,'1','9','10','99','100','299','300']){const r=sync(b,'close\nclose\n',0);a.match(r.stderr,new RegExp('READ_BOUND:'+(b??'60')+'\\n'));}
for(const input of ['','close','unknown\n','close \n',' close\n','CLOSE\n'])sync('1',input,74);
for(const input of ['close\n','close\nunknown\n'])sync('1',input,0);
const observer=sync('1','close\n',1,{observer:'23',marker:false});a.match(observer.stderr,/observation FAILED status=23/);
for(const partial of ['', 'close']){
 const start=performance.now();const c=spawn('/bin/bash',['--noprofile','--norc','-c',program()],{env:{...env,TASK432_HELD_WAIT_SECONDS:'1'},stdio:['pipe','pipe','pipe']});let stdout='',stderr='',sent=false;
 const watchdog=setTimeout(()=>c.kill('SIGKILL'),3500);c.stdin.on('error',()=>{});
 c.stdout.on('data',b=>{stdout+=b;if(!sent&&stdout.includes('TASK432_SHELL_HELD\n')){sent=true;if(partial)c.stdin.write(partial);}});c.stderr.on('data',b=>stderr+=b);
 const [status,signal]=await new Promise(r=>c.once('close',(...x)=>r(x)));clearTimeout(watchdog);c.stdin.destroy();a.equal(signal,null);verify({status,stdout,stderr},75);const elapsed=performance.now()-start;a(elapsed>=900&&elapsed<3000);a.match(stderr,/close NOT accepted/);console.log(JSON.stringify({partial,elapsed,status,marker:'cleanup only, NOT session success'}));
}
console.log(`PASS ${n} independent real Bash cases; injected inert identities/stop/listeners, genuine cleanup; default60/1..300 canonical boundaries, partialstartup76, input74/0, heldpipe75, oncecleanup/observer23`);

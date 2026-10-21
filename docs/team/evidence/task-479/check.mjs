import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
const source=fs.readFileSync('docs/team/evidence/task-432/retained-shell.sh','utf8');
const hooks=`
owned_run=/nonexistent-qa479;pgbin=/nonexistent-qa479-bin
pg_pid=901;redis_pid=902;pgport=23001;redisport=43001;jest_attempted=0;ready=1
alive(){ test "$ready" = 1; }
owned_identity(){ return 0; }
stop_exact(){ builtin printf 'STOP:%s:%s\\n' "$1" "$2"; }
wait(){ return 0; }
ss(){ case "$*" in *' or '*) return "\${OBSERVER:-0}";; *23001*) echo 'LISTEN 0 1 127.0.0.1:23001 users:((fixture,pid=901,fd=1))';; *43001*) echo 'LISTEN 0 1 127.0.0.1:43001 users:((fixture,pid=902,fd=1))';; esac; }
printf(){ if test "$1" = 'TASK432_SHELL_HELD\\n';then ready=0;fi; builtin printf "$@"; }
read(){ builtin printf 'BOUND:%s\\n' "$3" >&2;builtin read "$@"; }
`;
const env={PATH:'/usr/bin:/bin',PWD:process.cwd(),TMPDIR:process.env.TMPDIR};
function program(partial=false){return source.replace('  trap cleanup EXIT',hooks+(partial?'\npg_pid=;ready=0\n':'\n')+'  trap cleanup EXIT')+'\nretain_owned_shell\n';}
let count=0;
function check(r,status,held=true,marker=true){assert.equal(r.signal,null);assert.equal(r.status,status,r.stdout+r.stderr);for(const [pattern,n] of [[/STOP:redis:902/g,1],[/TASK432_SHELL_HELD/g,held?1:0],[/TASK379_CLEANUP/g,marker?1:0]])assert.equal((r.stdout.match(pattern)||[]).length,n,r.stdout+r.stderr);count++;}
function run(bound,input,status,{partial=false,observer='0',held=true,marker=true}={}){const e={...env,OBSERVER:observer};if(bound!==undefined)e.TASK432_HELD_WAIT_SECONDS=bound;const r=spawnSync('/bin/bash',['--noprofile','--norc','-c',program(partial)],{env:e,input,encoding:'utf8',timeout:3000});check(r,status,held,marker);return r;}
for(const b of ['', '0','00','01','301','1000','-1','+1','1.0','1e0',' 1','1 ','1\n','Infinity','NaN','999999999999999999999']){const r=run(b,'close\n',76,{partial:true,held:false});assert.match(r.stderr,/Invalid TASK432_HELD_WAIT_SECONDS/);assert.doesNotMatch(r.stderr,/BOUND:/);}
for(const b of [undefined,'1','9','10','99','100','299','300'])assert.match(run(b,'close\nclose\n',0).stderr,new RegExp('BOUND:'+(b??'60')+'\\n'));
for(const input of ['', 'close','unknown\n','close \n',' close\n','CLOSE\n','close\r\n'])run('1',input,74);
run('1','close\nunknown\n',0);
for(const input of ['close\n','unknown\n'])assert.match(run('1',input,1,{observer:'23',marker:false}).stderr,/observation FAILED status=23/);
for(const [input,observer,status,marker] of [['','0',75,true],['close','0',75,true],['close','23',1,false]]){
 const start=performance.now();const c=spawn('/bin/bash',['--noprofile','--norc','-c',program()],{env:{...env,TASK432_HELD_WAIT_SECONDS:'1',OBSERVER:observer},stdio:['pipe','pipe','pipe']});let stdout='',stderr='',held=false;
 const timer=setTimeout(()=>c.kill('SIGKILL'),4000);c.stdin.on('error',()=>{});c.stdout.on('data',b=>{stdout+=b;if(!held&&stdout.includes('TASK432_SHELL_HELD\n')){held=true;if(input)c.stdin.write(input);}});c.stderr.on('data',b=>stderr+=b);
 const [code,signal]=await new Promise(resolve=>c.once('close',(...args)=>resolve(args)));clearTimeout(timer);c.stdin.destroy();check({status:code,signal,stdout,stderr},status,true,marker);assert(held);assert.match(stderr,/close NOT accepted/);if(observer==='23')assert.match(stderr,/observation FAILED status=23/);const ms=performance.now()-start;assert(ms>=900&&ms<3500,`${ms}`);console.log(JSON.stringify({input,observer,status,elapsedMs:ms}));
}
console.log(`PASS ${count} independent cases: genuine Bash timed read and EXIT cleanup, inert identity/listener/stop hooks`);

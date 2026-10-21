import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync,spawn,execFileSync} from 'node:child_process';
const root='docs/team/evidence/';
const src=fs.readFileSync(root+'task-432/retained-shell.sh','utf8');
const env={PATH:'/usr/bin:/bin',PWD:process.cwd()};
// Genuine retained shell and cleanup; inert function injection avoids all services/signals.
const hooks=`
pg_pid=818181; redis_pid=818182; pgport=23991; redisport=43991; jest_attempted=0
owned_run=/nonexistent-independent-qa474; pgbin=/nonexistent-independent-qa474
ready=1
alive(){ test "$ready" = 1; }
owned_identity(){ return 0; }
stop_exact(){ echo "STOP:$1"; }
wait(){ echo WAIT; }
printf(){ if test "$1" = 'TASK432_SHELL_HELD\\n'; then ready=0; fi; builtin printf "$@"; }
ss(){ case "$*" in *' or '*) echo OBSERVER >&2; if test "$OBS_FAIL" = 1; then test "$OBS_OUTPUT" = 1 && echo UNTRUSTED; return 23; fi; return 0;; *23991*) echo 'LISTEN 0 1 127.0.0.1:23991 users:((qa,pid=818181,fd=1))';; *43991*) echo 'LISTEN 0 1 127.0.0.1:43991 users:((qa,pid=818182,fd=1))';; esac; }
`;
const injected=src.replace('  trap cleanup EXIT',hooks+'\n  trap cleanup EXIT');
let groups=0;
function run(program,input,status){const r=spawnSync('bash',['--noprofile','--norc','-c',program+'\nretain_owned_shell'],{env,input,encoding:'utf8',timeout:2500});assert.equal(r.status,status,r.stdout+r.stderr);assert.equal(r.signal,null);return r;}
for(const primary of [0,67])for(const output of [0,1]){
const r=run(injected.replace('  exit 0','  exit '+primary)+'\nOBS_FAIL=1; OBS_OUTPUT='+output,'close\n',1);
assert.match(r.stdout,/SHELL_HELD/);assert.match(r.stderr,/cleanup listener observation FAILED status=23/);assert.doesNotMatch(r.stdout,/TASK379_CLEANUP/);groups++;
}
for(const primary of [0,67]){const r=run(injected.replace('  exit 0','  exit '+primary),'close\n',primary);assert.match(r.stdout,/STOP:redis\n\nTASK379_CLEANUP/);groups++;}
for(const [input,status] of [['close\nclose\n',0],['',74],['unknown\n',74],['close',74],['close \n',74]]){const r=run(injected,input,status);assert.equal((r.stdout.match(/STOP:redis/g)||[]).length,1);assert.equal((r.stdout.match(/TASK379_CLEANUP/g)||[]).length,1);groups++;}
for(const replacement of ['pg_pid=""; redis_pid="";','pg_pid=""; redis_pid=818182;']){const r=run(injected.replace('pg_pid=818181; redis_pid=818182;',replacement).replace('ready=1','ready=0'),'',72);assert.doesNotMatch(r.stdout,/SHELL_HELD/);assert.match(r.stdout,/STOP:redis/);groups++;}
// Real shell held alive after notification; a deferred turn confirms no cleanup
// while stdin remains open, then closes and reaps only this fixture child.
const child=spawn('bash',['--noprofile','--norc','-c',injected+'\nretain_owned_shell'],{env,stdio:['pipe','pipe','pipe']});
let out='',err='',held=false;
const timer=setTimeout(()=>child.kill(),2500);
child.stderr.on('data',b=>err+=b);
child.stdout.on('data',b=>{out+=b;if(!held&&out.includes('TASK432_SHELL_HELD\n')){held=true;setImmediate(()=>{assert.equal(child.exitCode,null);assert.doesNotMatch(out,/STOP:|CLEANUP/);child.stdin.end('close\n');});}});
const status=await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);assert.equal(status,0,out+err);assert(held);assert.equal((out.match(/TASK379_CLEANUP/g)||[]).length,1);groups++;
// Exact narrow correction and original runtime bytes remain independently pinned.
const get=(sha,path)=>execFileSync('git',['show',sha+':'+path],{encoding:'utf8'});
const path=root+'task-427/owned-lifecycle.sh';const before=get('8eaf5cec7fc62bf093bbf4cb401bcc0396a9b161',path);const after=fs.readFileSync(path,'utf8');
const marker='  echo "TASK379_CLEANUP pg_pid=$pg_pid redis_pid=$redis_pid pgport=$pgport redisport=$redisport"\n';
const observe='  listeners=$(ss -H -ltnp "sport = :$pgport or sport = :$redisport")\n';
const check='  observer_status=$?\n  if test "$observer_status" -ne 0; then\n    echo "Owned-runtime cleanup listener observation FAILED status=$observer_status; inspect $owned_run" >&2\n    exit 1\n  fi\n';
assert.equal(after,before.replace(marker,'').replace(observe,observe+check).replace('  exit "$original_status"',marker+'  exit "$original_status"'));
const runtime=fs.readFileSync(root+'task-427/runtime.sh','utf8');assert.equal(runtime.replace('source "$PWD/docs/team/evidence/task-427/owned-lifecycle.sh"\n',()=>before.slice(before.indexOf('alive() {'))),get('d5fec56e99a37218ef06a512e265c99942290340',root+'task-427/runtime.sh'));groups++;
// Candidate changes no command/default/nested gate or provider code.
const changed=execFileSync('git',['diff','--name-only','0d79445dce1b3c4f71db13c3e00838696bc094a4','dca0223422ad266a6f4e66836a1910ff445de7e0'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(changed,[path,root+'task-432/observer-repair.md',root+'task-432/offline-retained-shell.mjs',root+'task-432/offline-shell-functions.mjs']);groups++;
console.log(JSON.stringify({verdict:'PASS',independentGroups:groups,observerMatrix:4,primaryStatuses:[0,67],childrenReaped:true}));

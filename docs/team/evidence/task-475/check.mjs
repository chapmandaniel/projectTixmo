import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync,spawn} from 'node:child_process';
const src=fs.readFileSync('docs/team/evidence/task-432/retained-shell.sh','utf8');
const mocks=`
pg_pid=910001; redis_pid=910002; pgport=23111; redisport=43111; jest_attempted=0
owned_run=/nonexistent-lead473; pgbin=/nonexistent-lead473; state=ready
alive(){ test "$state" = ready; }
owned_identity(){ test "$FAIL_ID" != "$1"; }
stop_exact(){ echo "STOP:$1:$2"; test "$FAIL_STOP" != "$1"; }
printf(){ if test "$1" = 'TASK432_SHELL_HELD\\n'; then state=stopped; fi; builtin printf "$@"; }
ss(){ case "$*" in *' or '*) if test "$FAIL_SS" = 1; then test "$OUTPUT" = 1 && echo UNKNOWN; return 23; fi; test "$LEFTOVER" = 1 && echo LEFTOVER; return 0;; esac
 test "$FAIL_LISTENER" = 1 && return 22
 case "$*" in *23111*) echo 'LISTEN 0 1 127.0.0.1:23111 users:((fixture,pid=910001,fd=1))';; *43111*) echo 'LISTEN 0 1 127.0.0.1:43111 users:((fixture,pid=910002,fd=1))';; esac
}
`;
const injected=src.replace('  trap cleanup EXIT',mocks+'\n  trap cleanup EXIT');
let count=0;
function run(input,extra='',expected=0){const r=spawnSync('/bin/bash',['--noprofile','--norc','-c',injected+'\n'+extra+'\nretain_owned_shell'],{env:{PATH:'/usr/bin:/bin',PWD:process.cwd()},input,encoding:'utf8',timeout:2500});assert.equal(r.status,expected,r.stdout+r.stderr);count++;return r;}
for(const [input,status]of [['close\n',0],['close\nclose\n',0],['',74],['unknown\n',74],['close',74],['close \n',74]]){const r=run(input,'',status);assert.equal((r.stdout.match(/TASK379_CLEANUP/g)||[]).length,1);}
run('close\n','FAIL_STOP=redis',1);run('close\n','LEFTOVER=1',1);const denied=run('','FAIL_LISTENER=1',1);assert.doesNotMatch(denied.stdout,/SHELL_HELD/);
const partial=injected.replace('pg_pid=910001; redis_pid=910002;','pg_pid=""; redis_pid="";').replace('state=ready','state=stopped');let r=spawnSync('/bin/bash',['-c',partial+'\nretain_owned_shell'],{env:{PATH:'/usr/bin:/bin',PWD:process.cwd()},input:'',encoding:'utf8',timeout:2500});assert.equal(r.status,72);count++;
// Source is inert: sourcing and subshell invocation do not replace parent traps/options.
r=spawnSync('/bin/bash',['-c',`trap ':' EXIT; before=$(trap -p); options=$-; source docs/team/evidence/task-432/retained-shell.sh; test "$before" = "$(trap -p)" && test "$options" = "$-"`],{encoding:'utf8'});assert.equal(r.status,0);count++;
const child=spawn('/bin/bash',['-c',injected+'\nretain_owned_shell'],{env:{PATH:'/usr/bin:/bin',PWD:process.cwd()},stdio:['pipe','pipe','pipe']});let out='',err='',held=false;const timer=setTimeout(()=>child.kill(),2000);child.stderr.on('data',b=>err+=b);child.stdout.on('data',b=>{out+=b;if(!held&&out.includes('TASK432_SHELL_HELD\n')){held=true;assert.equal(child.exitCode,null);assert.doesNotMatch(out,/STOP:/);child.stdin.end('close\n')}});const code=await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);assert.equal(code,0,out+err);assert.equal(held,true);count++;
// Repair adversarial matrix: final observer status23, with/without stdout,
// primary success/failure. Every observation failure must deny success.
for(const primary of [0,73])for(const output of [0,1]){
 const program=injected.replace('  exit 0','  exit '+primary)+'\nFAIL_SS=1; OUTPUT='+output+'\nretain_owned_shell';
 const r=spawnSync('/bin/bash',['-c',program],{env:{PATH:'/usr/bin:/bin',PWD:process.cwd()},input:'close\n',encoding:'utf8',timeout:2500});
 assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stderr,/listener observation FAILED status=23/);assert.doesNotMatch(r.stdout,/TASK379_CLEANUP/);count++;
}
// Successful cleanup preserves original nonzero73, marker only after checks.
const primary=spawnSync('/bin/bash',['-c',injected.replace('  exit 0','  exit 73')+'\nretain_owned_shell'],{env:{PATH:'/usr/bin:/bin',PWD:process.cwd()},input:'close\n',encoding:'utf8',timeout:2500});assert.equal(primary.status,73);assert.match(primary.stdout,/TASK379_CLEANUP/);count++;
const identity=run('','FAIL_ID=pg',1);assert.doesNotMatch(identity.stdout,/SHELL_HELD/);
console.log(JSON.stringify({verdict:'PASS',independentGroups:count,observerRepairCases:4,successfulPrimary73Preserved:true,allFixtureChildrenReaped:true}));

import fs from 'node:fs';import a from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const rows=[];for(const [name,cmd,args] of [
['parity','node',['docs/team/evidence/task-432/offline-shell-functions.mjs']],
['exact12','node',['docs/team/evidence/task-432/offline-stub.mjs']],
['syntax-shell','bash',['-n','docs/team/evidence/task-432/retained-shell.sh']],
['syntax-own','node',['--check','docs/team/evidence/task-478/check.mjs']],
['diff','git',['diff','--check']],
['filesystem','findmnt',['-T',process.env.TMPDIR]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:15000});fs.writeFileSync(new URL(name+'.stdout',import.meta.url),r.stdout||'');fs.writeFileSync(new URL(name+'.stderr',import.meta.url),r.stderr||'');rows.push({name,cmd,args,status:r.status});a.equal(r.status,0,name);}
fs.writeFileSync(new URL('results.json',import.meta.url),JSON.stringify({TMPDIR:process.env.TMPDIR,rows},null,2)+'\n');console.log('PASS six commands');

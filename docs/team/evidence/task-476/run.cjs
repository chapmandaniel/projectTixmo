'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const d='docs/team/evidence/task-476/';
const jobs=[['independent','node',[d+'check.cjs']],['runner','node',['docs/team/evidence/task-426/runner-probes.cjs']],['shell','node',['docs/team/evidence/task-426/shell-probes.cjs']],['syntax-own','node',['--check',d+'check.cjs']],['syntax-author','node',['--check','docs/team/evidence/task-426/runner-probes.cjs']],['diff','git',['diff','--check']]];
fs.writeFileSync(d+'environment.json',JSON.stringify({TMPDIR:process.env.TMPDIR||null},null,2)+'\n');
const results=[];for(const [name,cmd,args]of jobs){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:30000});fs.writeFileSync(d+name+'.stdout',r.stdout);fs.writeFileSync(d+name+'.stderr',r.stderr);results.push({command:[cmd,...args],status:r.status,signal:r.signal});console.log(name,r.status);if(name==='independent'&&r.status===0){for(const v of ['false','true'])assert.equal(r.stderr.split('QA476_PRIMARY_STDERR_'+v).length-1,1);}}
fs.writeFileSync(d+'results.json',JSON.stringify(results,null,2)+'\n');assert(results.every(r=>r.status===0));

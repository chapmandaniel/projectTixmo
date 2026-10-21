'use strict';
const fs=require('node:fs'),a=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dir=__dirname;const results=[];
for(const [name,cmd,args] of [
 ['independent',process.execPath,['docs/team/evidence/task-477/check.cjs']],
 ['runner',process.execPath,['docs/team/evidence/task-426/runner-probes.cjs']],
 ['shell',process.execPath,['docs/team/evidence/task-426/shell-probes.cjs']],
 ['syntax-own',process.execPath,['--check','docs/team/evidence/task-477/check.cjs']],
 ['syntax-author',process.execPath,['--check','docs/team/evidence/task-426/runner-probes.cjs']],
 ['diff','git',['diff','--check']]]){
 const r=spawnSync(cmd,args,{encoding:'utf8',timeout:45000});fs.writeFileSync(dir+'/'+name+'.stdout',r.stdout||'');fs.writeFileSync(dir+'/'+name+'.stderr',r.stderr||'');results.push({name,cmd,args,status:r.status,signal:r.signal,error:r.error?.message});
 a.equal(r.status,0,name);if(name==='independent')for(const value of ['false','true'])a.equal(r.stderr.split('LEAD477_PRIMARY_'+value).length-1,1);if(name==='runner')a.equal(r.stderr.split('STUBBORN_PRIMARY_STDERR_SENTINEL').length-1,1);
}
fs.writeFileSync(dir+'/results.json',JSON.stringify({TMPDIR:process.env.TMPDIR,results},null,2)+'\n');console.log('PASS six actual commands and stderr sentinel counts');

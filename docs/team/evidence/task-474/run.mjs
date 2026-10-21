import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const dir='docs/team/evidence/task-474/';
const commands=[['independent','node',[dir+'check.mjs']],...['retained-shell','shell-functions','local-phase','local-session','stub'].map(n=>[n,'node',['docs/team/evidence/task-432/offline-'+n+'.mjs']]),...['docs/team/evidence/task-427/owned-lifecycle.sh','docs/team/evidence/task-427/runtime.sh','docs/team/evidence/task-432/retained-shell.sh'].map((p,i)=>['bash'+i,'bash',['-n',p]]),['syntax','node',['--check',dir+'check.mjs']],['diff','git',['diff','--check']]];
const results=[];for(const [name,cmd,args] of commands){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,PWD:process.cwd()}});fs.writeFileSync(dir+name+'.log',r.stdout+r.stderr);results.push({command:[cmd,...args],status:r.status,signal:r.signal});console.log(name,r.status);}
fs.writeFileSync(dir+'results.json',JSON.stringify(results,null,2)+'\n');if(results.some(r=>r.status!==0))process.exit(1);

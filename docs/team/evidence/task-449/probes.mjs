import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
import {runGate} from '../task-427/run-gate.mjs';import {runVerifyApiCli} from '../../../../scripts/verify-api-cli.mjs';import {collectApiReceipts,apiCommands} from '../../../../scripts/api-receipt-transport.mjs';
const require=createRequire(import.meta.url),validator=require('../task-379/runtime-path.cjs'),original=validator.validate,root=path.resolve(import.meta.dirname,'../../../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lead449-')),identity={source:'fixture',sourceHash:'fixture'};let cases=0;
// Only this process's temporary fixture validator is substituted. NOT admission.
validator.validate=d=>assert.equal(path.dirname(d),tmp);
try{
 for(const failure of ['none',0,1,2,3,'overflow','signal','throw','drift','guard','blocked']){
  const dir=fs.mkdtempSync(path.join(tmp,'case-'));fs.writeFileSync(path.join(dir,'api-identity.json'),JSON.stringify(identity),{mode:0o400});
  const env={TASK379_ARTIFACT_DIR:dir,TASK432_API_RECEIPTS:dir,TASK379_RUN_ID:'b'.repeat(64),TASK427_BLOCK_LOG:path.join(dir,'blocked'),npm_config_offline:'true',npm_config_yes:'false',DATABASE_URL:'postgresql://test@127.0.0.1:23456/tixmo_disposable_449',REDIS_URL:'redis://127.0.0.1:24567/1',TIXMO_ALLOW_DESTRUCTIVE_TESTS:'1',AWS_TEST:'must-not-inherit'};
  if(failure==='blocked')fs.writeFileSync(env.TASK427_BLOCK_LOG,'denied');let calls=0;
  const run=()=>runGate({env,cli:opts=>runVerifyApiCli({...opts,cwd:root,guarded:()=>failure!=='guard',capture:()=>failure==='drift'&&calls?{...identity,source:'drift'}:identity}),spawn(cmd,args,opts){const i=calls++;assert.equal(cmd,apiCommands[i][0]);assert.deepEqual(args.slice(0,apiCommands[i][1].length),apiCommands[i][1]);assert.equal(opts.env.AWS_TEST,undefined);assert.equal(opts.stdio,'pipe');assert.equal(opts.maxBuffer,64*1024*1024);assert.equal(opts.shell,false);if(i===3)assert.deepEqual(args.slice(-2),['--json','--outputFile='+path.join(dir,'jest-result.json')]);if(failure==='throw')throw Error('spawn fault');return{status:failure===i?7:failure==='signal'?null:0,signal:failure==='signal'?'SIGTERM':null,error:failure==='overflow'?Object.assign(Error('maxBuffer'),{code:'ENOBUFS'}):undefined,stdout:'raw\0out\n',stderr:'raw\0err\n'};}});
  if(failure==='none')run();else assert.throws(run);
  const expected=failure==='guard'?0:failure==='none'||failure==='blocked'?4:typeof failure==='number'?failure+1:1;assert.equal(calls,expected);
  if(failure!=='guard'){
   const journal=fs.readFileSync(path.join(dir,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(journal.length,failure==='throw'?1:2*calls);
   if(failure==='drift')assert.throws(()=>collectApiReceipts({directory:dir,root,identity,status:1}),/Missing nested/);
   else{const receipts=collectApiReceipts({directory:dir,root,identity,status:failure==='none'||failure==='blocked'?0:1});assert.equal(receipts.length,calls);for(let i=1;i<=calls&&failure!=='throw';i++){assert.equal(fs.readFileSync(path.join(dir,i+'-stdout.log'),'utf8'),receipts[i-1].stdout);assert.equal(fs.readFileSync(path.join(dir,i+'-stderr.log'),'utf8'),receipts[i-1].stderr);}}
  }
  console.log('PASS '+(++cases)+' shell adapter '+failure+' canonical commands/raw logs/journal/failfast');
 }
 const shell=fs.readFileSync(path.join(root,'docs/team/evidence/task-427/runtime.sh'),'utf8');assert(shell.indexOf('const identity = snapshot(process.cwd())')>shell.indexOf('"$pgbin/initdb"'));assert(shell.indexOf('const identity = snapshot(process.cwd())')<shell.indexOf('jest_attempted=1'));assert(shell.includes('"wx", 0o400'));assert(shell.includes('fs.fsyncSync(fd)'));assert(shell.includes('export TASK432_API_RECEIPTS="$owned_run"'));console.log('PASS '+(++cases)+' source capture is exclusive fsynced before verifier but AFTER services (NOT provisioning admission)');
 const denied=spawnSync('bash',['docs/team/evidence/task-427/runtime.sh'],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(denied.status,2);assert.match(denied.stderr,/fresh explicit PM/);console.log('PASS '+(++cases)+' actual shell missing-grant denial before runtime');
 console.log('TOTAL '+cases+' independent offline cases PASS');
}finally{validator.validate=original;fs.rmSync(tmp,{recursive:true,force:true});}

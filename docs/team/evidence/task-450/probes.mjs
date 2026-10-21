import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createRequire} from 'node:module'; import {spawnSync} from 'node:child_process';
import {runGate} from '../task-427/run-gate.mjs';
import {runVerifyApiCli} from '../../../../scripts/verify-api-cli.mjs';
import {collectApiReceipts,apiCommands} from '../../../../scripts/api-receipt-transport.mjs';
const root=path.resolve(import.meta.dirname,'../../../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qa450-'));
const validator=createRequire(import.meta.url)('../task-379/runtime-path.cjs'),original=validator.validate;
const identity={source:'offline450',sourceHash:'fixture-only'};let total=0;
// Fixture acceptance only: not real path ownership, runtime authorization or attestation.
validator.validate=d=>assert.equal(path.dirname(d),tmp);
try {
 for(const mode of ['success','default',0,1,2,3,'overflow','exception','signal','drift-before','drift-after-third','guard','offline','challenge','artifact-mismatch','identity-mode','identity-symlink','blocked']) {
  const dir=fs.mkdtempSync(path.join(tmp,'case-')),id=path.join(dir,'api-identity.json');
  fs.writeFileSync(id,JSON.stringify(identity),{mode:0o400});
  const env={TASK379_ARTIFACT_DIR:dir,TASK432_API_RECEIPTS:dir,TASK379_RUN_ID:'c'.repeat(64),TASK427_BLOCK_LOG:path.join(dir,'block'),npm_config_offline:'true',npm_config_yes:'false',DATABASE_URL:'postgresql://test@127.0.0.1:23334/tixmo_disposable_450',REDIS_URL:'redis://127.0.0.1:24445/1',TIXMO_ALLOW_DESTRUCTIVE_TESTS:'1',AWS_QA450:'synthetic',SMTP_QA450:'synthetic'};
  if(mode==='default')delete env.TASK432_API_RECEIPTS;
  if(mode==='offline')env.npm_config_offline='false';
  if(mode==='challenge')env.TASK379_RUN_ID='invalid';
  if(mode==='artifact-mismatch')env.TASK379_ARTIFACT_DIR=dir+'-mismatch';
  if(mode==='identity-mode')fs.chmodSync(id,0o644);
  if(mode==='identity-symlink'){fs.renameSync(id,id+'.target');fs.symlinkSync(id+'.target',id);}
  if(mode==='blocked')fs.writeFileSync(env.TASK427_BLOCK_LOG,'denied');
  let calls=0;
  const run=()=>runGate({env,cli:o=>runVerifyApiCli({...o,cwd:root,guarded:()=>mode!=='guard',capture:()=>mode==='drift-before'||mode==='drift-after-third'&&calls===3?{...identity,source:'drift'}:identity}),spawn(cmd,args,opts){
   const i=calls++;assert.equal(cmd,apiCommands[i][0]);assert.deepEqual(args, i===3?[...apiCommands[i][1],'--json','--outputFile='+path.join(dir,'jest-result.json')]:apiCommands[i][1]);
   assert.equal(opts.shell,false);assert.equal(opts.stdio,'pipe');assert.equal(opts.maxBuffer,67108864);assert.equal(opts.env.AWS_QA450,undefined);assert.equal(opts.env.SMTP_QA450,undefined);assert.equal(opts.env.NODE_ENV,'test');
   if(mode==='exception')throw Error('independent spawn exception');
   return {status:mode===i?19:mode==='signal'?null:0,signal:mode==='signal'?'SIGTERM':null,error:mode==='overflow'?Object.assign(Error('ENOBUFS fault'),{code:'ENOBUFS'}):undefined,stdout:'\0independent λ out\n',stderr:'\0independent err\n'};
  }});
  if(['success','default'].includes(mode))run();else assert.throws(run);
  const zero=['drift-before','guard','offline','challenge','artifact-mismatch','identity-mode','identity-symlink'].includes(mode);
  const expected=zero?0:typeof mode==='number'?mode+1:['overflow','exception','signal'].includes(mode)?1:mode==='drift-after-third'?3:4;
  assert.equal(calls,expected);assert.equal(env.AWS_QA450,'synthetic');
  if(calls){const journal=fs.readFileSync(path.join(dir,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(journal.length,mode==='exception'?1:2*calls);}
  if(mode==='default'){assert.equal(fs.existsSync(path.join(dir,'api-1.json')),false);}
  else if(mode==='drift-after-third')assert.throws(()=>collectApiReceipts({directory:dir,root,identity,status:1}),/Missing nested/);
  else if(calls){const receipts=collectApiReceipts({directory:dir,root,identity,status:['success','blocked'].includes(mode)?0:1});assert.equal(receipts.length,calls);if(mode!=='exception')for(let i=0;i<calls;i++){assert.equal(fs.readFileSync(path.join(dir,(i+1)+'-stdout.log'),'utf8'),receipts[i].stdout);assert.equal(fs.readFileSync(path.join(dir,(i+1)+'-stderr.log'),'utf8'),receipts[i].stderr);}}
  console.log('PASS '+(++total)+' '+mode+' calls='+calls);
 }
 const shell=fs.readFileSync(path.join(root,'docs/team/evidence/task-427/runtime.sh'),'utf8');
 assert(shell.indexOf('const identity = snapshot(process.cwd())')>shell.indexOf('"$pgbin/initdb"'));assert(shell.indexOf('const identity = snapshot(process.cwd())')<shell.indexOf('jest_attempted=1'));assert(shell.includes('"wx", 0o400'));assert(shell.includes('fs.fsyncSync(fd)'));assert(shell.includes('export TASK432_API_RECEIPTS="$owned_run"'));console.log('PASS '+(++total)+' static capture exclusive/fsync before verifier AFTER services');
 const denied=spawnSync('bash',['docs/team/evidence/task-427/runtime.sh'],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(denied.status,2);assert.match(denied.stderr,/fresh explicit PM/);console.log('PASS '+(++total)+' real shell no-grant exits2');
 console.log('TOTAL '+total+' independent offline cases PASS; fixture substitution NOT genuine admission');
}finally{validator.validate=original;fs.rmSync(tmp,{recursive:true,force:true});}

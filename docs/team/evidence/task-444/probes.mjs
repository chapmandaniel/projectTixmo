import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { runVerifyApiCli } from '../../../../scripts/verify-api-cli.mjs';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { collectApiReceipts } from '../../../../scripts/api-receipt-transport.mjs';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'../../../..');
const guard=require('../task-379/runtime-path.cjs');
const originalValidate=guard.validate;
// Offline transport fixture only. Never substitute a validator in a real invocation.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo-lead444-'));
guard.validate=directory=>{assert.equal(path.dirname(directory),temporary);return directory;};
let sequence=0;
const identity={source:'offline-synthetic',sourceHash:'offline-synthetic'};
const fixture=()=>{const directory=path.join(temporary,String(++sequence));fs.mkdirSync(directory,{mode:0o700});fs.writeFileSync(path.join(directory,'api-identity.json'),JSON.stringify(identity),{mode:0o400});return directory;};
const envFor=directory=>({TASK432_API_RECEIPTS:directory,TASK379_ARTIFACT_DIR:directory,TASK379_RUN_ID:'b'.repeat(64),npm_config_offline:'true',npm_config_yes:'false',DATABASE_URL:'postgresql://test@127.0.0.1:23333/tixmo_disposable_review444',REDIS_URL:'redis://127.0.0.1:24444/1',TIXMO_ALLOW_DESTRUCTIVE_TESTS:'1',AWS_ACCESS_KEY_ID:'synthetic-review',STRIPE_SECRET_KEY:'synthetic-review'});
let checks=0;
try {
 const before=execFileSync('git',['show','b45649abb438ec791f0c37a57bb42cdcfd928abb:scripts/verify-api.mjs'],{encoding:'utf8'});
 const after=fs.readFileSync('scripts/verify-api.mjs','utf8');
 const body=s=>s.slice(s.indexOf('export function verifyApi'),s.indexOf('\nif (process.argv[1]'));
 assert.equal(body(before),body(after));checks++;
 let defaultOptions;const defaultEnv={CUSTOM:'synthetic'};
 runVerifyApiCli({env:defaultEnv,verify:options=>{defaultOptions=options;}});
 assert.equal(defaultOptions.env,defaultEnv);assert.deepEqual(Object.keys(defaultOptions),['env']);checks++;
 for(const failure of [-1,0,1,2,3,'throw']){
  const directory=fixture(), env=envFor(directory), seen=[];
  const invoke=()=>runVerifyApiCli({env,cwd:root,guarded:()=>true,capture:()=>identity,verify:options=>verifyApi({...options,log(){},spawn(command,args,options){seen.push([command,args,options.cwd]);assert.equal(options.env.AWS_ACCESS_KEY_ID,undefined);assert.equal(options.env.STRIPE_SECRET_KEY,'sk_test_verify_api');if(failure==='throw')throw Error('synthetic spawn failure');return{status:seen.length-1===failure?9:0,stdout:'NUL\0raw',stderr:'private raw'};}})});
  if(failure===-1)invoke();else assert.throws(invoke,/failed/);
  assert.equal(seen.length,failure===-1?4:failure==='throw'?1:failure+1);
  const receipts=collectApiReceipts({directory,root,identity,status:failure===-1?0:1});
  assert.equal(receipts.length,seen.length);assert.equal(receipts[0].stdout,failure==='throw'?'':'NUL\0raw');
  assert.equal(env.AWS_ACCESS_KEY_ID,'synthetic-review');checks++;
 }
 for(let driftAt=0;driftAt<=4;driftAt++){
  const directory=fixture();let captures=0,calls=0;
  assert.throws(()=>runVerifyApiCli({env:envFor(directory),cwd:root,guarded:()=>true,capture:()=>captures++===driftAt?{...identity,source:'changed'}:identity,verify:options=>verifyApi({...options,log(){},spawn(){calls++;return{status:0,stdout:'',stderr:''};}})}),/identity changed/);
  assert.equal(calls,driftAt);checks++;
 }
 const directory=fixture(),env=envFor(directory);let calls=0;
 const opts={env,cwd:root,guarded:()=>true,capture:()=>identity,verify(){calls++;}};
 for(const change of [{cwd:'/tmp'},{guarded:()=>false},{env:{...env,npm_config_yes:'true'}},{env:{...env,npm_config_offline:'false'}},{env:{...env,TASK379_RUN_ID:'a'}},{env:{...env,TASK379_ARTIFACT_DIR:'/tmp'}}]){assert.throws(()=>runVerifyApiCli({...opts,...change}));checks++;}
 fs.chmodSync(path.join(directory,'api-identity.json'),0o444);assert.throws(()=>runVerifyApiCli(opts),/Unsafe API identity/);checks++;
 fs.unlinkSync(path.join(directory,'api-identity.json'));fs.symlinkSync(path.join(temporary,'unread'),path.join(directory,'api-identity.json'));assert.throws(()=>runVerifyApiCli(opts),/Unsafe API identity/);checks++;assert.equal(calls,0);
 const child=spawnSync(process.execPath,['scripts/verify-api.mjs'],{cwd:root,env:{PATH:process.env.PATH,TASK432_API_RECEIPTS:'/tmp/not-runtime'},encoding:'utf8'});
 assert.equal(child.status,1);assert.match(child.stderr,/Invalid runtime location/);checks++;
 console.log('PASS '+checks+' independent offline cases: byte-identical verifier body/default env identity; 4 child failures+throw/raw NUL/canonical collector/provider scrub; all 5 source drift checkpoints; 6 preflight denials; unsafe identity modes/symlink; actual CLI invalid path rejects.');
 console.log('Validator fixture substitution is explicit test DI only; no genuine owned-runtime admission/security/whole lifecycle claim. No runtime directory/service/network/app import.');
} finally {guard.validate=originalValidate;fs.rmSync(temporary,{recursive:true,force:true});}

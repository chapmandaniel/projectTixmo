import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { createApiReceiptTransport, collectApiReceipts, apiCommands } from '../../../../scripts/api-receipt-transport.mjs';
import { compose, boundaries } from '../../../../scripts/market-composition.mjs';
const root = path.resolve(import.meta.dirname, '../../../..');
const parent = '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379';
const identity = { source: 'qa438', sourceHash: 'immutable-fixture' };
const env = { DATABASE_URL: 'postgresql://fixture@127.0.0.1:23333/tixmo_disposable_qa438', REDIS_URL: 'redis://127.0.0.1:24444/1', TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1', AWS_ACCESS_KEY_ID: 'synthetic-forbidden', STRIPE_SECRET_KEY: 'synthetic-forbidden', NODE_ENV: 'production' };
let assertions = 0;
const fresh = () => { const d = fs.mkdtempSync(path.join(parent, 'run.')); fs.chmodSync(d, 0o700); return d; };
const fill = d => { const record = createApiReceiptTransport({directory:d,root,identity}); for (const [command,args,cwd] of apiCommands) record({command,args,cwd:path.resolve(root,cwd),started:'fixture',status:0,stdout:'raw\0payload',stderr:''}); };
for (const mutate of [
 x=>x.index=9, x=>x.command='sh', x=>x.args=['run','migrate'], x=>x.cwd=parent,
 x=>x.identity.source='other', x=>x.stdout+='tamper', x=>x.status='0', x=>delete x.finished,
]) {
 const d=fresh();try {fill(d); const file=path.join(d,'api-1.json');const x=JSON.parse(fs.readFileSync(file));mutate(x);fs.chmodSync(file,0o600);fs.writeFileSync(file,JSON.stringify(x));assert.throws(()=>collectApiReceipts({directory:d,root,identity,status:0}));assertions++;}finally{fs.rmSync(d,{recursive:true,force:true});}
}
for (const fault of ['gap','after-failure','extra','symlink','public']) {
 const d=fresh();try {fill(d); const file=path.join(d,'api-2.json');
 if(fault==='gap')fs.unlinkSync(file);
 if(fault==='after-failure'){const x=JSON.parse(fs.readFileSync(file));x.status=8;fs.chmodSync(file,0o600);fs.writeFileSync(file,JSON.stringify(x));}
 if(fault==='extra')fs.writeFileSync(path.join(d,'api-5.json'),'{}',{mode:0o400});
 if(fault==='symlink'){fs.unlinkSync(file);fs.symlinkSync('api-1.json',file);}
 if(fault==='public')fs.chmodSync(file,0o644);
 assert.throws(()=>collectApiReceipts({directory:d,root,identity,status:1}));assertions++;
 }finally{fs.rmSync(d,{recursive:true,force:true});}
}
let calls=0, records=[];
assert.throws(()=>verifyApi({env:{...env,TIXMO_ALLOW_DESTRUCTIVE_TESTS:'0'},spawn(){calls++;},record:x=>records.push(x),log(){}}));assert.equal(calls,0);assert.equal(records.length,0);
verifyApi({env,log(){},record:x=>records.push(x),spawn(command,args,options){calls++;assert.equal(options.env.AWS_ACCESS_KEY_ID,undefined);assert.equal(options.env.STRIPE_SECRET_KEY,'sk_test_verify_api');assert.equal(options.env.NODE_ENV,'test');assert.equal(options.shell,false);return{status:0,stdout:'raw\0payload',stderr:'stderr'};}});
assert.equal(calls,4);assert.equal(records.length,4);assert.equal(records[0].stdout,'raw\0payload');assert.equal(env.NODE_ENV,'production');
for (const failure of ['throw','signal','error']) {
 const d=fresh();try {let count=0;const record=createApiReceiptTransport({directory:d,root,identity});assert.throws(()=>verifyApi({env,log(){},record,spawn(){count++;if(failure==='throw')throw Error('synthetic spawn error');return{status:null,signal:failure==='signal'?'SIGTERM':null,error:failure==='error'?Error('synthetic spawn error'):null,stdout:'failed raw',stderr:'failed err'};}}),/failed/);assert.equal(count,1);const receipts=collectApiReceipts({directory:d,root,identity,status:1});assert.equal(receipts.length,1);assert.equal(receipts[0].status,-1);assert.equal(receipts[0].stdout,failure==='throw'?'':'failed raw');assertions++;}finally{fs.rmSync(d,{recursive:true,force:true});}
}
const d=fresh();try {fs.chmodSync(d,0o755);assert.throws(()=>createApiReceiptTransport({directory:d,root,identity}),/0700/);}finally{fs.rmSync(d,{recursive:true,force:true});}
const stageStatus=[];let saved;
const session=kind=>({contract:structuredClone(boundaries[kind]),close:async()=>{},run:async()=>({status:0,stdout:'',stderr:''})});
const result=await compose({capture:()=>identity,versions:{node:'fixture',npm:'fixture'},openAudit:async()=>session('audit'),openLocal:async()=>session('local'),collectNestedApi:arg=>{stageStatus.push(arg.status);return[{marker:'qa438'}];},persist:async x=>{saved=x;return{committed:true,durabilityConfirmed:false,warnings:[{operation:'fixture'}]};}});
assert.deepEqual(stageStatus,[0]);assert.equal(saved.receipts[4].nestedApi[0].marker,'qa438');assert.equal(saved.receipts.filter(x=>x.nestedApi).length,1);
// Fresh successor explicitly retains caller persistence outcome.
assert.equal(result.persistence.committed,true);assert.equal(result.persistence.durabilityConfirmed,false);assert.equal(result.persistence.warnings[0].operation,'fixture');assert.equal(result.qualification,'INCOMPLETE');assert.equal(saved.persistence,undefined);
console.log(`PASS independent QA438: ${assertions} transport mutation/failure probes; pre-spawn denial, scrub/default four commands, raw/signal/throw failures, stage5-only join. Fresh successor caller outcome retained.`);
const {createEvidenceStore,verifyEvidence}=await import('../../../../scripts/market-evidence-store.mjs');
const os=await import('node:os');
const disk=fs.mkdtempSync(path.join(os.tmpdir(),'qa438-publication-'));fs.chmodSync(disk,0o700);
const originalSync=fs.fsyncSync, originalLink=fs.linkSync;
try {for(const fault of ['target','parent','before']) {let published=false,postSync=0;const persist=createEvidenceStore({directory:disk,runId:fault});fs.linkSync=(...args)=>{const r=originalLink(...args);published=true;return r;};fs.fsyncSync=fd=>{if((!published&&fault==='before')||(published&&++postSync===(fault==='target'?1:2))){throw Object.assign(Error('qa438 EIO'),{code:'EIO'});}return originalSync(fd);};
 try {if(fault==='before'){await assert.rejects(persist({receipts:[]}),/EIO/);assert.throws(()=>verifyEvidence(path.join(disk,fault)));}else{const outcome=await persist({receipts:[]});assert.equal(outcome.committed,true);assert.equal(outcome.durabilityConfirmed,false);assert.equal(outcome.warnings.length,1);assert.equal(outcome.warnings[0].operation,fault==='target'?'sync-run-directory':'sync-parent-directory');assert.equal(verifyEvidence(outcome.directory).runId,fault);}}finally{fs.fsyncSync=originalSync;fs.linkSync=originalLink;}}
console.log('PASS independent QA438: isolated target/parent postpublication fsync faults each readable committed durability=false; prepublication fsync unsealed and rejected.');
}finally{fs.fsyncSync=originalSync;fs.linkSync=originalLink;for(const e of fs.readdirSync(disk))fs.chmodSync(path.join(disk,e),0o700);fs.rmSync(disk,{recursive:true,force:true});}

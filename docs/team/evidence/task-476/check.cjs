'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const rows=group=>fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x)).filter(x=>{try{const s=fs.readFileSync('/proc/'+x+'/stat','utf8');return Number(s.slice(s.lastIndexOf(')')+2).split(/\s+/)[2])===group;}catch(e){if(['ENOENT','ESRCH'].includes(e.code))return false;throw e;}});
(async()=>{
let cases=0;
for(const evidenceFails of [false,true]){
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa476-'));fs.chmodSync(dir,0o700);
const ready=path.join(dir,'ready'),term=path.join(dir,'term');
const code=`const fs=require('node:fs');process.on('SIGTERM',()=>fs.writeFileSync(${JSON.stringify(term)},String(process.pid),{mode:384}));console.error('QA476_PRIMARY_STDERR_${evidenceFails}');fs.writeFileSync(${JSON.stringify(ready)},String(process.pid),{mode:384});setInterval(()=>{},1000);`;
const rec=launch(process.execPath,['-e',code],{env:{}});let closed=false;rec.child.once('close',()=>closed=true);
try{
const deadline=Date.now()+2500;while(!fs.existsSync(ready)&&!closed&&Date.now()<deadline)await pause(10);
assert.equal(fs.readFileSync(ready,'utf8'),String(rec.child.pid));assert.equal(fs.statSync(dir).mode&511,448);assert.equal(fs.statSync(ready).mode&511,384);assert.equal(closed,false);assert.deepEqual(rows(rec.child.pid),[String(rec.child.pid)]);
let fake=0;for(const copy of [{...rec},{child:rec.child,identity:rec.identity}])await assert.rejects(finish(copy,{teardown:()=>fake++,writeEvidence:()=>fake++}),/No live owned/);
assert.equal(fake,0);assert.equal(fs.existsSync(term),false);assert.equal(closed,false);
const order=[];const absence=()=>{assert(closed);assert.equal(rec.child.signalCode,'SIGKILL');assert.equal(fs.existsSync('/proc/'+rec.child.pid),false);assert.deepEqual(rows(rec.child.pid),[]);assert.equal(fs.readFileSync(term,'utf8'),String(rec.child.pid));};
const started=Date.now();const report=await finish(rec,{timeoutMs:55,graceMs:200,teardown:()=>{absence();order.push('teardown');},writeEvidence:r=>{absence();order.push('evidence');assert.equal(r.result.code,null);assert.equal(r.result.signal,'SIGKILL');if(evidenceFails)throw Error('QA476_SECONDARY_ENOSPC');}});
assert(Date.now()-started<2000);assert.deepEqual(order,['teardown','evidence']);assert.equal(report.timedOut,true);assert.equal(report.teardownStatus,'completed');assert.equal(report.evidenceStatus,evidenceFails?'failed':'completed');
const json=JSON.parse(JSON.stringify(report));assert.deepEqual(json.result,{code:null,signal:'SIGKILL'});assert.equal(status(json),137);if(evidenceFails)assert.match(json.evidenceError,/QA476_SECONDARY_ENOSPC/);else assert.equal(json.evidenceError,undefined);
await assert.rejects(finish(rec),/No live owned/);cases++;console.log(JSON.stringify({case:cases,evidenceFails,status:status(json),order,directClosed:closed,groupAbsent:true}));
}finally{if(!closed){const ended=new Promise(r=>rec.child.once('close',r));rec.child.kill('SIGKILL');await ended;}fs.rmSync(dir,{recursive:true,force:true});}
}
console.log('PASS independent two real stubborn direct children; both callback absence/order; copied authority denial; SIGKILL137 JSON primary preservation; all owned children reaped');
})().catch(e=>{console.error(e);process.exitCode=1;});

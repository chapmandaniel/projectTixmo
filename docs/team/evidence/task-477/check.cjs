'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const group=id=>fs.readdirSync('/proc').filter(p=>/^\d+$/.test(p)).filter(p=>{try{let t=fs.readFileSync('/proc/'+p+'/stat','utf8');return +t.slice(t.lastIndexOf(')')+2).trim().split(/\s+/)[2]===id;}catch(e){if(['ENOENT','ESRCH'].includes(e.code))return false;throw e;}});
(async()=>{
 const root=process.env.TMPDIR;a(root.startsWith('/home/daniel/.openclaw/workspace/tixmo-pm/runtime/'));a.equal(fs.statSync(root).mode&511,448);
 for(const fail of [false,true]){
  const dir=fs.mkdtempSync(path.join(root,'lead477-'));fs.chmodSync(dir,448);
  const log=path.join(dir,'events');
  const source=`const fs=require('node:fs');const p=${JSON.stringify(log)};process.on('SIGTERM',()=>fs.appendFileSync(p,'TERM '+process.pid+'\\n'));console.error('LEAD477_PRIMARY_${fail}');fs.writeFileSync(p,'READY '+process.pid+'\\n',{mode:384});setInterval(()=>{},500);`;
  const rec=launch(process.execPath,['-e',source],{env:{}});let close=false;rec.child.once('close',()=>close=true);
  try{
   const until=Date.now()+2000;while(!fs.existsSync(log)&&!close&&Date.now()<until)await delay(5);
   a.equal(fs.readFileSync(log,'utf8'),'READY '+rec.child.pid+'\n');a.equal(fs.statSync(log).mode&511,384);a(!close);a.deepEqual(group(rec.child.pid),[String(rec.child.pid)]);
   let calls=0;for(const fake of [{...rec},{child:rec.child,identity:{...rec.identity}}])await a.rejects(finish(fake,{teardown:()=>calls++,writeEvidence:()=>calls++}),/No live owned/);
   a.equal(calls,0);a(!close);a.equal(fs.readFileSync(log,'utf8'),'READY '+rec.child.pid+'\n');
   const order=[];const verify=()=>{a(close);a.equal(rec.child.signalCode,'SIGKILL');a(!fs.existsSync('/proc/'+rec.child.pid));a.deepEqual(group(rec.child.pid),[]);a.equal(fs.readFileSync(log,'utf8'),'READY '+rec.child.pid+'\nTERM '+rec.child.pid+'\n');};
   const start=Date.now();const report=await finish(rec,{timeoutMs:70,graceMs:180,teardown:()=>{verify();order.push('teardown');},writeEvidence:r=>{verify();order.push('evidence');a.strictEqual(r.result,rec.result);if(fail)throw Object.assign(Error('LEAD477_ENOSPC'),{code:'ENOSPC'});}});
   const elapsed=Date.now()-start;a(elapsed<1800);a.deepEqual(order,['teardown','evidence']);a.equal(report.timedOut,true);a.equal(report.teardownStatus,'completed');a.equal(report.evidenceStatus,fail?'failed':'completed');
   const json=JSON.parse(JSON.stringify(report));a.deepEqual(json.result,{code:null,signal:'SIGKILL'});a.equal(status(json),137);if(fail)a.match(json.evidenceError,/LEAD477_ENOSPC/);else a.equal(json.evidenceError,undefined);
   await a.rejects(finish(rec),/No live owned/);console.log(JSON.stringify({fail,elapsed,order,primary:json.result,status:status(json),directReaped:true,groupAbsent:true}));
  }finally{if(!close){const done=new Promise(r=>rec.child.once('close',r));rec.child.kill('SIGKILL');await done;}fs.rmSync(dir,{recursive:true,force:true});}
 }
 console.log('PASS independent two direct children, readiness after handler, real ignored TERM, bounded KILL, direct reap/proc/group absence before both callbacks, authority and one-shot denials, JSON137 primary preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});

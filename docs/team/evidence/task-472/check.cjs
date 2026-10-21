'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
(async()=>{
 const p=Proxy.revocable({},{});p.revoke();
 const values=[null,undefined,'lead472',false,0,NaN,27n,Symbol('472'),Object.create(null),p.proxy,new Proxy({}, {get(){throw 'trap'}}),{get message(){throw null},get stack(){throw undefined},get code(){throw false},[Symbol.toPrimitive](){throw 0}},new Error('ORIGINAL472')];
 let cases=0,children=0;
 async function child(primary){const r=launch(process.execPath,['-e',`console.error('LEAD472_${children++}');process.exit(${primary})`],{env:{}});await r.closed;return r;}
 async function reap(r){a.equal(fs.existsSync('/proc/'+r.child.pid),false);a.notEqual(r.child.exitCode,null);await a.rejects(finish(r),/No live owned/);}
 for(const path of ['teardown','evidence'])for(const value of values)for(const primary of [0,73]){
  const r=await child(primary);let t=0,e=0,report,failure;
  try{report=await finish(r,{teardown:async()=>{t++;await reap(r);if(path==='teardown')throw value},writeEvidence:async()=>{e++;await reap(r);if(path==='evidence')throw value}})}catch(x){failure=x;report=x.report}
  a.equal(!!failure,path==='teardown');a.equal(report.result,r.result);a.equal(report.result.code,primary);a.equal(report.result.signal,null);a.equal(report.timedOut,false);
  const round=JSON.parse(JSON.stringify(report));a.equal(round[path==='teardown'?'teardownStatus':'evidenceStatus'],'failed');
  const diag=round[path==='teardown'?'cleanupError':'evidenceError'];a.equal(typeof diag,'string');a.ok(diag.trim());a.equal(status(round),primary||1);a.deepEqual([t,e],[1,1]);await reap(r);cases++;
 }
 // Both callbacks throw synchronously, successful primary cannot hide either failure.
 const both=await child(0);let report;try{await finish(both,{teardown(){throw null},writeEvidence(){throw p.proxy}})}catch(e){report=e.report}
 a.ok(report.cleanupError);a.ok(report.evidenceError);a.equal(status(JSON.parse(JSON.stringify(report))),1);cases++;
 // Preserve genuine missing-command diagnostics despite both callback failures.
 const missing=launch('/nonexistent/lead472-command',['arg472'],{env:{}});await new Promise(resolve=>missing.child.once('close',resolve));
 try{await finish(missing,{teardown(){throw undefined},writeEvidence(){throw 0}})}catch(e){report=e.report}
 const round=JSON.parse(JSON.stringify(report));a.equal(round.result.error.code,'ENOENT');a.match(round.result.error.message,/lead472-command/);a.equal(round.result.error.path,'/nonexistent/lead472-command');a.equal(round.result.code,-2);a.equal(status(round),127);cases++;
 // A real pending callback is not cancelled; late effects are explicitly possible.
 const late=await child(0);let release,lateEffect=false;
 const pending=finish(late,{teardownMs:15,evidenceMs:15,teardown:()=>new Promise(resolve=>{release=()=>{lateEffect=true;resolve()}}),writeEvidence:()=>new Promise(()=>{})});
 await a.rejects(finish(late),/No live owned/);try{await pending}catch(e){report=e.report}
 a.equal(report.teardownStatus,'timed-out-pending-late-effects-possible');a.equal(report.evidenceStatus,'timed-out-pending-late-effects-possible');a.equal(status(report),1);a.equal(lateEffect,false);release();await Promise.resolve();a.equal(lateEffect,true);await reap(late);cases++;
 console.log(JSON.stringify({verdict:'PASS',independentCases:cases,ownedLaunchAttempts:children+1,realOwnedDirectChildren:children,stderrSentinels:children,allReaped:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

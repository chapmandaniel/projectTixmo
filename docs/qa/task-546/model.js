'use strict';
function check(ok,msg){if(!ok)throw Error(msg)}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
async function bounded(p){let t;try{return await Promise.race([p,new Promise((_,r)=>{t=setTimeout(()=>r(Error('bounded failure')),15)})])}finally{clearTimeout(t)}}
async function scenario(winner,fail){
 const release=[deferred(),deferred()],commit=[deferred(),deferred()];
 let committed=[false,false],oldDone=false,newDone=false,reads=0;
 // Public invocation 0 waits, invocation 1 enters transaction first.
 const preflight=[deferred(),deferred()],entered=[deferred(),deferred()];
 const callers=[0,1].map(async caller=>{await preflight[caller].promise;const index=reads++;entered[index].resolve();await release[index].promise;
   const original=async()=>{if(fail&&index===winner)throw Error('transaction rejected');return index};
   const value=await original();committed[index]=true;commit[index].resolve();return value;
 });
 const outcomes=Promise.allSettled(callers);
 const oldWait=callers[winner].then(()=>{oldDone=true},()=>{});
 preflight[1].resolve();await entered[0].promise;preflight[0].resolve();await entered[1].promise;
 const newWait=bounded(commit[winner].promise).then(()=>{newDone=true;return 'committed'},()=> 'bounded failure');
 release[winner].resolve();
 const result=await newWait;
 check(!oldDone,'old caller-index wait unexpectedly progressed');
 check(fail ? result==='bounded failure'&&!newDone&&!committed[winner] : result==='committed'&&newDone&&committed[winner], 'commit success/failure invariant');
 release[1-winner].resolve();
 const settled=await outcomes;await oldWait;
 check(settled.filter(x=>x.status==='rejected').length===(fail?1:0),'outcomes');
 // Drain every owned async operation and wait wrapper; the intentionally
 // unresolved failed commit deferred is passive and has no pending timer/work.
 await Promise.allSettled([...callers,oldWait,newWait,outcomes]);
 console.log(`PASS reversed entry [1,0] winner=${winner} fail=${fail}: old blocked, commit ${result}, async operations drained`);
}
(async()=>{for(const w of [0,1])for(const f of [false,true])await scenario(w,f)})().catch(e=>{console.error(e);process.exitCode=1});

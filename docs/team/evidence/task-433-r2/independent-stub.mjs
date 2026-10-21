import assert from 'node:assert/strict';
import {compose} from '../../../../scripts/market-composition.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
async function probe(mutation){
 let changed=false,localRuns=0,localOpens=0,saved;
 const identity={source:'candidate'};
 const open=kind=>async contract=>{
  if(kind==='local'){localOpens++;if(mutation==='admission'){changed=true;identity.source='changed';}}
  return {contract,close:async()=>{if(kind==='audit'&&mutation==='teardown'){changed=true;identity.source='changed';}},run:async step=>{
   if(kind==='local')localRuns++;
   step.args.push('mutated');
   return {status:0,stdout:'raw',stderr:'',index:999,phase:'wrong',name:'wrong',command:'forged',args:['forged'],environment:{FAKE:1},started:'forged',finished:'forged',stdoutHash:'forged'};
  }};
 };
 const job=()=>compose({versions:{node:'stub',npm:'stub'},capture:()=>identity,openAudit:open('audit'),openLocal:open('local'),now:()=> 'real-clock',persist:async m=>saved=m});
 if(mutation){await assert.rejects(job(),/Candidate changed/);assert.equal(localRuns,0);assert.equal(saved.receipts.length,2);assert.equal(saved.qualification,'INCOMPLETE');if(mutation==='teardown')assert.equal(localOpens,0);}
 else{await job();assert.equal(saved.receipts.length,12);for(let i=0;i<12;i++){const r=saved.receipts[i];assert.equal(r.index,i+1);assert.equal(r.phase,i<2?'audit':'local');for(const key of ['name','command','args','environment'])assert.deepEqual(r[key],steps[i][key]);assert.equal(r.started,'real-clock');assert.equal(r.finished,'real-clock');assert.notEqual(r.stdoutHash,'forged');}assert.notEqual(saved.qualification,'PASS');}
}
await probe();await probe('teardown');await probe('admission');
console.log('PASS independent repaired regressions: canonical metadata/args retained all12; same-object source mutation at teardown/admission fails before any local command; teardown mutation also prevents local admission; no network/runtime');

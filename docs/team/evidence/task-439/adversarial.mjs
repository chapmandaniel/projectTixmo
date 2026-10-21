import assert from 'node:assert/strict';
import { compose } from '../../../../scripts/market-composition.mjs';
import { steps } from '../../../../scripts/market-stages.mjs';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { apiCommands } from '../../../../scripts/api-receipt-transport.mjs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../../..');
let count = 0;
for (let fail = 0; fail < 12; fail++) {
 let calls=0, sealed;
 const outcome={committed:true,durabilityConfirmed:false,warnings:[{operation:'sync-parent-directory',code:'EIO'}]};
 const open=async contract=>({contract,close:async()=>{},run:async step=>{const i=calls++; step.args.push('forged'); return {status:i===fail?9:0,stdout:'nul\0raw',stderr:'err',index:99,args:['forged']};}});
 let error; try {await compose({capture:()=>({source:'fixed'}),versions:{node:'stub',npm:'stub'},openAudit:open,openLocal:open,persist:async m=>{sealed=structuredClone(m);return outcome;}});} catch(e){error=e;}
 assert(error); assert.equal(calls,fail+1); assert.equal(error.evidence.receipts.length,fail+1);
 assert.equal(error.evidence.evidenceCompletion,'COMMITTED_DURABILITY_UNCONFIRMED');assert.equal(error.evidence.qualification,'INCOMPLETE');
 outcome.warnings[0].code='mutated'; assert.equal(error.evidence.persistence.warnings[0].code,'EIO');
 assert.equal(sealed.persistence,undefined);assert.equal(sealed.evidenceCompletion,undefined);
 for(const [i,r] of error.evidence.receipts.entries()){assert.equal(r.index,i+1);assert.deepEqual(r.args,steps[i].args);assert.equal(r.stdout,'nul\0raw');}
 count++;
}
for(const mode of ['stage','cleanup','both','nested']) {
 let calls=0, saved;
 const open=async contract=>({contract,close:async()=>{if(mode==='cleanup'||mode==='both')throw Error('close-denied');},run:async()=>({status:(mode==='stage'||mode==='both')&&calls++===0?8:0,stdout:'',stderr:''})});
 let error;try{await compose({capture:()=>({source:'fixed'}),versions:{node:'stub',npm:'stub'},openAudit:open,openLocal:open,collectNestedApi:()=>{throw Error('nested-denied');},persist:async m=>{saved=m;throw Error('publication-unknown');}});}catch(e){error=e;}
 assert.equal(error.message,'publication-unknown');assert(error.executionFailure);assert.equal(error.evidence.evidenceCompletion,'CALLBACK_FAILED_PUBLICATION_UNKNOWN');assert.equal(error.evidence.qualification,'INCOMPLETE');assert.equal(saved.persistence,undefined);
 if(mode==='both') {assert.match(saved.failure,/Market stage failed/);assert.equal(saved.cleanupFailure,'close-denied');}
 count++;
}
const env={DATABASE_URL:'postgresql://test@127.0.0.1:23333/tixmo_disposable_lead',REDIS_URL:'redis://127.0.0.1:24444/1',TIXMO_ALLOW_DESTRUCTIVE_TESTS:'1',AWS_ACCESS_KEY_ID:'synthetic-do-not-forward',STRIPE_SECRET_KEY:'synthetic-do-not-forward'};
for(let fail=0;fail<4;fail++){
 const records=[];let calls=0;
 assert.throws(()=>verifyApi({env,log(){},record:r=>records.push(r),spawn:(command,args,opts)=>{const i=calls++;assert.equal(command,apiCommands[i][0]);assert.deepEqual(args,apiCommands[i][1]);assert.equal(opts.cwd,path.resolve(root,apiCommands[i][2]));assert.equal(opts.env.AWS_ACCESS_KEY_ID,undefined);assert.equal(opts.env.STRIPE_SECRET_KEY,'sk_test_verify_api');assert.equal(opts.shell,false);if(i===fail)throw Error('synthetic raw failure');return {status:0,stdout:'raw\0',stderr:''};}}),/output suppressed/);
 assert.equal(calls,fail+1);assert.equal(records.length,fail+1);assert.equal(records.at(-1).status,-1);assert.equal(records.at(-1).error,'synthetic raw failure');count++;
}
let calls=0;assert.throws(()=>verifyApi({env:{},log(){},record(){calls++;},spawn(){calls++;}}));assert.equal(calls,0);count++;
for(let fail=0;fail<4;fail++){
 let calls=0,records=0;assert.throws(()=>verifyApi({env,log(){},spawn(){calls++;return {status:0,stdout:'',stderr:''};},record(){if(records++===fail)throw Error('transport-denied');}}),/transport-denied/);assert.equal(calls,fail+1);count++;
}
console.log(`PASS independent ${count} cases: all12 failure envelopes/canonical clones, four combined failure causes, four thrown-child exact commands/scrub, preflight denial, four transport callback failfast positions.`);

import assert from 'node:assert/strict';
import {compose} from '../../../../scripts/market-composition.mjs';
const outcomes=[undefined, {committed:false,durabilityConfirmed:true,warnings:[]}, {committed:true,durabilityConfirmed:false,warnings:[{operation:'target',code:'EIO'}]}, {committed:true,durabilityConfirmed:true,warnings:[{operation:'chmod',code:'EPERM'}]}];
let cases=0;
for(const failure of ['none','stage','cleanup'])for(const outcome of outcomes){
 let rawInput, caught, result, runs=0, closed=0;
 const input={capture:()=>({source:'qa438-successor'}),versions:{node:'fixture',npm:'fixture'},persist:async manifest=>{rawInput=manifest;return outcome;},openAudit:open,openLocal:open};
 async function open(contract){return{contract,run:async()=>{runs++;return{status:failure==='stage'?9:0,stdout:'raw\0value',stderr:'err'};},close:async()=>{closed++;if(failure==='cleanup')throw Error('cleanup injected');}};}
 try{result=await compose(input);}catch(e){caught=e;result=e.evidence;}
 assert(result);assert.equal(Boolean(caught),failure!=='none');assert.equal(result.persistence?.committed,outcome?.committed);assert.equal(result.persistence?.warnings?.[0]?.operation,outcome?.warnings?.[0]?.operation);assert.equal(rawInput.persistence,undefined);assert.equal(rawInput.evidenceCompletion,undefined);
 if(failure!=='none'||!outcome?.committed||!outcome?.durabilityConfirmed)assert.equal(result.qualification,'INCOMPLETE');else assert.equal(result.qualification,'SOURCE_CORE_COMPLETED_NOT_QUALIFIED');
 assert.equal(result.evidenceCompletion,!outcome?.committed?'PUBLICATION_UNCONFIRMED':outcome.durabilityConfirmed?'COMMITTED_DURABILITY_CONFIRMED':'COMMITTED_DURABILITY_UNCONFIRMED');
 if(outcome){assert.notEqual(result.persistence,outcome);if(outcome.warnings.length){const before=result.persistence.warnings[0].operation;outcome.warnings[0].operation='mutated';assert.equal(result.persistence.warnings[0].operation,before);outcome.warnings[0].operation=before;}}
 assert.equal(runs,failure==='stage'?1:failure==='cleanup'?2:12);assert(closed>=1);cases++;
}
for(const failure of ['none','stage','cleanup']){
 const publicationError=Error('persist injected'), executionError=Error('stage injected'), cleanupError=Error('cleanup injected');let caught;
 async function open(contract){return{contract,run:async()=>{if(failure==='stage')throw executionError;return{status:0,stdout:'',stderr:''};},close:async()=>{if(failure==='cleanup')throw cleanupError;}};}
 try{await compose({capture:()=>({source:'qa438'}),versions:{node:'fixture',npm:'fixture'},openAudit:open,openLocal:open,persist:async()=>{throw publicationError;}});}catch(e){caught=e;}
 assert.equal(caught,publicationError);assert.equal(caught.evidence.evidenceCompletion,'CALLBACK_FAILED_PUBLICATION_UNKNOWN');assert.equal(caught.evidence.qualification,'INCOMPLETE');assert.equal(caught.executionFailure,failure==='none'?undefined:failure==='stage'?executionError:cleanupError);if(failure!=='none')assert(caught.executionFailure.evidence);cases++;
}
console.log(`PASS independent successor caller matrix ${cases} cases: outcomes cloned, warnings/durability retained, unconfirmed incomplete, stage/cleanup reject evidence, callback-rejection execution cause retained, no sealed-input mutation.`);

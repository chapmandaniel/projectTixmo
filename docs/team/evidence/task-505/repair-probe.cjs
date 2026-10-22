'use strict';
const assert=require('node:assert/strict');
const {checkoutOwnership,criticalCall}=require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
(async()=>{
 for(const synchronous of [true,false]) {
  const work=checkoutOwnership({event:'lead505-repair'},20); let cleanup=0;
  const wrapped=criticalCall(()=>{if(synchronous)throw Error('raw');return Promise.reject(Error('raw'));},work);
  await wrapped().catch(()=>{assert.equal(work.preserved,true);assert.throws(()=>work.admit(),/preserve fixture IDs/);});
  assert.equal(work.size,0);
  await assert.rejects(work.teardown([()=>{cleanup++;}]),/preserve fixture IDs/);
  assert.equal(cleanup,0); console.log('PASS lead505 raw failure permanent '+synchronous);
 }
 const work=checkoutOwnership({event:'success'},20);let cleanup=0;
 const nested=criticalCall(async()=>23,work);
 assert.equal(await work.run(()=>nested()),23);
 await work.teardown([()=>{cleanup++;}]);assert.equal(cleanup,1);
 console.log('PASS lead505 nested criticalCall in tracked work permits cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});

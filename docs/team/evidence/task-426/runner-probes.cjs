'use strict';
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {launch,finish} = require('./process-cleanup.cjs');
const {verify,validatePorts} = require('./preflight.cjs');
(async () => {
  for (const key of ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD']) assert.throws(() => verify({[key]:'untrusted'}), /Ambient preload rejected/);
  assert.throws(() => verify({TASK426_EXPECTED_SHA:'0'.repeat(40)}), /exact executed/);
  console.log('PASS pre-Jest preload and wrong-SHA denial without application imports');
  assert.deepEqual(validatePorts('2345,3456'),[2345,3456]);
  for (const value of ['02345,2345','2345,2345','2345,03456','1023,2345','65536,2345','2345,3456,4567']) assert.throws(()=>validatePorts(value), /owned service ports/);
  console.log('PASS canonical numeric distinct ports: leading-zero aliases and range/malformed mutations rejected');
  const missing = launch('/task448-definitely-nonexistent-executable',['fixture-arg'],{env:{}});
  await new Promise(resolve => missing.child.once('close',resolve));
  const missingReport = await finish(missing,{timeoutMs:100,writeEvidence:()=>{throw Object.assign(new Error('ENOENT receipt ENOSPC fixture'),{code:'ENOSPC'});}});
  assert.equal(missingReport.result.error.code,'ENOENT');
  assert.equal(missingReport.result.code,-2); assert.equal(missingReport.result.signal,null);
  assert.match(missingReport.result.error.message,/nonexistent-executable/);
  const serialized = JSON.parse(JSON.stringify(missingReport));
  for (const key of ['name','message','stack','code','errno','syscall','path','spawnargs']) assert.ok(Object.hasOwn(serialized.result.error,key),key);
  assert.equal(serialized.result.error.name,'Error');
  assert.equal(serialized.result.error.code,'ENOENT');
  assert.equal(typeof serialized.result.error.errno,'number');
  assert.match(serialized.result.error.syscall,/spawn/);
  assert.equal(serialized.result.error.path,'/task448-definitely-nonexistent-executable');
  assert.deepEqual(serialized.result.error.spawnargs,['fixture-arg']);
  assert.match(serialized.result.error.message,/nonexistent-executable/);
  assert.match(serialized.result.error.stack,/ENOENT/);
  assert.equal(serialized.result.code,-2); assert.equal(serialized.result.signal,null);
  assert.equal(serialized.timedOut,false); assert.match(serialized.evidenceError,/ENOSPC/);
  console.log('PASS real ENOENT+close+evidence ENOSPC JSON roundtrip preserves name/message/stack/code/errno/syscall/path/spawnargs and status/signal');
  // Real closed/reaped child; hold the first cleanup callback so the second
  // finish overlaps deterministically, without depending on scheduler timing.
  const concurrent = launch(process.execPath,['-e','process.exit(31)'],{env:{}});
  await new Promise(resolve => concurrent.child.once('close',resolve));
  let releaseTeardown, enteredTeardown;
  const teardownGate = new Promise(resolve=>{releaseTeardown=resolve;});
  const teardownEntered = new Promise(resolve=>{enteredTeardown=resolve;});
  let concurrentTeardowns=0, concurrentEvidence=0, duplicateTeardowns=0, duplicateEvidence=0;
  const firstFinish = finish(concurrent,{teardown:async()=>{
    concurrentTeardowns++; assert.equal(concurrent.result.code,31);
    assert.equal(concurrent.child.exitCode,31); enteredTeardown(); await teardownGate;
  },writeEvidence:()=>{concurrentEvidence++;}});
  await teardownEntered;
  try {
    await assert.rejects(finish(concurrent,{teardown:()=>{duplicateTeardowns++;},writeEvidence:()=>{duplicateEvidence++;}}),/No live owned/);
  } finally { releaseTeardown(); }
  const concurrentReport = await firstFinish;
  assert.equal(concurrentReport.result.code,31);
  assert.deepEqual([concurrentTeardowns,concurrentEvidence,duplicateTeardowns,duplicateEvidence],[1,1,0,0]);
  await assert.rejects(finish(concurrent),/No live owned/);
  console.log('PASS real owned concurrent finish denied during held teardown, callbacks exactly once and sequential reuse denied');
  const reentrant = launch(process.execPath,['-e','process.exit(32)'],{env:{}});
  await new Promise(resolve => reentrant.child.once('close',resolve));
  let reentrantTeardowns=0, reentrantEvidence=0, nestedCallbacks=0;
  const nestedOptions = {teardown:()=>{nestedCallbacks++;},writeEvidence:()=>{nestedCallbacks++;}};
  const reentrantReport = await finish(reentrant,{teardown:async()=>{
    reentrantTeardowns++; assert.equal(reentrant.child.exitCode,32);
    await assert.rejects(finish(reentrant,nestedOptions),/No live owned/);
  },writeEvidence:async()=>{
    reentrantEvidence++;
    await assert.rejects(finish(reentrant,nestedOptions),/No live owned/);
  }});
  assert.equal(reentrantReport.result.code,32);
  assert.deepEqual([reentrantTeardowns,reentrantEvidence,nestedCallbacks],[1,1,0]);
  await assert.rejects(finish(reentrant),/No live owned/);
  console.log('PASS real owned reentrant finish denied from both teardown and evidence; callbacks exactly once');
  const foreign = spawn(process.execPath,['-e','setInterval(()=>{},1000)'], {stdio:'ignore'});
  try {
    await assert.rejects(finish({child:foreign}), /No live owned/);
    assert.equal(foreign.exitCode,null);
    console.log('PASS unrelated PID rejected, foreign owned probe remains alive');
    const code = `const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}); process.on('SIGTERM',()=>{c.kill('SIGTERM'); c.once('close',()=>process.exit(23));}); setInterval(()=>{},1000);`;
    const record = launch(process.execPath,['-e',code],{env:{PATH:process.env.PATH}});
    let teardown = false;
    const result = await finish(record,{timeoutMs:400,graceMs:1200,teardown:()=>{assert.notEqual(record.result,null);teardown=true;}});
    assert.equal(result.timedOut,true); assert.equal(result.result.code,23); assert.equal(teardown,true);
    console.log('PASS real owned two-process timeout, termination, direct reap and process absence before teardown');
    const failed = launch(process.execPath,['-e','console.error("ORIGINAL_STDERR_SENTINEL");process.exit(42)'],{env:{}});
    const report = await finish(failed,{timeoutMs:1000,writeEvidence:()=>{throw Object.assign(new Error('ENOSPC fixture'),{code:'ENOSPC'});}});
    assert.equal(report.result.code,42); assert.match(report.evidenceError,/ENOSPC/);
    console.log('PASS original exit42/stderr retained with evidence ENOSPC');
  } finally { foreign.kill('SIGTERM'); await new Promise(resolve=>foreign.once('close',resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});

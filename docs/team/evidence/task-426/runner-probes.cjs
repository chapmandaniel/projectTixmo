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
  const missing = launch('/task448-definitely-nonexistent-executable',[],{env:{}});
  await new Promise(resolve => missing.child.once('close',resolve));
  const missingReport = await finish(missing,{timeoutMs:100});
  assert.equal(missingReport.result.error.code,'ENOENT');
  assert.equal(missingReport.result.code,-2); assert.equal(missingReport.result.signal,null);
  assert.match(missingReport.result.error.message,/nonexistent-executable/);
  console.log('PASS actual ENOENT original spawn diagnostic survives later close code and signal');
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

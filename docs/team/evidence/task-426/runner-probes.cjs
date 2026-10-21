'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {launch,finish} = require('./process-cleanup.cjs');
const {status} = require('./exit-status.cjs');
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
  // Closed real children, never-settling callbacks: caller completion is
  // bounded, but timeout must not claim callback cancellation/completion.
  const deadlineChild = launch(process.execPath,['-e','console.error("DEADLINE_PRIMARY_STDERR");process.exit(47)'],{env:{}});
  await new Promise(resolve=>deadlineChild.child.once('close',resolve));
  for (const key of ['timeoutMs','graceMs','teardownMs','evidenceMs']) {
    for (const value of [NaN,Infinity,0,-1,1.5,60001,'10']) {
      await assert.rejects(finish(deadlineChild,{[key]:value}), /integer in 1..60000/);
    }
  }
  let deadlineTeardowns=0, deadlineEvidence=0, deadlineDuplicates=0, lateReject;
  const pendingTeardown = new Promise((_,reject)=>{lateReject=reject;});
  let deadlineEntered;
  const deadlineGate = new Promise(resolve=>{deadlineEntered=resolve;});
  const deadlineStart = Date.now();
  let deadlineFailure;
  try {
    const deadlineFinish = finish(deadlineChild,{teardownMs:40,evidenceMs:40,teardown:async()=>{
      deadlineTeardowns++; deadlineEntered();
      assert.equal(deadlineChild.child.exitCode,47);
      assert.throws(()=>process.kill(deadlineChild.child.pid,0), /ESRCH/);
      await assert.rejects(finish(deadlineChild,{teardown:()=>{deadlineDuplicates++;}}),/No live owned/);
      return pendingTeardown;
    },writeEvidence:async()=>{
      deadlineEvidence++;
      await assert.rejects(finish(deadlineChild),/No live owned/);
      throw new Error('SEPARATE_EVIDENCE_FAILURE');
    }});
    await deadlineGate;
    await assert.rejects(finish(deadlineChild,{teardown:()=>{deadlineDuplicates++;}}),/No live owned/);
    await deadlineFinish;
    assert.fail('Unsettled teardown must reject with report');
  } catch(error) { deadlineFailure=error; }
  assert.equal(deadlineFailure.code,'CALLBACK_DEADLINE');
  assert.equal(deadlineFailure.report.result.code,47);
  assert.equal(status(deadlineFailure.report),47);
  assert.equal(deadlineFailure.report.timedOut,false);
  assert.match(deadlineFailure.report.cleanupError,/Teardown callback deadline/);
  assert.match(deadlineFailure.report.evidenceError,/SEPARATE_EVIDENCE_FAILURE/);
  assert.equal(deadlineFailure.report.teardownStatus,'timed-out-pending-late-effects-possible');
  assert.equal(deadlineFailure.report.evidenceStatus,'failed');
  assert.deepEqual([deadlineTeardowns,deadlineEvidence,deadlineDuplicates],[1,1,0]);
  assert.ok(Date.now()-deadlineStart < 1500);
  await assert.rejects(finish(deadlineChild),/No live owned/);
  lateReject(new Error('LATE_TEARDOWN_REJECTION_HANDLED'));
  await new Promise(resolve=>setImmediate(resolve));
  console.log('PASS real exit47/stderr/reaping preserved through bounded unsettled teardown, separate evidence failure, reentrancy and late rejection; invalid timer values rejected');
  const receiptChild = launch(process.execPath,['-e','process.exit(0)'],{env:{}});
  await new Promise(resolve=>receiptChild.child.once('close',resolve));
  let receiptEntered;
  const receiptGate = new Promise(resolve=>{receiptEntered=resolve;});
  const receiptStart = Date.now();
  const receiptFinish = finish(receiptChild,{evidenceMs:40,writeEvidence:()=>{receiptEntered();return new Promise(()=>{});}});
  await receiptGate;
  await assert.rejects(finish(receiptChild),/No live owned/);
  const receiptReport=await receiptFinish;
  assert.equal(receiptReport.result.code,0);
  assert.equal(status(receiptReport),1);
  assert.equal(receiptReport.teardownStatus,'not-started');
  assert.equal(receiptReport.evidenceStatus,'timed-out-pending-late-effects-possible');
  assert.match(receiptReport.evidenceError,/Evidence callback deadline/);
  assert.ok(Date.now()-receiptStart < 1500);
  console.log('PASS real owned reaped child with never-settling evidence returns bounded separate failure and concurrent reuse denied');
  // Each rejection/path/primary combination uses a real owned, closed child.
  // Verify reaping before callbacks, JSON diagnostic durability, one-shot
  // authority and primary nonzero precedence as well as success->failure mapping.
  const rejections = [null, undefined, 'primitive448', 0, false, 17n, Symbol('primitive448'),
    Object.create(null), new Proxy({}, {get(){throw new Error('hostile getter');}})];
  for (const path of ['teardown','evidence']) {
    for (const rejection of rejections) {
      for (const primary of [0,54]) {
        const child = launch(process.execPath,['-e',`console.error("PRIMITIVE_PRIMARY_${path}_${primary}");process.exit(${primary})`],{env:{}});
        await new Promise(resolve=>child.child.once('close',resolve));
        let calls=0, evidenceCalls=0, report, failure;
        const reject = async()=>{
          calls++;
          assert.equal(child.child.exitCode,primary);
          assert.throws(()=>process.kill(child.child.pid,0),/ESRCH/);
          await assert.rejects(finish(child),/No live owned/);
          throw rejection;
        };
        const options = path === 'teardown'
          ? {teardown:reject,writeEvidence:()=>{evidenceCalls++;}}
          : {writeEvidence:reject};
        try { report=await finish(child,options); } catch(error) { failure=error; report=error.report; }
        assert.equal(Boolean(failure),path === 'teardown');
        assert.equal(report.result.code,primary);
        assert.equal(report.result.signal,null);
        assert.equal(report.timedOut,false);
        const json=JSON.parse(JSON.stringify(report));
        assert.match(json[path === 'teardown' ? 'cleanupError' : 'evidenceError'],/Callback rejected/);
        assert.equal(json[path === 'teardown' ? 'teardownStatus' : 'evidenceStatus'],'failed');
        assert.equal(status(json),primary || 1);
        assert.equal(calls,1);
        assert.equal(evidenceCalls,path === 'teardown' ? 1 : 0);
        await assert.rejects(finish(child),/No live owned/);
      }
    }
  }
  console.log('PASS 36 real owned reaped child cases: null/undefined/string/number/boolean/bigint/symbol/null-prototype/hostile rejection in both callbacks, JSON diagnostics, primary0->1 and primary54 preserved, one-shot cleanup');
  // Private disk handshake is emitted only AFTER installing the TERM handler.
  // No socket, app service, mocked signal, or externally supplied PID authority.
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(),'task448-stubborn-'));
  fs.chmodSync(privateRoot,0o700);
  const readyPath = path.join(privateRoot,'ready.json');
  const termPath = path.join(privateRoot,'term.json');
  const stubbornCode = `const fs=require('node:fs');
    process.on('SIGTERM',()=>fs.writeFileSync(${JSON.stringify(termPath)},JSON.stringify({pid:process.pid,signal:'SIGTERM'}),{mode:0o600}));
    console.error('STUBBORN_PRIMARY_STDERR_SENTINEL');
    fs.writeFileSync(${JSON.stringify(readyPath)},JSON.stringify({pid:process.pid,ready:true}),{mode:0o600});
    setInterval(()=>{},1000);`;
  const stubborn = launch(process.execPath,['-e',stubbornCode],{env:{}});
  let directClosed=false;
  stubborn.child.once('close',()=>{directClosed=true;});
  try {
    const readyDeadline=Date.now()+2000;
    while (!fs.existsSync(readyPath) && !directClosed && Date.now()<readyDeadline) await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(JSON.parse(fs.readFileSync(readyPath,'utf8')),{pid:stubborn.child.pid,ready:true});
    assert.equal(directClosed,false);
    const groupMembers=()=>fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x)).filter(pid=>{
      try { const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8'); return Number(stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/)[2]) === stubborn.child.pid; }
      catch(error) { if (error.code==='ENOENT'||error.code==='ESRCH') return false; throw error; }
    });
    assert.deepEqual(groupMembers(),[String(stubborn.child.pid)]);
    // A copied PID/identity record must not signal the genuine live child.
    let fakeCallbacks=0;
    await assert.rejects(finish({child:stubborn.child,identity:stubborn.identity},{teardown:()=>fakeCallbacks++,writeEvidence:()=>fakeCallbacks++}),/No live owned/);
    assert.equal(fakeCallbacks,0); assert.equal(directClosed,false);
    assert.equal(fs.existsSync(termPath),false);
    const order=[];
    const verifyReaped=()=>{
      assert.equal(directClosed,true);
      assert.equal(stubborn.child.signalCode,'SIGKILL');
      assert.equal(fs.existsSync(`/proc/${stubborn.child.pid}`),false);
      assert.deepEqual(groupMembers(),[]);
      assert.deepEqual(JSON.parse(fs.readFileSync(termPath,'utf8')),{pid:stubborn.child.pid,signal:'SIGTERM'});
    };
    const started=Date.now();
    const killed=await finish(stubborn,{timeoutMs:40,graceMs:150,teardown:()=>{
      verifyReaped();order.push('synthetic-teardown');
    },writeEvidence:report=>{
      verifyReaped();order.push('synthetic-evidence');
      assert.equal(report.result.signal,'SIGKILL');
      throw new Error('STUBBORN_ENOSPC_SECONDARY');
    }});
    assert.ok(Date.now()-started<1500);
    assert.deepEqual(order,['synthetic-teardown','synthetic-evidence']);
    assert.equal(killed.timedOut,true);
    assert.equal(killed.result.code,null); assert.equal(killed.result.signal,'SIGKILL');
    assert.equal(killed.teardownStatus,'completed'); assert.equal(killed.evidenceStatus,'failed');
    assert.match(killed.evidenceError,/STUBBORN_ENOSPC_SECONDARY/);
    const json=JSON.parse(JSON.stringify(killed));
    assert.equal(status(json),137); assert.equal(json.result.signal,'SIGKILL');
    await assert.rejects(finish(stubborn),/No live owned/);
    console.log('PASS actual ready direct child ignored TERM, bounded KILL escalation, awaited close/direct reap+group absence BEFORE synthetic callbacks, primary SIGKILL137+stderr preserved despite evidence failure, foreign identity denied');
  } finally {
    if (!directClosed) { stubborn.child.kill('SIGKILL'); await new Promise(resolve=>stubborn.child.once('close',resolve)); }
    fs.rmSync(privateRoot,{recursive:true,force:true});
  }
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

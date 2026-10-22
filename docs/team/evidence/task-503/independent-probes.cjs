'use strict';
const assert = require('node:assert/strict');
const { checkoutOwnership, promiseMiddleware } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
(async () => {
  for (const throws of [false, true]) {
    const ids = {event:'lead-owned', foreign:{event:'lead-sentinel'}};
    const work = checkoutOwnership(ids, 20);
    let release, settled=false, notified=false, early=false, cleanup=0;
    const hidden = new Promise(resolve => {release=resolve;}).then(() => {settled=true;});
    const wrapper = promiseMiddleware(() => {
      queueMicrotask(() => {assert.equal(notified,false); assert.equal(work.preserved,true); early=true;});
      if (throws) throw Error('unknown');
    }, work)();
    wrapper.catch(() => {notified=true;});
    await assert.rejects(wrapper, /preserve fixture IDs/);
    assert.equal(early,true); assert.equal(work.size,0); assert.equal(settled,false);
    await assert.rejects(work.teardown([() => {cleanup++;}]), /preserve fixture IDs/);
    release(); await hidden;
    await assert.rejects(work.join(), /preserve fixture IDs/);
    assert.throws(() => work.admit(), /preserve fixture IDs/);
    assert.equal(cleanup,0); assert.deepEqual(work.inventory,ids);
    console.log('PASS lead early unknown-lifetime latch '+throws);
  }
  for (const kind of ['observer', 'raw-close', 'teardown']) {
    const work=checkoutOwnership({event:kind},20); let cleanup=0, disconnect=0;
    const fail=() => {throw Error(kind+' failed');};
    if (kind==='teardown') await assert.rejects(work.teardown([fail,()=>{disconnect++;}]), /preserve fixture IDs/);
    else await assert.rejects(work.critical(fail), /preserve fixture IDs/);
    await assert.rejects(work.teardown([()=>{cleanup++;},()=>{disconnect++;}]), /preserve fixture IDs/);
    assert.throws(()=>work.admit(), /preserve fixture IDs/);
    assert.deepEqual([cleanup,disconnect],[0,0]);
    console.log('PASS lead '+kind+' failure stops cleanup/disconnect/admission');
  }
  for (const rejects of [false,true]) {
    const work=checkoutOwnership({event:'settled'},20); let cleanup=0;
    const client=work.run(()=>rejects?Promise.reject(Error('client')):Promise.resolve(201));
    if(rejects) await assert.rejects(client,/client/); else assert.equal(await client,201);
    await work.teardown([()=>{cleanup++;}]); assert.equal(cleanup,1); assert.equal(work.preserved,false);
    console.log('PASS lead settled client '+rejects+' cleanup control');
  }
  const work=checkoutOwnership({event:'mutable'},20); let release, cleaned=false;
  const child=new Promise(resolve=>{release=resolve;});
  await work.run(()=>{work.run(()=>child);});
  const teardown=work.teardown([()=>{cleaned=true;}]);
  await Promise.resolve(); assert.equal(cleaned,false); release(); await teardown;
  assert.equal(cleaned,true); console.log('PASS lead mutable nested registration drain');
})().catch(error=>{console.error(error);process.exitCode=1;});

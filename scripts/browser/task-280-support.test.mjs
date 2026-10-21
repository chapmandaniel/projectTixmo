import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { ORDER_ID, RECOVERY_PATH, recoveryFixture, createCDP, stopOwnedChild, cleanupOwned, assertListenerClosed } from './task-280-support.mjs';

test('synthetic return is admitted by actual product UUID guard and exact recovery projection', async () => {
    const source = await readFile(new URL('../../tdash/src/pages/CheckoutPage.jsx', import.meta.url), 'utf8');
    const guard = source.match(/const valid = (\/\^.*?\/i)\.test\(candidate/)[1];
    const regex = new RegExp(guard.slice(1,-2),'i');
    assert(regex.test(ORDER_ID));assert(!regex.test('synthetic-order'));
    assert(source.includes('api.get(`/orders/${encodeURIComponent(candidate)}/recovery`)'));
    const expectedKeys=source.match(/Object\.keys\(data\)\.sort\(\)\.join\(','\) === '([^']+)'/)[1];
    const response=recoveryFixture(RECOVERY_PATH,'Bearer synthetic-A');
    assert.equal(response.status,200);assert.equal(Object.keys(response.data).sort().join(','),expectedKeys);
    assert.equal(response.data.id,ORDER_ID);assert.equal(response.data.paymentStatus,'SUCCEEDED');
    assert.equal(recoveryFixture(RECOVERY_PATH,'Bearer synthetic-B').status,403);
    assert.throws(()=>recoveryFixture(`/orders/${ORDER_ID}`,'Bearer synthetic-A'),/Unexpected recovery route/);
});
class Socket extends EventTarget { send(value){this.last=JSON.parse(value);} }
test('CDP lost response times out; late response is harmless; closure rejects pending calls',async()=>{
    const socket=new Socket();const send=createCDP(socket,15);
    await assert.rejects(send('NeverReplies'),/timeout/);
    socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:socket.last.id,result:{}})}));
    const pending=send('Interrupted');socket.dispatchEvent(new Event('close'));await assert.rejects(pending,/CDP closed/);
});
test('owned stubborn child escalates to SIGKILL and PID is proven absent',async()=>{
    const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','ignore']});
    await new Promise(resolve=>child.stdout.once('data',resolve));
    const proof=await stopOwnedChild(child,50);assert.equal(proof.signalCode,'SIGKILL');assert.equal(proof.stopped,true);
});
test('cleanup on startup failure closes own listener and removes profile',async()=>{
    const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;
    await assert.rejects(assertListenerClosed(port),/still open/);
    const profile=await mkdtemp(`${tmpdir()}/tixmo-280-selftest-`);
    const proof=await cleanupOwned({server:{httpServer:listener,close:()=>new Promise(r=>listener.close(r))},profile,remove:rm});
    assert.deepEqual(proof.listener,{port,closed:true});await assert.rejects(access(profile),{code:'ENOENT'});
});
test('server cleanup failure cannot prevent profile removal',async()=>{
    const profile=await mkdtemp(`${tmpdir()}/tixmo-280-selftest-`);
    await assert.rejects(cleanupOwned({server:{close:async()=>{throw Error('injected close failure');}},profile,remove:rm}),AggregateError);
    await assert.rejects(access(profile),{code:'ENOENT'});
});

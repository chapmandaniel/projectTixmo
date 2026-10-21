'use strict';
const assert=require('node:assert/strict'), net=require('node:net');
let calls=0;
net.Socket.prototype.connect=function(){calls++;return this;};
process.env.TASK379_ALLOWED_PORTS='31001,51001';
process.env.TASK427_BLOCK_LOG='/dev/null';
require('../task-427/network-guard.cjs');
const scope=net[Symbol.for('tixmo.task427.ownedScope')];
const call=(host='127.0.0.1',port=60001)=>net.Socket.prototype.connect.call({}, {host,port});
const denied=()=>assert.throws(()=>call(),/rejected/);
(async()=>{
  let release, started;
  const ready=new Promise(r=>started=r), gate=new Promise(r=>release=r);
  const inside=scope(async()=>{started();await gate;denied();await new Promise(r=>setImmediate(r));denied();scope(()=>denied());denied();call('127.0.0.1',31001);});
  await ready;call();assert.throws(()=>call('203.0.113.8',443),/BLOCKED/);release();await inside;
  assert.throws(()=>scope(()=>{denied();throw Error('sync');}),/sync/);call();
  await assert.rejects(scope(async()=>{await Promise.resolve();denied();throw Error('async');}),/async/);call();
  // Descendant async callback retains strict even after scope.run has returned.
  await new Promise((resolve,reject)=>scope(()=>setImmediate(()=>{try{denied();resolve();}catch(e){reject(e);}})));
  await scope(async()=>{
    assert.throws(()=>call('::1',31001),/rejected/);
    assert.throws(()=>net.Socket.prototype.connect.call({}, {host:'127.0.0.1',port:31001,path:'/tmp/no'}),/rejected/);
    assert.throws(()=>call('203.0.113.8',31001),/rejected/);
    net.Socket.prototype.connect.call({},net._normalizeArgs([{host:'127.0.0.1',port:51001,path:null}]));
    const server=new(require('node:http').Server)();Object.defineProperty(server,'listening',{value:true});
    server._handle={getsockname(out){Object.assign(out,{address:'127.0.0.1',family:'IPv4',port:60002});return 0;}};
    const register=net[Symbol.for('tixmo.task379.registerListener')];register(server);call('127.0.0.1',60002);server.emit('close');assert.throws(()=>call('127.0.0.1',60002),/rejected/);server._handle=null;
  });
  assert.throws(()=>require('node:http').get('http://203.0.113.8'),/BLOCKED/);
  assert.throws(()=>require('node:tls').connect({host:'203.0.113.8',port:443}),/BLOCKED/);
  assert.throws(()=>require('node:dgram').createSocket('udp4'),/forbids UDP/);
  assert.equal(calls,6);console.log('PASS QA independent stub: 6 fake transports, concurrent ALS/callback/errors, native fake close revoke, outer net/http/tls failclosed; no connections/listen');
})().catch(e=>{console.error(e);process.exitCode=1;});

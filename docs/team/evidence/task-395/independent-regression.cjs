'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
let transports = 0;
net.Socket.prototype.connect = function () { transports++; return this; };
process.env.TASK379_ALLOWED_PORTS='31001,41001';
require('../task-379/network-guard.cjs');
const register=net[Symbol.for('tixmo.task379.registerListener')];
// Real HTTPServer and native Server.address/listening methods, but a fake handle:
// no listen(), sockets, or kernel networking occurs.
function server(address={address:'127.0.0.1',family:'IPv4',port:51001}) {
  const s=http.createServer();
  s._handle={getsockname(out){Object.assign(out,address); return 0;}};
  return s;
}
assert.throws(()=>register(http.createServer()),/listening/);
for(const a of [null,{address:'0.0.0.0',family:'IPv4',port:51001},{address:'::1',family:'IPv6',port:51001},{address:'127.0.0.1',family:'IPv4',port:0},{address:'127.0.0.1',family:'IPv4',port:65536},{address:'127.0.0.1',family:'IPv4',port:'51001'}]) {
  if(a) assert.throws(()=>register(server(a)),/IPv4/);
}
const s=server(); const revoke=register(s);
new net.Socket().connect({host:'127.0.0.1',port:51001});
assert.throws(()=>register(s),/already/);
for(const o of [{host:'127.0.0.1',port:51002},{host:'::1',port:51001},{host:'localhost',port:51001},{host:'203.0.113.1',port:51001},{path:'/tmp/unowned.sock'},{host:'127.0.0.1',port:'not-a-port'},{port:51001}]) assert.throws(()=>new net.Socket().connect(o));
assert.throws(()=>require('node:dgram').createSocket('udp4'),/UDP/);
revoke();revoke();assert.throws(()=>new net.Socket().connect({host:'127.0.0.1',port:51001}));
const s2=server();register(s2);s2.emit('close');assert.throws(()=>new net.Socket().connect({host:'127.0.0.1',port:51001}));
assert.equal(transports,1);
console.log('PASS native address/listening methods with fake handle: exact registration, duplicate, explicit/close revoke; invalid listener and Unix/UDP/IPv6/external/unowned/malformed target denial; transport=1 stub only');
const cleanupSource=fs.readFileSync(path.join(__dirname,'../task-393/process-cleanup.cjs'),'utf8');
function observe({identity={pid:123456},listener={pid:123456,address:{address:'127.0.0.1',port:51001}},present=false,ss={status:0,stdout:''},missing=false}={}) {
 let report, calls=0;const process={argv:['node','observer','/fake'],exitCode:0};
 const fakeFs={readFileSync(p){if(missing)throw Error('ENOENT');return JSON.stringify(p.endsWith('jest-identity.json')?identity:listener);},existsSync(){return present;},writeFileSync(p,value){report=JSON.parse(value);}};
 vm.runInNewContext(cleanupSource,{require(name){if(name==='node:fs')return fakeFs;if(name==='node:path')return path;if(name==='node:child_process')return {spawnSync(){calls++;return ss;}};if(name==='../task-379/runtime-path.cjs')return {validate(){}};throw Error(name);},process,console:{log(){}},Date});
 return {status:process.exitCode,report,calls};
}
for(const [name,options] of [['missing',{missing:true}],['invalid PID',{identity:{pid:'123456'}}],['PID present/recycled',{present:true}],['ss failure',{ss:{status:1,stdout:''}}],['ss unavailable',{ss:{status:null,stdout:null}}],['port occupied',{ss:{status:0,stdout:'LISTEN 127.0.0.1:51001'}}],['wrong PID',{listener:{pid:5,address:{address:'127.0.0.1',port:51001}}}],['invalid port',{listener:{pid:123456,address:{address:'127.0.0.1',port:0}}}]]) {
 assert.equal(observe(options).status,1,name); console.log('PASS cleanup rejects '+name);
}
const stale=observe({identity:{pid:123456,ppid:'invalid',executable:'/not/node',startStat:'garbage'},listener:{pid:123456,ppid:999,executable:'/different',startStat:'different',address:{address:'127.0.0.1',family:'IPv6',port:51001}}});
assert.equal(stale.status,0);
console.log('REPRODUCED GAP: malformed/stale process provenance and listener family accepted when integer PID absent and port clear; exit=0. startStat/ppid/executable are retained but never checked.');

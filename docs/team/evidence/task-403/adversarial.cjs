'use strict';
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
let calls = 0, denied = 0;
net.Socket.prototype.connect = function () { calls++; return this; };
net.Server.prototype.address = function () { return this.metadata; };
process.env.TASK379_ALLOWED_PORTS = '';
require('../task-379/network-guard.cjs');
const register = net[Symbol.for('tixmo.task379.registerListener')];
function reject(fn) { const before=calls; assert.throws(fn); assert.equal(calls,before); denied++; }
const s=http.createServer();
s.metadata={address:'127.0.0.1',family:'IPv4',port:44444};
reject(()=>register({listening:true,address:()=>s.metadata}));
reject(()=>register(s));
Object.defineProperty(s,'listening',{value:true});
for (const metadata of [null,{address:'::1',family:'IPv6',port:44444},{address:'0.0.0.0',family:'IPv4',port:44444},{address:'127.0.0.1',family:'IPv4',port:'44444'},{address:'127.0.0.1',family:'IPv4',port:0},{address:'127.0.0.1',family:'IPv4',port:65536}]) {
 s.metadata=metadata; reject(()=>register(s));
}
s.metadata={address:'127.0.0.1',family:'IPv4',port:44444};
// An overridden public address method cannot replace captured native provenance.
s.address=()=>({address:'0.0.0.0',family:'IPv4',port:55555});
const revoke=register(s);
reject(()=>register(s));
for (const host of ['localhost','::1','127.0.0.2','203.0.113.1',undefined]) reject(()=>new net.Socket().connect({host,port:44444,path:null}));
for (const port of [44443,44445,0,65536]) reject(()=>new net.Socket().connect({host:'127.0.0.1',port,path:null}));
for (const path of ['/tmp/x','',false,0,[],{}]) reject(()=>new net.Socket().connect({host:'127.0.0.1',port:44444,path}));
new net.Socket().connect([{host:'127.0.0.1',port:44444,path:null}]);
assert.equal(calls,1);
revoke(); revoke();
reject(()=>new net.Socket().connect({host:'127.0.0.1',port:44444,path:null}));
register(s); s.emit('close');
reject(()=>new net.Socket().connect({host:'127.0.0.1',port:44444,path:null}));
reject(()=>require('node:dgram').createSocket('udp6'));
assert.equal(calls,1);
console.log(`PASS independent ${denied} denials, 1 null-vector admission; native provenance captured; duplicate registration, explicit revoke, close revoke; no sockets`);

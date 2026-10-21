'use strict';
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
let calls = 0, denied = 0;
net.Socket.prototype.connect = function () { calls++; return this; };
net.Server.prototype.address = function () { return this.fixture; };
process.env.TASK379_ALLOWED_PORTS = '';
require('../task-379/network-guard.cjs');
const register = net[Symbol.for('tixmo.task379.registerListener')];
function server(address) {
  const s = http.createServer(); s.fixture = address;
  Object.defineProperty(s, 'listening', {value:true}); return s;
}
const valid = {address:'127.0.0.1',family:'IPv4',port:44444};
for (const patch of [{address:'localhost'},{address:'::1'},{address:'0.0.0.0'},{family:'IPv6'},{port:0},{port:65536},{port:'44444'},{port:1.5}]) {
  assert.throws(() => register(server({...valid,...patch})), /IPv4/); denied++;
}
const owned = server(valid), revoke = register(owned);
assert.throws(() => register(owned), /already/); denied++;
new net.Socket().connect([{host:'127.0.0.1',port:44444,path:null}]);
assert.equal(calls,1);
for (const path of ['/tmp/foreign.sock','',false,0,{},[],true]) {
  assert.throws(() => new net.Socket().connect([{host:'127.0.0.1',port:44444,path}]), /non-owned/); denied++;
}
for (const host of ['localhost','::1','127.0.0.2','203.0.113.1']) {
  assert.throws(() => new net.Socket().connect([{host,port:44444,path:null}]), /non-owned/); denied++;
}
assert.throws(() => new net.Socket().connect([{host:'127.0.0.1',port:44445,path:null}]), /non-owned/); denied++;
revoke();
assert.throws(() => new net.Socket().connect([{host:'127.0.0.1',port:44444,path:null}]), /non-owned/); denied++;
assert.equal(calls,1);
console.log(`PASS independent adversarial: ${denied} denied, 1 null-path vector transport; explicit revoke; stub only`);

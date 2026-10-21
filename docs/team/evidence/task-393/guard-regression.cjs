'use strict';
// No sockets: the pre-guard transport is a counter, never the native connector.
const assert = require('node:assert/strict');
const net = require('node:net');
const vm = require('node:vm');
const originalAddress = net.Server.prototype.address;
net.Server.prototype.address = function () { return this.__testAddress; };
let calls = 0;
net.Socket.prototype.connect = function () { calls++; return this; };
process.env.TASK379_ALLOWED_PORTS = '31001,41001';
require('../task-379/network-guard.cjs');
const sandbox = vm.runInNewContext("globalThis");
require('/home/daniel/projects/projectTixmo/worktrees/task-354/tixmoapi2/node_modules/jest-util').installCommonGlobals(sandbox, {});
sandbox.process.env.TASK379_ALLOWED_PORTS += ',51001';
assert.equal(process.env.TASK379_ALLOWED_PORTS, '31001,41001');
assert.equal(sandbox.process.env.TASK379_ALLOWED_PORTS, '31001,41001,51001');
assert.throws(() => new net.Socket().connect({host:'127.0.0.1',port:51001}), /non-owned/);
console.log('PROVED Jest copied env adds 51001; native preload does not see it; exact HTTP target rejected without socket');
const register = net[Symbol.for('tixmo.task379.registerListener')];
assert.equal(typeof register, 'function');
// Simulate a kernel address in this non-network unit only; real registration uses native address().
const http = require('node:http');
const server = http.createServer();
server.__testAddress = { address:'127.0.0.1', family:'IPv4', port:51001 };
assert.throws(() => register({address: () => server.__testAddress}), /owned/);
assert.throws(() => register(server), /listening/);
Object.defineProperty(server, 'listening', {value:true});
const unregister = register(server);
new net.Socket().connect({host:'127.0.0.1',port:51001});
new net.Socket().connect([{host:'127.0.0.1',port:31001}]);
for (const options of [{host:'127.0.0.1',port:51002},{host:'localhost',port:51001},{host:'::1',port:51001},{host:'203.0.113.1',port:51001},{path:'/tmp/foreign.sock'}]) {
  assert.throws(() => new net.Socket().connect(options), /non-owned/);
}
assert.throws(() => require('node:dgram').createSocket('udp4'), /UDP/);
server.emit('close');
assert.throws(() => new net.Socket().connect({host:'127.0.0.1',port:51001}), /non-owned/);
unregister(); // idempotent after automatic close revocation
server.__testAddress = {address:'0.0.0.0',family:'IPv4',port:51001};
assert.throws(() => register(server), /IPv4/);
assert.equal(calls,2);
net.Server.prototype.address = originalAddress;
console.log('PASS explicit owned listener registration/revocation; normalized vectors; failclosed Unix UDP external IPv6 unowned ports; transport calls=2 stub only');

'use strict';
// Actual Node normalization and guard chain; bottom transport replaced BEFORE imports.
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
let transports = 0;
net.Socket.prototype.connect = function () { transports++; return this; };
process.env.TASK379_ALLOWED_PORTS = '31001,51001';
process.env.TASK427_BLOCK_LOG = '/dev/null';
require('./network-guard.cjs');
const call = options => net.Socket.prototype.connect.call({}, options);
const scope = net[Symbol.for('tixmo.task427.ownedScope')];
(async () => {
  assert.throws(() => call({host:'203.0.113.1',port:443}), /BLOCKED/);
  assert.equal(transports, 0);
  call({host:'127.0.0.1',port:60001}); // other suites' loopback remains outer-guarded
  await scope(async () => {
    await Promise.resolve();
    assert.throws(() => call({host:'127.0.0.1',port:60001}), /rejected/);
    assert.throws(() => call({host:'127.0.0.1',port:31001,path:'/tmp/socket'}), /rejected/);
    call({host:'127.0.0.1',port:31001,path:null});
    call(net._normalizeArgs([{host:'127.0.0.1',port:51001}]));
    // Native class identity with fake listening/address only; NEVER listen/connect.
    const server = new http.Server();
    Object.defineProperty(server, 'listening', {value:true});
    // guard captured native address: fake its internal handle rather than open one.
    server._handle = {getsockname(out) {Object.assign(out,{address:'127.0.0.1',family:'IPv4',port:60002});return 0;}};
    const revoke = net[Symbol.for('tixmo.task379.registerListener')](server);
    call({host:'127.0.0.1',port:60002,path:null});
    revoke();
    assert.throws(() => call({host:'127.0.0.1',port:60002}), /rejected/);
    server._handle = null;
  });
  call({host:'127.0.0.1',port:60001});
  assert.equal(transports, 5);
  console.log('PASS transport stub: no native connections/listens; scope async propagation, nonowned rejection, normalized/null paths, native registration/revocation, outer scope restored');
})().catch(error => {console.error(error);process.exitCode=1;});

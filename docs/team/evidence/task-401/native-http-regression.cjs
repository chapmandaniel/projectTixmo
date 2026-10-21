'use strict';
// Native HTTP Agent normalization; transport replaced BEFORE loading the guard.
// No listen(), service, DNS, socket connect, or request response simulation.
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
let transports = 0;
net.Socket.prototype.connect = function () { transports++; return this; };
net.Server.prototype.address = function () { return this.__testAddress; };
process.env.TASK379_ALLOWED_PORTS = '33333';
require('../task-379/network-guard.cjs');
const guard = net.Socket.prototype.connect;
const observed = [];
net.Socket.prototype.connect = function (...args) {
  observed.push((Array.isArray(args[0]) ? args[0] : net._normalizeArgs(args))[0]);
  if (observed.length === 1) {
    const {host, port, path} = observed[0];
    console.log('FIRST native normalized target=' + JSON.stringify({host, port, path}) + '; transportCalls=' + transports);
  }
  return guard.apply(this, args);
};
let denied = 0;
function reject(makeRequest) {
  const before = transports;
  assert.throws(makeRequest, /non-owned/);
  assert.equal(transports, before);
  denied++;
}
function request(options, method = 'GET') {
  const before = transports;
  const req = method === 'GET' ? http.get(options) : http.request({...options, method});
  req.on('error', () => {});
  assert.equal(transports, before + 1);
  const normalized = observed.at(-1);
  assert.equal(normalized.path, null, 'actual native Agent TCP path sentinel');
  assert.equal(normalized.host, '127.0.0.1');
  req.destroy();
}
// Actual native HTTP on env-owned port; this fails before repair, transports=0.
request('http://127.0.0.1:33333/synthetic');
assert.equal(observed.at(-1).port, 33333);
console.log('PROVED native http.get normalizes TCP path=null; reaches counting stub');
const server = http.createServer();
server.__testAddress = {address:'127.0.0.1', family:'IPv4', port:33334};
Object.defineProperty(server, 'listening', {value:true});
const register = net[Symbol.for('tixmo.task379.registerListener')];
reject(() => http.get('http://127.0.0.1:33334/before-registration'));
const revoke = register(server);
request('http://127.0.0.1:33334/owned');
request({host:'127.0.0.1', port:33334, path:'/post'}, 'POST');
for (const url of ['http://127.0.0.1:33335/unowned', 'http://[::1]:33334/ipv6',
  'http://203.0.113.1:33334/external', 'http://localhost:33334/hostname']) {
  reject(() => http.get(url));
}
reject(() => http.get({socketPath:'/tmp/foreign.sock', path:'/unix'}));
for (const path of ['/tmp/foreign.sock', '', false, 0]) {
  reject(() => new net.Socket().connect({host:'127.0.0.1',port:33334,path}));
}
assert.throws(() => require('node:dgram').createSocket('udp4'), /UDP/);
server.emit('close');
reject(() => http.get('http://127.0.0.1:33334/after-close'));
revoke();
assert.equal(transports, 3);
console.log(`PASS native GET+POST transport stub calls=${transports}; denied targets=${denied}; UDP denied; close revokes; no network`);

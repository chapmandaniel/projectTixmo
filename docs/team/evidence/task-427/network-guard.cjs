 'use strict';
// Full-suite outer nonloopback guard plus exact owned-port pressure scope.
require('./outer-guard.cjs');
const net = require('node:net');
const { AsyncLocalStorage } = require('node:async_hooks');
const outer = net.Socket.prototype.connect;
require('../task-379/network-guard.cjs');
const owned = net.Socket.prototype.connect;
const scope = new AsyncLocalStorage();
Object.defineProperty(net, Symbol.for('tixmo.task427.ownedScope'), {
  value: work => scope.run(true, work),
});
net.Socket.prototype.connect = function (...args) {
  return (scope.getStore() ? owned : outer).apply(this, args);
};

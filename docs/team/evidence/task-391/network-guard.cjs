'use strict';
// Node traffic only: permit exact owned loopback listeners, reject other sockets.
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // Node createConnection passes its normalized [options, callback] as one arg.
  const vector = Array.isArray(args[0]) ? args[0] : net._normalizeArgs(args);
  const [options] = vector;
  const allowed = (process.env.TASK379_ALLOWED_PORTS || '').split(',');
  if (options.path !== undefined || options.host !== '127.0.0.1' || !allowed.includes(String(options.port))) {
    throw new Error('Task379 network guard rejected non-owned TCP target');
  }
  return connect.apply(this, args);
};
const dgram = require('node:dgram');
dgram.createSocket = () => { throw new Error('Task379 forbids UDP'); };

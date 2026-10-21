'use strict';
// Node traffic only: permit exact owned loopback listeners, reject other sockets.
const net = require('node:net');
const connect = net.Socket.prototype.connect;
// Built-in modules cross Jest's process/global boundary. Register the actual
// listening HTTP Server in this native closure, never a copied process.env.
const httpPorts = new Set();
const addressOf = net.Server.prototype.address;
Object.defineProperty(net, Symbol.for('tixmo.task379.registerListener'), {
  value(server) {
    if (!(server instanceof require('node:http').Server)) throw new Error('Require owned HTTP server');
    if (!server.listening) throw new Error('Require listening HTTP server');
    const address = addressOf.call(server);
    if (!address || address.address !== '127.0.0.1' || address.family !== 'IPv4' ||
        !Number.isInteger(address.port) || address.port < 1 || address.port > 65535) {
      throw new Error('Require exact owned IPv4 loopback listener');
    }
    if (httpPorts.has(address.port)) throw new Error('Listener already registered');
    httpPorts.add(address.port);
    const revoke = () => httpPorts.delete(address.port);
    server.once('close', revoke);
    return revoke;
  },
});
net.Socket.prototype.connect = function (...args) {
  // Node createConnection passes its normalized [options, callback] as one arg.
  const vector = Array.isArray(args[0]) ? args[0] : net._normalizeArgs(args);
  const [options] = vector;
  const allowed = (process.env.TASK379_ALLOWED_PORTS || '').split(',');
  // Native HTTP Agent uses null for TCP; any other present path is Unix.
  if ((options.path !== undefined && options.path !== null) || options.host !== '127.0.0.1' || (!allowed.includes(String(options.port)) && !httpPorts.has(Number(options.port)))) {
    throw new Error('Task379 network guard rejected non-owned TCP target');
  }
  return connect.apply(this, args);
};
const dgram = require('node:dgram');
dgram.createSocket = () => { throw new Error('Task379 forbids UDP'); };

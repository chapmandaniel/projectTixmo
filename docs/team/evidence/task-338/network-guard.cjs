// Task334-owned diagnostics only. Preload before imports in a scrubbed future runtime.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
function hostname(value) {
  const text = String(value || 'localhost').toLowerCase();
  try { return new URL(text.includes('://') ? text : 'http://' + text).hostname; }
  catch { return '<invalid-host>'; }
}
function permitted(value) { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(value || 'localhost').toLowerCase()); }
function frames(stack) {
  return String(stack).split('\n').slice(1).map(line => {
    const match = line.match(/(?:\(|\s)(\/[^()]+):(\d+):(\d+)\)?$/);
    if (!match || !match[1].startsWith(root + '/')) return null;
    return { file: path.relative(root, match[1]), line: Number(match[2]), column: Number(match[3]) };
  }).filter(Boolean).slice(0, 14);
}
function context() {
  // File is owned fixture metadata, never request data or arbitrary env.
  try {
    const item = JSON.parse(fs.readFileSync(path.join(__dirname, 'context-' + process.pid + '.json'), 'utf8'));
    return { testPath: String(item.testPath || '').slice(0, 200), testName: String(item.testName || '').slice(0, 240), phase: String(item.phase || '').slice(0, 40) };
  } catch { return { testPath: null, testName: null, phase: 'pre-suite-or-child' }; }
}
function record(host, kind, stack = new Error().stack) {
  return { run: 'task338-stageB', pid: process.pid, timestamp: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString(), kind, host: hostname(host), context: context(), frames: frames(stack) };
}
function deny(host, kind) {
  if (permitted(host)) return;
  fs.appendFileSync(path.join(__dirname, 'blocked-network.jsonl'), JSON.stringify(record(host, kind)) + '\n', { mode: 0o600 });
  throw new Error('TASK338_NONLOOPBACK_BLOCKED ' + kind + ' ' + hostname(host));
}
function install() {
  const net = require('node:net'), tls = require('node:tls');
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    let options = args[0]; if (Array.isArray(options)) options = options[0];
    if (options && typeof options === 'object') { if (!options.path) deny(options.host || options.hostname, 'net'); }
    else if (typeof options === 'number') deny(typeof args[1] === 'string' ? args[1] : 'localhost', 'net');
    else if (typeof options === 'string' && !options.startsWith('/')) deny(options, 'net-unknown');
    return connect.apply(this, args);
  };
  const secure = tls.connect;
  tls.connect = function (...args) { const o = args.find(a => a && typeof a === 'object') || {}; deny(o.host || o.hostname || (typeof args[1] === 'string' ? args[1] : 'localhost'), 'tls'); return secure.apply(this, args); };
  for (const protocol of ['http', 'https']) {
    const mod = require('node:' + protocol);
    for (const name of ['request', 'get']) { const original = mod[name]; mod[name] = function (...args) { const o = args[0]; deny(typeof o === 'string' || o instanceof URL ? new URL(o).hostname : o?.hostname || o?.host, protocol); return original.apply(this, args); }; }
  }
  if (global.fetch) { const original = global.fetch; global.fetch = function (input, ...args) { deny(new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname, 'fetch'); return original.call(this, input, ...args); }; }
}
module.exports = { hostname, permitted, frames, record, install };
if (process.env.TASK338_GUARD_SELFTEST !== '1') install();

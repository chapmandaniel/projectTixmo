const fs = require('node:fs');
function deny(kind) {
  fs.appendFileSync(process.env.TASK321_BLOCK_LOG, JSON.stringify({ kind, stack: new Error().stack }) + '\n');
  throw new Error('TASK321_NETWORK_FORBIDDEN ' + kind);
}
require('node:net').Socket.prototype.connect = function () { deny('net'); };
require('node:tls').connect = function () { deny('tls'); };
for (const protocol of ['http', 'https']) {
  for (const method of ['request', 'get']) require('node:' + protocol)[method] = function () { deny(protocol); };
}
global.fetch = function () { deny('fetch'); };

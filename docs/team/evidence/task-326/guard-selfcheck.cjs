// Pure policy/record checks: no connect/request/fetch invocation or services.
'use strict';
const assert = require('node:assert/strict');
const guard = require('./network-guard.cjs');
for (const host of ['localhost', '127.0.0.1', '::1', '[::1]']) assert.equal(guard.permitted(host), true);
for (const host of ['s3.us-east-1.amazonaws.com', 'api.stripe.com', '127.0.0.1.evil.test', '10.0.0.1']) assert.equal(guard.permitted(host), false);
assert.equal(guard.hostname('https://username:credential@s3.us-east-1.amazonaws.com/path?token=secret'), 's3.us-east-1.amazonaws.com');
const item = guard.record('https://u:secret@blocked.test/private?signature=secret', 'pure-policy-check');
const serialized = JSON.stringify(item);
assert(!serialized.includes('secret')); assert(!serialized.includes('signature')); assert(!serialized.includes('username'));
assert(item.timestamp && item.monotonicNs && item.pid && Array.isArray(item.frames));
assert.deepEqual(Object.keys(item).sort(), ['run','pid','timestamp','monotonicNs','kind','host','context','frames'].sort());
console.log('PASS pure guard policy + sanitized record checks; no network API invoked');

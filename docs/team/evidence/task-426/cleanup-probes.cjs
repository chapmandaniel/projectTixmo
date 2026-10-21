'use strict';
const assert = require('node:assert/strict');
const { cleanupSteps } = require('./cleanup.cjs');
(async () => {
  const calls = [];
  const results = await cleanupSteps([
    ['ENOSPC', () => { throw new Error('ENOSPC'); }],
    ['hang', () => new Promise(() => {})],
    ['drain', () => calls.push('drain')],
    ['disconnect', () => calls.push('disconnect')],
  ], 15);
  assert.deepEqual(calls, ['drain', 'disconnect']);
  assert.deepEqual(results.map(r => r.ok), [false, false, true, true]);
  const source = require('node:fs').readFileSync('tixmoapi2/tests/qualification/orders-http-abort.local.ts', 'utf8');
  assert(source.indexOf('await finalize') < source.indexOf('fs.writeFileSync'));
  assert(source.indexOf('await Promise.race([terminal.promise') < source.indexOf('      gate.resolve();'));
  assert(source.indexOf('redis = await connectRedis()') > source.indexOf('  try {'));
  console.log('PASS ENOSPC and hanging cleanup do not skip later cleanup; artifact after cleanup; server ACK before gate release; initialization owned by try. No sockets/services.');
})();

'use strict';
// Inert extraction of the actual reviewed spy callback. No HTTP/app/Jest imports.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { checkoutOwnership } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
const source = fs.readFileSync('tixmoapi2/tests/qualification/orders-http-last-ten.local.ts', 'utf8');
const match = source.match(/mockImplementation\(\(\.\.\.args: any\[\]\) => work\.run\(\(\) => original\(\.\.\.args\)\)\)/);
assert(match, 'actual detached Redis spy callback found');
// Exact callback body; remove only its TypeScript parameter annotation.
const callback = match[0].slice('mockImplementation('.length, -1).replace(': any[]', '');
(async () => {
  for (const name of ['zRem','eval','sendCommand']) {
    const work = checkoutOwnership({event:'lead505-owned'}, 20);
    const original = () => Promise.reject(Error(name+' raw operation failed'));
    const wrapped = Function('work','original','return '+callback)(work, original);
    // Actual waitingRoom release/renewal catches these failures and logs them.
    await wrapped('synthetic').catch(() => {});
    let cleanup=0, disconnect=0;
    await work.teardown([() => {cleanup++;},() => {disconnect++;}]);
    assert.equal(work.preserved,false);
    assert.deepEqual([cleanup,disconnect],[1,1]);
    console.log('REPRODUCED unsafe '+name+' rejection: no preservation; teardown/disconnect run');
  }
})().catch(error => {console.error(error);process.exitCode=1;});

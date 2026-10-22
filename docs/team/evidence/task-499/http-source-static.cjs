'use strict';
// Inert source contract checks only. Never evaluate/import HTTP test or product.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('tixmoapi2/tests/qualification/orders-http-last-ten.local.ts', 'utf8');
assert(source.indexOf('await guard(__filename)') < source.indexOf("require('../../src/config/redis')"));
assert(source.indexOf('redis = await work.critical') < source.indexOf("import('../../src/app')"));
assert(source.indexOf("jest.spyOn(limiter, name)") < source.indexOf("import('../../src/app')"));
assert(source.includes("server.listen(0, '127.0.0.1'"));
assert(source.includes('work.run(() => new Promise<void>((resolve, reject) => server.close('));
assert(source.indexOf('admitting = false; work.stop()') < source.indexOf('await work.teardown(['));
assert(source.includes('expect(maxInFlight).toBe(100)'));
assert(source.includes("r.response.status === 400 && r.response.body.message === 'Not enough tickets available'"));
assert(source.includes('expect(successes).toHaveLength(10); expect(soldOut).toHaveLength(90)'));
assert(source.includes('quantityAvailable: 0, quantityHeld: 10, quantitySold: 0'));
assert(source.includes('quantityAvailable: 10, quantityHeld: 0, quantitySold: 0'));
assert.equal((source.match(/expect\(await foreignSnapshot\(\)\).toEqual\(foreignBefore\)/g) || []).length, 2);
console.log('PASS 12 inert source contract assertions (not syntax/type/runtime acceptance)');

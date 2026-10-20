import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('legacy deployment db:seed is a no-op without loading database or credential code', () => {
  const output = [];
  const source = fs.readFileSync(new URL('../tixmoapi2/prisma/seed-minimal.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    console: { log: (message) => output.push(message) },
    require: () => { throw new Error('Automatic bootstrap must never load database modules'); },
  });
  assert.equal(output.length, 1);
  assert.match(output[0], /Automatic account seeding is disabled/);
});

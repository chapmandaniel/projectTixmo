const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const apiRequire = createRequire(path.resolve(__dirname, '../tixmoapi2/package.json'));
const { createClient } = apiRequire('redis');
const { ACQUIRE_REQUEST_LEASE } = require('../tixmoapi2/dist/middleware/waitingRoom.js');

test('real Redis atomically limits two clients and expires abandoned requests', async () => {
  const url = process.env.TIXMO_TEST_REDIS_URL;
  assert.equal(process.env.NODE_ENV, 'test'); assert.ok(url, 'An explicit disposable Redis URL is required');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
  const clients = [createClient({ url, disableOfflineQueue: true }), createClient({ url, disableOfflineQueue: true })];
  const key = 'tixmo-test:request-leases:' + randomUUID();
  try {
    await Promise.all(clients.map(client => client.connect()));
    const acquire = (client, token, ttl = '120000') => client.eval(ACQUIRE_REQUEST_LEASE,
      { keys: [key], arguments: [token, '2', ttl] });
    const admitted = await Promise.all(Array.from({ length: 20 }, (_, i) => acquire(clients[i % 2], 'request-' + i)));
    assert.equal(admitted.filter(value => value === 1).length, 2);
    assert.equal(await clients[0].zCard(key), 2);
    const [token] = await clients[0].zRange(key, 0, 0);
    assert.equal(await acquire(clients[1], token), 1, 'Same request identity is idempotent at capacity');
    await clients[0].del(key);
    assert.equal(await acquire(clients[0], 'abandoned', '1'), 1);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(await acquire(clients[1], 'replacement'), 1);
    assert.deepEqual(await clients[0].zRange(key, 0, -1), ['replacement']);
    assert.equal(await clients[0].zRem(key, 'replacement'), 1);
    assert.equal(await clients[1].zRem(key, 'replacement'), 0, 'Duplicate release cannot reduce another request');
  } finally {
    if (clients[0].isReady) await clients[0].del(key);
    await Promise.all(clients.filter(client => client.isOpen).map(client => client.quit()));
  }
});

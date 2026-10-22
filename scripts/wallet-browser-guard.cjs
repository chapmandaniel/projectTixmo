// Pure admission only: no imports of app/config, filesystem, browser or network.
const assert = require('node:assert/strict');
const { validateVerificationTargets } = require('./verification-safety.cjs');
function validateWalletBrowser(env) {
  validateVerificationTargets(env);
  const api = new URL(env.TIXMO_WALLET_API);
  assert.equal(api.protocol, 'http:'); assert.equal(api.hostname, '127.0.0.1');
  assert.ok(Number(api.port) > 1024 && Number(api.port) <= 65535);
  assert.equal(api.pathname, '/'); assert.equal(api.search, ''); assert.equal(api.hash, '');
  assert.equal(api.username, ''); assert.equal(api.password, '');
  const frontendPort = Number(env.TIXMO_WALLET_PORT);
  assert.ok(Number.isInteger(frontendPort) && frontendPort > 1024 && frontendPort <= 65535);
  assert.notEqual(frontendPort, Number(api.port));
  assert.ok(typeof env.TIXMO_WALLET_FIXTURE === 'string' && env.TIXMO_WALLET_FIXTURE.length <= 4096);
  const fixture = JSON.parse(env.TIXMO_WALLET_FIXTURE);
  for (const name of ['a', 'b']) assert.match(fixture[name], /^[a-z0-9-]+@synthetic\.test$/);
  assert.notEqual(fixture.a, fixture.b);
  for (const name of ['orderId', 'ticketId']) assert.match(fixture[name], /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  assert.match(fixture.slug, /^wallet-[a-f0-9-]{36}$/);
  assert.match(fixture.orderNumber, /^WALLET-[a-f0-9-]{36}$/);
  assert.equal(fixture.password, 'Synthetic-Wallet-Only!');
  assert.match(env.TIXMO_BROWSER_PATH || '', /^\/[a-zA-Z0-9_./-]+$/);
  return { api, frontendPort, fixture };
}
module.exports = { validateWalletBrowser };

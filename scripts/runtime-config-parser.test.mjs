import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRuntimeConfig } from './runtime-config-parser.mjs';

test('accepts generated wrappers, static assignments, and escaped string data', () => {
  assert.deepEqual(parseRuntimeConfig('window.__TIXMO_CONFIG__ = window.__TIXMO_CONFIG__ || {};'), {});
  assert.deepEqual(parseRuntimeConfig('window.__TIXMO_CONFIG__ = Object.assign({}, window.__TIXMO_CONFIG__, {apiUrl:"/api/v1",paymentCurrency:"cad"});'), { apiUrl: '/api/v1', paymentCurrency: 'cad' });
  assert.deepEqual(parseRuntimeConfig("window.__TIXMO_CONFIG__ = {'apiUrl':'\\u002fapi\\/v1',paymentCurrency:'cad',};"), { apiUrl: '/api/v1', paymentCurrency: 'cad' });
  assert.equal(parseRuntimeConfig('window.__TIXMO_CONFIG__={apiUrl:"window.constructor.constructor(\\\"return process.version\\\")()"};').apiUrl,
    'window.constructor.constructor("return process.version")()');
});

test('rejects host access and executable syntax throughout the complete input', () => {
  for (const source of [
    "window.__TIXMO_CONFIG__=window.constructor.constructor('return process.version')();",
    'window.__TIXMO_CONFIG__={}; process.exit(0);',
    'window.__TIXMO_CONFIG__={get apiUrl(){return process.version}};',
    'window.__TIXMO_CONFIG__={apiUrl:process.version};',
    'window.__TIXMO_CONFIG__={...process.env};',
    'window.__TIXMO_CONFIG__={[process.version]:"x"};',
    'window.__TIXMO_CONFIG__={apiUrl:(()=>"x")()};',
    'window.__TIXMO_CONFIG__={apiUrl:"x",apiUrl:"y"};',
    'window.__TIXMO_CONFIG__={__proto__:"x"};',
    'window.__TIXMO_CONFIG__={constructor:"x"};',
    'window.__TIXMO_CONFIG__={apiUrl:"unterminated};',
    'window.__TIXMO_CONFIG__={apiUrl:"\\uXX00"};',
    'window.__TIXMO_CONFIG__={apiUrl:"line\nbreak"};',
    'window.__TIXMO_CONFIG__=Object.assign({}, window.__TIXMO_CONFIG__, {apiUrl:"x"}, process.env);',
  ]) assert.throws(() => parseRuntimeConfig(source), /Unsupported runtime configuration/);
});

test('CLI records passing data and rejects fetched executable responses', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'tixmo-runtime-config-'));
  let source = '', origin = '';
  const server = createServer((req, res) => {
    if (req.url === '/runtime-config.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(source); }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data: { stripeConfigured: true, currency: 'cad' } })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const evidencePath = path.join(temp, 'evidence.json');
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./check-checkout-runtime-config.mjs', import.meta.url))], {
      env: { ...process.env, TIXMO_DASHBOARD_URL: origin, TIXMO_EXPECTED_API_URL: origin + '/api/v1',
        TIXMO_CHECKOUT_CONFIG_EVIDENCE_PATH: evidencePath, TIXMO_EXPECTED_PAYMENT_CURRENCY: 'cad',
        TIXMO_REQUIRE_POLICY_URLS: 'false', TIXMO_REQUIRE_STRIPE_PUBLISHABLE_KEY: 'false' }, stdio: 'pipe',
    });
    let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
    child.on('error', reject); child.on('exit', code => resolve({ code, output }));
  });
  try {
    source = `window.__TIXMO_CONFIG__={apiUrl:${JSON.stringify(origin + '/api/v1')},paymentCurrency:"cad"};`;
    assert.equal((await run()).code, 0);
    assert.equal(JSON.parse(await readFile(evidencePath, 'utf8')).result, 'pass');
    source = "window.__TIXMO_CONFIG__=window.constructor.constructor('return process.version')();";
    const invalid = await run(); assert.notEqual(invalid.code, 0);
    assert.equal(JSON.parse(await readFile(evidencePath, 'utf8')).result, 'fail');
    assert.doesNotMatch(invalid.output, /v\d+\.\d+\.\d+/);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true, force: true }); }
});

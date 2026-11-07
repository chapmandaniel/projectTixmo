'use strict';

// Standalone check for the exact-origin policy. Jest loads the API and is the
// suite that enforces it. This script does not grant https://*.tixmo.co.
// A missing Origin header is not an allowed browser origin. The API still
// serves that request and does not emit Access-Control-Allow-Origin.

const allowed = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://demo.tixmo.co',
  'https://dash-production-7487.up.railway.app',
  'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app',
  'https://labs.tixmo.co',
  'https://labs-dash-labs.up.railway.app',
]);

function canonical(origin) {
  if (origin.includes('*')) return undefined;
  const url = new URL(origin);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  return url.origin;
}

function isBrowserOriginAllowed(origin) {
  if (origin === undefined || origin === null || origin === '' || origin === 'null') return false;
  let parsed;
  try {
    parsed = canonical(origin);
  } catch {
    return false;
  }
  if (!parsed) return false;
  return allowed.has(parsed);
}

let failed = 0;

function runTest(origin, expectedResult, description) {
  const result = isBrowserOriginAllowed(origin);
  const shown = origin === undefined ? '<no header>' : origin;
  if (result === expectedResult) {
    console.log(`PASS: ${description} (Origin: ${shown}) -> Got: ${result}`);
    return;
  }
  console.error(
    `FAIL: ${description} (Origin: ${shown}) -> Expected: ${expectedResult}, Got: ${result}`
  );
  failed += 1;
}

console.log('--- Verify CORS exact allowlist ---');

runTest(undefined, false, 'Missing Origin is not browser CORS permission');
runTest('null', false, 'Literal null origin');
runTest('', false, 'Empty Origin');
runTest('http://localhost:5173', true, 'Explicitly allowed dev origin');
runTest('http://127.0.0.1:5173', true, 'Explicitly allowed loopback dev origin');
runTest('http://localhost:5174', false, 'Wrong dev port');
runTest('https://localhost:5173', false, 'Wrong dev scheme');
runTest('https://demo.tixmo.co', true, 'Explicitly allowed production dashboard');
runTest('https://dash-production-7487.up.railway.app', true, 'Production dashboard service domain');
runTest(
  'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app',
  true,
  'Staging dashboard'
);
runTest('https://labs.tixmo.co', true, 'Labs dashboard');
runTest('https://labs-dash-labs.up.railway.app', true, 'Labs dashboard service domain');
runTest('https://api-production-fbaf.up.railway.app', false, 'Production API host is not a frontend origin');
runTest('https://labs-api.tixmo.co', false, 'Labs API host is not a frontend origin');
runTest('https://Demo.tixmo.co/', true, 'Canonical trailing slash and case');
runTest('https://demo.tixmo.co:443', true, 'Canonical default https port');
runTest('https://demo.tixmo.co:444', false, 'Wrong https port');
runTest('https://demo.tixmo.co/login', false, 'Path is not an origin');
runTest('https://sub.demo.tixmo.co', false, 'Nested Tixmo subdomain');
runTest('https://notdemo.tixmo.co', false, 'Suffix lookalike');
runTest('https://evil.up.railway.app', false, 'Arbitrary Railway app');
runTest('https://frontend-dash-production.up.railway.app', false, 'Unverified production alias');
runTest('https://evil.com', false, 'External domain');
runTest('https://evil-tixmo.co', false, 'Lookalike suffix');
runTest('https://tixmo.co.evil.com', false, 'Lookalike parent');
runTest('http://demo.tixmo.co', false, 'HTTP form of an allowed HTTPS origin');
runTest('https://evil.com.tixmo.co', false, 'Unlisted subdomain');
runTest('https://*.tixmo.co', false, 'Wildcard entry');

if (failed > 0) {
  process.exitCode = 1;
}

console.log('--- End of Test ---');

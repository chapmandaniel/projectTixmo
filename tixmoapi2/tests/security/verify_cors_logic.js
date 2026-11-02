'use strict';

// Standalone check for the exact-origin policy. Jest is the suite that loads
// the API. This script does not grant https://*.tixmo.co.

const allowed = new Set(['http://localhost:5173', 'https://demo.tixmo.co']);

function canonical(origin) {
  if (origin.includes('*')) return undefined;
  const url = new URL(origin);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined;
  return url.origin;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
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
  const result = isOriginAllowed(origin);
  if (result === expectedResult) {
    console.log(`PASS: ${description} (Origin: ${origin}) -> Got: ${result}`);
    return;
  }
  console.error(
    `FAIL: ${description} (Origin: ${origin}) -> Expected: ${expectedResult}, Got: ${result}`
  );
  failed += 1;
}

console.log('--- Verify CORS exact allowlist ---');

runTest('http://localhost:5173', true, 'Explicitly allowed dev origin');
runTest('https://demo.tixmo.co', true, 'Explicitly allowed production dashboard');
runTest('https://Demo.tixmo.co/', true, 'Canonical trailing slash and case');
runTest('https://demo.tixmo.co:443', true, 'Canonical default https port');
runTest('https://demo.tixmo.co/login', false, 'Path is not an origin');
runTest('https://labs.tixmo.co', false, 'Labs host is not implied by the parent domain');
runTest('https://sub.demo.tixmo.co', false, 'Nested Tixmo subdomain');
runTest('https://evil.up.railway.app', false, 'Arbitrary Railway app');
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

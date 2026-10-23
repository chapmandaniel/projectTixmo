// Read-only qualification of the four approved test policy placeholders.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseRuntimeConfig } from './runtime-config-parser.mjs';
const origin = 'https://mightyquinton.tixmo.co';
const entries = [['privacyPolicyUrl','privacy.html'],['termsUrl','terms.html'],['refundPolicyUrl','refunds.html'],['organizerTermsUrl','organizer-terms.html']];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function get(path) {
  const response = await fetch(origin + '/' + path, {method:'GET', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(15000)});
  if (response.status !== 200) throw new Error('unexpected_status');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try { while (true) { const {value, done} = await reader.read(); if (done) break; size += value.length; if (size > 131072) throw new Error('body_limit'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
try {
  const config = parseRuntimeConfig((await get('runtime-config.js')).toString('utf8'));
  const pages = [];
  for (const [field, file] of entries) {
    const bytes = await get(file);
    pages.push({file, status:200, sourceMatches: hash(bytes) === hash(readFileSync(new URL('../tdash/public/' + file, import.meta.url))), configuredUrlMatches: config[field] === origin + '/' + file});
  }
  const ok = pages.every(page => page.sourceMatches && page.configuredUrlMatches);
  console.log(JSON.stringify({scope:'public_test_policy_placeholders_only',observedAt:new Date().toISOString(),ok,pages}));
  if (!ok) process.exitCode = 1;
} catch { console.log(JSON.stringify({scope:'public_test_policy_placeholders_only',ok:false,error:'request_or_validation_failed'})); process.exitCode = 1; }

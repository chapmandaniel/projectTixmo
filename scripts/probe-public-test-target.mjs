// Observation only: no customer, payment, email, or authenticated requests.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeConfig } from './runtime-config-parser.mjs';

const api = 'https://backend-api-production-cbfa.up.railway.app';
const dashboard = 'https://mightyquinton.tixmo.co';
const limit = 131072;
const digest = body => createHash('sha256').update(body).digest('hex');
const expectedBootstrap = digest(readFileSync(new URL('../tdash/public/buyer-reset-intent.js', import.meta.url)));
const resetPage = (body, headers) => {
  const scripts = [...body.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
  const first = scripts[0] || '';
  const moduleIndex = scripts.findIndex(tag => /\btype=["']module["']/i.test(tag));
  const scriptPolicy = (headers.get('content-security-policy') || '').split(';').map(part => part.trim()).find(part => /^script-src\s/.test(part)) || '';
  return { bootstrapFirst: /\bsrc=["']\/buyer-reset-intent\.js["']/.test(first) &&
    !/\b(?:async|defer)\b|\btype=/i.test(first) && moduleIndex > 0,
    scriptCsp: /(?:^|\s)'self'(?:\s|$)/.test(scriptPolicy) && !scriptPolicy.includes("'unsafe-inline'") };
};

async function get(url, parse) {
  let status = null;
  try {
    const response = await fetch(url, {
      method: 'GET', credentials: 'omit', redirect: 'error',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json, text/plain, text/html' },
    });
    status = response.status;
    const reader = response.body?.getReader();
    if (!reader) return { status, error: 'missing_body' };
    let length = 0;
    const chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) return { status, error: 'body_limit' };
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const body = Buffer.concat(chunks).toString('utf8');
    return { status, data: parse(body, response.headers) };
  } catch { return { status, error: 'request_or_parse_failed' }; }
}

const [health, ready, page, runtime, recovery, bootstrap] = await Promise.all([
  get(`${api}/health`, body => JSON.parse(body)),
  get(`${api}/ready`, body => JSON.parse(body)),
  get(`${dashboard}/`, body => /<html[\s>]/i.test(body)),
  get(`${dashboard}/runtime-config.js`, parseRuntimeConfig),
  get(`${dashboard}/reset-password`, resetPage),
  get(`${dashboard}/buyer-reset-intent.js`, body => digest(body) === expectedBootstrap),
]);
const config = runtime.data || {};
const present = value => typeof value === 'string' && value.trim().length > 0;
const receipt = {
  observedAt: new Date().toISOString(),
  scope: 'public_test_target_observation',
  health: { status: health.status, ok: health.data?.status === 'ok', error: health.error },
  readiness: { status: ready.status, database: ready.data?.checks?.database === true,
    redis: ready.data?.checks?.redis === true, ready: ready.data?.status === 'ready', error: ready.error },
  dashboard: { status: page.status, html: page.data === true, error: page.error },
  recovery: { status: recovery.status, bootstrapFirst: recovery.data?.bootstrapFirst === true,
    scriptCsp: recovery.data?.scriptCsp === true, error: recovery.error,
    bootstrapStatus: bootstrap.status, bootstrapMatches: bootstrap.data === true, bootstrapError: bootstrap.error },
  runtime: { status: runtime.status, parsed: Boolean(runtime.data), error: runtime.error,
    apiMatches: config.apiUrl === `${api}/api/v1`,
    currency: /^[a-z]{3}$/i.test(config.paymentCurrency || '') ? config.paymentCurrency.toUpperCase() : null,
    testKeyPresent: /^pk_test_/.test(config.stripePublishableKey || ''),
    liveKeyPresent: /^pk_live_/.test(config.stripePublishableKey || ''),
    privacyPresent: present(config.privacyPolicyUrl), termsPresent: present(config.termsUrl),
    refundPresent: present(config.refundPolicyUrl), organizerTermsPresent: present(config.organizerTermsUrl) },
};
// Never print response bodies, remote errors, URL values, or key fragments.
console.log(JSON.stringify(receipt, null, 2));
if (!(receipt.health.status === 200 && receipt.health.ok && receipt.readiness.status === 200 &&
  receipt.readiness.ready && receipt.readiness.database && receipt.readiness.redis &&
  receipt.dashboard.status === 200 && receipt.dashboard.html && receipt.runtime.status === 200 &&
  receipt.runtime.parsed && receipt.runtime.apiMatches && receipt.recovery.status === 200 &&
  receipt.recovery.bootstrapFirst && receipt.recovery.scriptCsp && receipt.recovery.bootstrapStatus === 200 &&
  receipt.recovery.bootstrapMatches)) process.exitCode = 1;
// Currency, key mode, and policy presence are observations, not business approval.

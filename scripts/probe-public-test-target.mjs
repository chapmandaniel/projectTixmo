// Observation only: no customer, payment, email, or authenticated requests.
import { parseRuntimeConfig } from './runtime-config-parser.mjs';

const api = 'https://backend-api-production-cbfa.up.railway.app';
const dashboard = 'https://mightyquinton.tixmo.co';
const limit = 131072;

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
    return { status, data: parse(body) };
  } catch { return { status, error: 'request_or_parse_failed' }; }
}

const [health, ready, page, runtime] = await Promise.all([
  get(`${api}/health`, JSON.parse),
  get(`${api}/ready`, JSON.parse),
  get(`${dashboard}/`, body => /<html[\s>]/i.test(body)),
  get(`${dashboard}/runtime-config.js`, parseRuntimeConfig),
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
  receipt.runtime.parsed && receipt.runtime.apiMatches)) process.exitCode = 1;
// Currency, key mode, and policy presence are observations, not business approval.

'use strict';
// Runtime-only, read-only provider observation. No app/env-loader/database imports.
const SCOPE = 'stripe-test-v1-webhook-endpoints-only';
const GUARD_REASONS = new Set([
  'node-env',
  'opt-in',
  'test-key-format',
  'expected-url-missing',
  'expected-url-shape',
  'expected-url-parse',
  'expected-url-canonical',
]);
class GuardRejected extends Error {
  #reason;
  constructor(reason) {
    super('Rejected');
    this.#reason = GUARD_REASONS.has(reason) ? reason : 'unclassified';
  }
  get reason() {
    return this.#reason;
  }
}
function guard(env) {
  if (env.NODE_ENV !== 'production') throw new GuardRejected('node-env');
  if (env.TIXMO_STRIPE_READ_PROBE !== 'true') throw new GuardRejected('opt-in');
  if (
    typeof env.STRIPE_SECRET_KEY !== 'string' ||
    env.STRIPE_SECRET_KEY.trim() !== env.STRIPE_SECRET_KEY ||
    !/^sk_test_[A-Za-z0-9]{12,240}$/.test(env.STRIPE_SECRET_KEY)
  )
    throw new GuardRejected('test-key-format');
  const value = env.TIXMO_STRIPE_EXPECTED_WEBHOOK_URL;
  if (value === undefined || value === null || value === '')
    throw new GuardRejected('expected-url-missing');
  if (typeof value !== 'string' || value.length > 512)
    throw new GuardRejected('expected-url-shape');
  let expected;
  try {
    expected = new URL(value);
  } catch {
    throw new GuardRejected('expected-url-parse');
  }
  if (
    expected.protocol !== 'https:' ||
    expected.username ||
    expected.password ||
    expected.port ||
    expected.search ||
    expected.hash ||
    expected.pathname !== '/api/v1/payments/webhook' ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(expected.hostname) ||
    expected.hostname.endsWith('.localhost') ||
    expected.hostname === 'localhost' ||
    /^[0-9.]+$/.test(expected.hostname)
  )
    throw new GuardRejected('expected-url-shape');
  if (expected.href !== value) throw new GuardRejected('expected-url-canonical');
  return { key: env.STRIPE_SECRET_KEY, expected: expected.href };
}
function summarize(list, expected) {
  if (
    list?.object !== 'list' ||
    list.has_more !== false ||
    !Array.isArray(list.data) ||
    list.data.length > 100
  )
    throw new Error('Rejected');
  let enabled = 0;
  let expectedEnabled = 0;
  let expectedPaymentSucceeded = 0;
  let expectedPaymentFailed = 0;
  let expectedRefundEvents = 0;
  for (const entry of list.data) {
    if (
      entry?.object !== 'webhook_endpoint' ||
      entry.livemode !== false ||
      !['enabled', 'disabled'].includes(entry.status) ||
      typeof entry.url !== 'string' ||
      entry.url.length > 4096 ||
      !Array.isArray(entry.enabled_events) ||
      entry.enabled_events.length > 500 ||
      entry.enabled_events.some(
        (value) =>
          typeof value !== 'string' ||
          value.length > 128 ||
          !/^(\*|[a-z0-9_]+(?:\.[a-z0-9_]+)+)$/.test(value)
      )
    )
      throw new Error('Rejected');
    const url = new URL(entry.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Rejected');
    if (entry.status !== 'enabled') continue;
    enabled++;
    if (url.href !== expected) continue;
    expectedEnabled++;
    const events = entry.enabled_events;
    if (events.includes('*') || events.includes('payment_intent.succeeded'))
      expectedPaymentSucceeded++;
    if (events.includes('*') || events.includes('payment_intent.payment_failed'))
      expectedPaymentFailed++;
    if (
      events.includes('*') ||
      events.includes('charge.refunded') ||
      events.some((value) => value.startsWith('refund.'))
    )
      expectedRefundEvents++;
  }
  return {
    total: list.data.length,
    enabled,
    expectedEnabled,
    expectedPaymentSucceeded,
    expectedPaymentFailed,
    expectedRefundEvents,
  };
}
async function observe(env, loadStripe = () => require('stripe')) {
  let phase = 'guard';
  try {
    const plan = guard(env);
    phase = 'sdk';
    const Stripe = loadStripe();
    const stripe = new Stripe(plan.key, {
      host: 'api.stripe.com',
      protocol: 'https',
      port: 443,
      timeout: 8000,
      maxNetworkRetries: 0,
      telemetry: false,
    });
    phase = 'balance';
    const balance = await stripe.balance.retrieve();
    if (balance?.object !== 'balance' || balance.livemode !== false) throw new Error('Rejected');
    // Discard amounts, account identifiers and response headers. Do not serialize SDK objects.
    phase = 'webhooks';
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    phase = 'inventory';
    const counts = summarize(endpoints, plan.expected);
    return {
      ok: true,
      scope: SCOPE,
      testMode: true,
      ...counts,
      v2DestinationsInspected: false,
      writeIsolationProved: false,
    };
  } catch (error) {
    return {
      ok: false,
      scope: SCOPE,
      phase,
      writeIsolationProved: false,
      ...(phase === 'guard'
        ? {
            guardReason:
              error instanceof GuardRejected && GUARD_REASONS.has(error.reason)
                ? error.reason
                : 'unclassified',
          }
        : {}),
    };
  }
}
async function main(args = process.argv.slice(2), env = process.env, loadStripe) {
  let expired = false;
  const deadline = setTimeout(() => {
    expired = true;
    console.log(
      JSON.stringify({ ok: false, scope: SCOPE, phase: 'deadline', writeIsolationProved: false })
    );
    process.exit(1); // End this owned read-only CLI, including an unresponsive socket.
  }, 20000);
  try {
    const result =
      args.length === 0
        ? await observe(env, loadStripe)
        : {
            ok: false,
            scope: SCOPE,
            phase: 'guard',
            writeIsolationProved: false,
            guardReason: 'arguments',
          };
    if (expired) return;
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
if (require.main === module) void main();
module.exports = { guard, summarize, observe, main };

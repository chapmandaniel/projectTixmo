import fs from 'fs';
import path from 'path';
const { guard, summarize, observe, main } = require('../../scripts/stripe-read-probe.cjs');
const expected = 'https://synthetic-api.invalid/api/v1/payments/webhook';
const env = {
  NODE_ENV: 'production',
  TIXMO_STRIPE_READ_PROBE: 'true',
  STRIPE_SECRET_KEY: ['sk', 'test', 'SyntheticSecretCanary123456'].join('_'),
  TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected,
};
const endpoint = (values = {}) => ({
  object: 'webhook_endpoint',
  id: 'we_sensitive_canary',
  livemode: false,
  status: 'enabled',
  url: expected,
  enabled_events: ['*'],
  ...values,
});
const list = (data: any[] = [], values = {}) => ({
  object: 'list',
  has_more: false,
  data,
  ...values,
});
function sdk(balance: any = { object: 'balance', livemode: false }, endpoints: any = list()) {
  const calls: string[] = [];
  const retrieve = jest.fn(() => {
    calls.push('balance');
    return Promise.resolve(balance);
  });
  const enumerate = jest.fn(() => {
    calls.push('endpoints');
    return Promise.resolve(endpoints);
  });
  const load = jest.fn(() =>
    jest
      .fn()
      .mockImplementation(() => ({ balance: { retrieve }, webhookEndpoints: { list: enumerate } }))
  );
  return { calls, retrieve, enumerate, load };
}
it('performs exactly two sequential read calls with fixed host, timeout, zero retries and no telemetry', async () => {
  const fixture = sdk(
    {
      object: 'balance',
      livemode: false,
      available: [{ amount: 987654321 }],
      secret: 'balance-canary',
    },
    list([
      endpoint(),
      endpoint({ status: 'disabled' }),
      endpoint({ url: 'https://other.invalid/events', enabled_events: ['refund.created'] }),
    ])
  );
  const output = await observe(
    { ...env, STRIPE_API_BASE: 'http://canary.invalid', STRIPE_HOST: 'canary.invalid' },
    fixture.load
  );
  expect(fixture.calls).toEqual(['balance', 'endpoints']);
  expect(fixture.retrieve).toHaveBeenCalledTimes(1);
  expect(fixture.retrieve).toHaveBeenCalledWith();
  expect(fixture.enumerate).toHaveBeenCalledTimes(1);
  expect(fixture.enumerate).toHaveBeenCalledWith({ limit: 100 });
  expect(fixture.load.mock.results[0].value).toHaveBeenCalledWith(env.STRIPE_SECRET_KEY, {
    host: 'api.stripe.com',
    protocol: 'https',
    port: 443,
    timeout: 8000,
    maxNetworkRetries: 0,
    telemetry: false,
  });
  expect(output).toEqual({
    ok: true,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    testMode: true,
    total: 3,
    enabled: 2,
    expectedEnabled: 1,
    expectedPaymentSucceeded: 1,
    expectedPaymentFailed: 1,
    expectedRefundEvents: 1,
    v2DestinationsInspected: false,
    writeIsolationProved: false,
  });
  expect(JSON.stringify(output)).not.toMatch(/987654321|canary|https:|sk_test|we_sensitive/);
});
it('does not start the inventory call until the balance GET and test-mode check finish', async () => {
  let finish!: (value: any) => void;
  const fixture = sdk();
  fixture.retrieve.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const work = observe(env, fixture.load);
  expect(fixture.enumerate).not.toHaveBeenCalled();
  finish({ object: 'balance', livemode: false });
  await work;
  expect(fixture.enumerate).toHaveBeenCalledTimes(1);
});
it.each([
  { NODE_ENV: 'test' },
  { TIXMO_STRIPE_READ_PROBE: '' },
  { TIXMO_STRIPE_READ_PROBE: 'TRUE' },
  { STRIPE_SECRET_KEY: '' },
  { STRIPE_SECRET_KEY: ['sk', 'live', 'SyntheticSecretCanary123456'].join('_') },
  { STRIPE_SECRET_KEY: ['rk', 'test', 'SyntheticSecretCanary123456'].join('_') },
  { STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY + '\n' },
  { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: '' },
  { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: 'http://synthetic-api.invalid/api/v1/payments/webhook' },
  ...['?secret=canary', '#secret', '/', '/extra'].map((suffix) => ({
    TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected + suffix,
  })),
  {
    TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace(
      'synthetic-api.invalid',
      'canary@synthetic-api.invalid'
    ),
  },
  { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace('synthetic-api.invalid', '127.0.0.1') },
])('rejects missing, live, ambiguous or malformed guards before SDK loading', async (mutation) => {
  const load = jest.fn(() => {
    throw new Error('must-not-load');
  });
  expect(await observe({ ...env, ...mutation }, load)).toEqual({
    ok: false,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    phase: 'guard',
    writeIsolationProved: false,
  });
  expect(load).not.toHaveBeenCalled();
});
it.each([undefined, {}, { object: 'balance', livemode: true }, { object: 'balance' }])(
  'rejects unproved test-mode balance before endpoint request',
  async (balance) => {
    const fixture = sdk(null);
    fixture.retrieve.mockResolvedValue(balance);
    expect(await observe(env, fixture.load)).toMatchObject({ ok: false, phase: 'balance' });
    expect(fixture.enumerate).not.toHaveBeenCalled();
  }
);
it.each([
  list([], { has_more: true }),
  list(Array.from({ length: 101 }, () => endpoint())),
  {},
  null,
  list([endpoint({ livemode: true })]),
  list([endpoint({ status: 'unknown' })]),
  list([endpoint({ url: 'not-a-url-canary' })]),
  list([endpoint({ url: 'https://canary:secret@other.invalid/events' })]),
  list([endpoint({ enabled_events: ['secret'.repeat(1000)] })]),
])(
  'rejects incomplete or malformed inventory without pagination or partial success',
  async (value) => {
    const fixture = sdk({ object: 'balance', livemode: false }, value);
    const output = await observe(env, fixture.load);
    expect(output).toEqual({
      ok: false,
      scope: 'stripe-test-v1-webhook-endpoints-only',
      phase: 'inventory',
      writeIsolationProved: false,
    });
    expect(fixture.enumerate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(output)).not.toMatch(/canary|secret|https:/);
  }
);
it('accepts an empty complete inventory without claiming delivery or write isolation', async () => {
  expect(await observe(env, sdk().load)).toMatchObject({
    ok: true,
    total: 0,
    enabled: 0,
    expectedEnabled: 0,
    v2DestinationsInspected: false,
    writeIsolationProved: false,
  });
});
it('allows the full 100-row bound and counts only enabled exact expected routes and event subscriptions', () => {
  const rows = Array.from({ length: 100 }, () => endpoint({ url: 'https://other.invalid/events' }));
  rows[0] = endpoint({ enabled_events: ['payment_intent.succeeded'] });
  rows[1] = endpoint({ enabled_events: ['payment_intent.payment_failed', 'refund.updated'] });
  rows[2] = endpoint({ url: expected + '?canary=1' });
  expect(summarize(list(rows), expected)).toEqual({
    total: 100,
    enabled: 100,
    expectedEnabled: 2,
    expectedPaymentSucceeded: 1,
    expectedPaymentFailed: 1,
    expectedRefundEvents: 1,
  });
});
it.each(['sdk', 'balance', 'webhooks'])(
  'reduces rejected SDK/error values to a fixed safe failure phase (%s)',
  async (phase) => {
    const fixture = sdk();
    const secret = new Error('sk_test_secret https://canary.invalid/amount/987654321');
    if (phase === 'balance') fixture.retrieve.mockRejectedValue(secret);
    if (phase === 'webhooks') fixture.enumerate.mockRejectedValue(secret);
    const load =
      phase === 'sdk'
        ? () => {
            throw secret;
          }
        : fixture.load;
    expect(await observe(env, load)).toEqual({
      ok: false,
      scope: 'stripe-test-v1-webhook-endpoints-only',
      phase,
      writeIsolationProved: false,
    });
  }
);
it('guards the production COPY and explicit opt-in hook while keeping default startup unchanged', () => {
  const root = path.resolve(__dirname, '../../..');
  const docker = fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8');
  const railway = fs.readFileSync(path.join(root, 'tixmoapi2/railway.toml'), 'utf8');
  expect(docker).toContain('COPY scripts/stripe-read-probe.cjs scripts/start-api.sh ./scripts/');
  expect(railway).toContain('startCommand = "sh scripts/start-api.sh"');
  const startup = fs.readFileSync(path.join(root, 'tixmoapi2/scripts/start-api.sh'), 'utf8');
  expect(startup).toContain('if [ "${TIXMO_STRIPE_READ_PROBE:-}" = true ]; then');
  expect(startup).toContain('node scripts/stripe-read-probe.cjs');
  const source = fs.readFileSync(
    path.join(root, 'tixmoapi2/scripts/stripe-read-probe.cjs'),
    'utf8'
  );
  expect(source).not.toMatch(/require\(['"](?:dotenv|.*prisma|.*config\/|.*app)/);
  expect(source).not.toMatch(
    /paymentIntents|refunds\.|customers\.|receipt_email|instructions_email|\.autoPaging/
  );
  expect(source).toContain('process.exit(1)');
  expect(source).toContain('20000');
  expect(guard(env).expected).toBe(expected);
});

it('terminates the owned CLI at its hard deadline without echoing the pending response', async () => {
  jest.useFakeTimers();
  const exitCode = process.exitCode;
  const output = jest.spyOn(console, 'log').mockImplementation(() => {});
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  let finish!: (value: any) => void;
  const fixture = sdk();
  fixture.retrieve.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const work = main([], env, fixture.load);
  try {
    jest.advanceTimersByTime(19999);
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(output.mock.calls).toEqual([
      [
        JSON.stringify({
          ok: false,
          scope: 'stripe-test-v1-webhook-endpoints-only',
          phase: 'deadline',
          writeIsolationProved: false,
        }),
      ],
    ]);
    // Settle the inert request in this mock process; actual CLI exit ends its socket.
    finish({ object: 'balance', livemode: true, secret: 'late-canary' });
    await work;
    expect(fixture.enumerate).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    output.mockRestore();
    exit.mockRestore();
    process.exitCode = exitCode;
    jest.useRealTimers();
  }
});
it('rejects CLI arguments without loading SDK and clears its deadline', async () => {
  jest.useFakeTimers();
  const exitCode = process.exitCode;
  const output = jest.spyOn(console, 'log').mockImplementation(() => {});
  const load = jest.fn();
  try {
    await main(['--write'], env, load);
    expect(load).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ ok: false, phase: 'guard' });
  } finally {
    output.mockRestore();
    process.exitCode = exitCode;
    jest.useRealTimers();
  }
});

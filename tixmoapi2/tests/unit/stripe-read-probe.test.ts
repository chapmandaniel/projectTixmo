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
  [{ NODE_ENV: 'test' }, 'node-env'],
  [{ TIXMO_STRIPE_READ_PROBE: '' }, 'opt-in'],
  [{ TIXMO_STRIPE_READ_PROBE: 'TRUE' }, 'opt-in'],
  [{ STRIPE_SECRET_KEY: '' }, 'test-key-format'],
  [
    { STRIPE_SECRET_KEY: ['sk', 'live', 'SyntheticSecretCanary123456'].join('_') },
    'test-key-format',
  ],
  [{ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY + '\n' }, 'test-key-format'],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: '' }, 'expected-url-missing'],
  [
    { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: 'http://synthetic-api.invalid/api/v1/payments/webhook' },
    'expected-url-shape',
  ],
  ...['?secret=canary', '#secret', '/', '/extra'].map((suffix) => [
    { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected + suffix },
    'expected-url-shape',
  ]),
  [
    {
      TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace(
        'synthetic-api.invalid',
        'canary@synthetic-api.invalid'
      ),
    },
    'expected-url-shape',
  ],
  [
    { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace('synthetic-api.invalid', '127.0.0.1') },
    'expected-url-shape',
  ],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: undefined }, 'expected-url-missing'],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: null }, 'expected-url-missing'],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: 42 }, 'expected-url-shape'],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: 'canary'.repeat(100) }, 'expected-url-shape'],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: 'https://[canary' }, 'expected-url-parse'],
  [
    { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace('https:', 'HTTPS:') },
    'expected-url-canonical',
  ],
  [
    { TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected.replace('.invalid/', '.invalid:443/') },
    'expected-url-canonical',
  ],
  [{ TIXMO_STRIPE_EXPECTED_WEBHOOK_URL: expected + '\n' }, 'expected-url-canonical'],
  ...['sk', 'rk'].map((family) => [
    { STRIPE_SECRET_KEY: [family, 'test', ''].join('_') },
    'test-key-format',
  ]),
  [{ STRIPE_SECRET_KEY: ['sk', 'test', 'a'.repeat(505)].join('_') }, 'test-key-format'],
  ...[
    ['rk', 'live'],
    ['pk', 'test'],
    ['pk', 'live'],
    ['sk', 'org'],
  ].map((prefix) => [
    { STRIPE_SECRET_KEY: [...prefix, 'SyntheticCanary'].join('_') },
    'test-key-format',
  ]),
  ...[' ', '\t', '\r', '\n', '\0', '\x1f', '\x7f', '\u00a0', '\u2028', '😀'].map((byte) => [
    { STRIPE_SECRET_KEY: ['rk', 'test', 'opaque' + byte + 'canary'].join('_') },
    'test-key-format',
  ]),
  ...[null, undefined, 42, {}, []].map((value) => [
    { STRIPE_SECRET_KEY: value },
    'test-key-format',
  ]),
] as Array<[Record<string, unknown>, string]>)(
  'classifies a rejected guard as a fixed reason before SDK loading',
  async (mutation, guardReason) => {
    const load = jest.fn(() => {
      throw new Error('must-not-load');
    });
    const output = await observe({ ...env, ...mutation }, load);
    expect(output).toEqual({
      ok: false,
      scope: 'stripe-test-v1-webhook-endpoints-only',
      phase: 'guard',
      writeIsolationProved: false,
      guardReason,
    });
    expect(JSON.stringify(output)).not.toMatch(/canary|https:|sk_test|Synthetic|:443|241/);
    expect(load).not.toHaveBeenCalled();
  }
);
it('does not expose arbitrary thrown guard values or forge a reason from provider errors', async () => {
  const load = jest.fn();
  const hostile = {
    ...env,
    get NODE_ENV() {
      throw new Error('secret-canary https://private.invalid');
    },
  };
  expect(await observe(hostile, load)).toEqual({
    ok: false,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    phase: 'guard',
    writeIsolationProved: false,
    guardReason: 'unclassified',
  });
  expect(load).not.toHaveBeenCalled();
  expect(
    await observe(env, () => {
      throw Object.assign(new Error('secret-canary'), { reason: 'node-env' });
    })
  ).toEqual({
    ok: false,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    phase: 'sdk',
    writeIsolationProved: false,
  });
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
    const secret = new Error(
      ['sk', 'test', 'secret'].join('_') + ' https://canary.invalid/amount/987654321'
    );
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
      ...(phase === 'sdk' ? {} : { providerErrorCategory: 'generic' }),
    });
  }
);
it('guards the production COPY and explicit opt-in hook while keeping default startup unchanged', () => {
  const root = path.resolve(__dirname, '../../..');
  const docker = fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8');
  const railway = fs.readFileSync(path.join(root, 'tixmoapi2/railway.toml'), 'utf8');
  expect(docker).toContain('COPY scripts/stripe-read-probe.cjs ./scripts/stripe-read-probe.cjs');
  expect(railway).toContain(
    'if [ \\"$TIXMO_STRIPE_READ_PROBE\\" = true ]; then node scripts/stripe-read-probe.cjs; fi && exec node dist/index.js'
  );
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
    expect(JSON.parse(output.mock.calls[0][0])).toEqual({
      ok: false,
      scope: 'stripe-test-v1-webhook-endpoints-only',
      phase: 'guard',
      writeIsolationProved: false,
      guardReason: 'arguments',
    });
  } finally {
    output.mockRestore();
    process.exitCode = exitCode;
    jest.useRealTimers();
  }
});

it.each([
  { components: ['sk', 'test', 'opaque_suffix-with-hyphen'] },
  { components: ['rk', 'test', 'opaque_suffix-with-hyphen'] },
  { components: ['sk', 'test', 'x'] },
  { components: ['rk', 'test', 'x'] },
  { components: ['sk', 'test', 'a'.repeat(241)] },
  { components: ['rk', 'test', 'a'.repeat(504)] },
  { components: ['sk', 'test', '!visible~ascii:opaque/+='] },
])(
  'passes documented test families with an opaque bounded visible suffix unchanged to SDK',
  async ({ components }) => {
    const key = components.join('_');
    const fixture = sdk();
    expect(guard({ ...env, STRIPE_SECRET_KEY: key }).key).toBe(key);
    expect(await observe({ ...env, STRIPE_SECRET_KEY: key }, fixture.load)).toMatchObject({
      ok: true,
      testMode: true,
      writeIsolationProved: false,
    });
    expect(fixture.load.mock.results[0].value.mock.calls[0][0]).toBe(key);
    expect(fixture.calls).toEqual(['balance', 'endpoints']);
  }
);
it.each([
  ['StripeAuthenticationError', 'authentication'],
  ['StripePermissionError', 'permission'],
  ['StripeConnectionError', 'connection'],
  ['StripeRateLimitError', 'rate-limit'],
  ['StripeInvalidRequestError', 'invalid-request'],
  ['StripeAPIError', 'api'],
  ['private-canary', 'generic'],
])('reduces provider failure types to fixed categories without values', async (type, category) => {
  const fixture = sdk();
  const error = Object.assign(new Error('private-canary https://private.invalid'), {
    type,
    code: 'private-canary',
    headers: { authorization: 'private-canary' },
  });
  fixture.retrieve.mockRejectedValue(error);
  const output = await observe(env, fixture.load);
  expect(output).toEqual({
    ok: false,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    phase: 'balance',
    writeIsolationProved: false,
    providerErrorCategory: category,
  });
  expect(fixture.enumerate).not.toHaveBeenCalled();
  expect(JSON.stringify(output)).not.toMatch(/canary|https:|Stripe|authorization/);
});
it('a restricted test key with insufficient endpoint permissions remains fail-closed after one balance GET', async () => {
  const fixture = sdk();
  fixture.enumerate.mockRejectedValue(
    Object.assign(new Error('private-canary'), { type: 'StripePermissionError' })
  );
  const key = ['rk', 'test', 'opaque_synthetic-only'].join('_');
  expect(await observe({ ...env, STRIPE_SECRET_KEY: key }, fixture.load)).toEqual({
    ok: false,
    scope: 'stripe-test-v1-webhook-endpoints-only',
    phase: 'webhooks',
    writeIsolationProved: false,
    providerErrorCategory: 'permission',
  });
  expect(fixture.retrieve.mock.invocationCallOrder[0]).toBeLessThan(
    fixture.enumerate.mock.invocationCallOrder[0]
  );
  expect(fixture.retrieve).toHaveBeenCalledTimes(1);
  expect(fixture.enumerate).toHaveBeenCalledTimes(1);
});
it('malformed error type getters and response-mode failures expose only generic categories', async () => {
  const fixture = sdk();
  const error = new Error('private-canary');
  Object.defineProperty(error, 'type', {
    get() {
      throw new Error('private-canary');
    },
  });
  fixture.retrieve.mockRejectedValue(error);
  expect(await observe(env, fixture.load)).toMatchObject({
    ok: false,
    phase: 'balance',
    providerErrorCategory: 'generic',
  });
  expect(await observe(env, sdk({ object: 'balance', livemode: true }).load)).toMatchObject({
    ok: false,
    phase: 'balance',
    providerErrorCategory: 'generic',
  });
});

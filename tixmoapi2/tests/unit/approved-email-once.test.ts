export {};
const { guard, observe, main } = require('../../scripts/approved-email-once.cjs');
const env = {
  NODE_ENV: 'production',
  TIXMO_APPROVED_EMAIL_ONCE: 'true',
  FROM_EMAIL: 'info@tixmo.co',
  EMAIL_FROM: 'info@tixmo.co',
  FROM_NAME: 'Tixmo',
  POSTMARK_MESSAGE_STREAM: 'outbound',
  POSTMARK_SERVER_TOKEN: 'synthetic-postmark-canary',
  REDIS_URL: 'redis://synthetic:synthetic@redis.test:6379/0',
};
const scope = 'approved-email-task600';
const key = 'tixmo:operator:task-600:approved-email-attempt:v1';
function harness() {
  const redis = {
    isOpen: true,
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'synthetic-private-provider-id' });
  const loadTransport = jest.fn(() => ({ sendMail }));
  const createClient = jest.fn(() => redis);
  return { redis, sendMail, loadTransport, deps: { createClient, loadTransport } };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each(['', undefined, 'false', 'TRUE', '1'])(
  'nonopt-in skips all dependencies: %s',
  async (flag) => {
    const h = harness();
    expect(await observe([], { ...env, TIXMO_APPROVED_EMAIL_ONCE: flag }, h.deps)).toEqual({
      scope,
      status: 'skipped',
      sendAttempted: false,
      providerAccepted: false,
    });
    expect(h.deps.createClient).not.toHaveBeenCalled();
    expect(h.loadTransport).not.toHaveBeenCalled();
  }
);
it.each([
  { NODE_ENV: 'test' },
  { FROM_EMAIL: 'foreign@synthetic.test' },
  { EMAIL_FROM: 'foreign@synthetic.test' },
  { FROM_NAME: 'Foreign' },
  { POSTMARK_MESSAGE_STREAM: 'broadcast' },
  { POSTMARK_SERVER_TOKEN: '' },
  { POSTMARK_SERVER_TOKEN: 'secret\ncanary' },
  { REDIS_URL: 'https://foreign.invalid' },
])('guards fixed approved configuration before clients: %j', async (change) => {
  const h = harness();
  expect(await observe([], { ...env, ...change }, h.deps)).toMatchObject({
    scope,
    status: 'failed',
    phase: 'guard',
    sendAttempted: false,
  });
  expect(h.deps.createClient).not.toHaveBeenCalled();
  expect(h.loadTransport).not.toHaveBeenCalled();
});
it('rejects arguments and never allows arbitrary message parameters', () =>
  expect(() => guard(['--to=other'], env)).toThrow('Rejected'));
it('claims permanent fixed NX marker before loading actual transport and sends only approved content once', async () => {
  const h = harness();
  const result = await observe([], env, h.deps);
  expect(h.redis.set).toHaveBeenCalledWith(key, 'claimed', { NX: true });
  expect(h.redis.set).toHaveBeenCalledTimes(1);
  expect(h.redis.set.mock.invocationCallOrder[0]).toBeLessThan(
    h.loadTransport.mock.invocationCallOrder[0]
  );
  expect(h.sendMail).toHaveBeenCalledTimes(1);
  expect(h.sendMail).toHaveBeenCalledWith({
    from: 'Tixmo <info@tixmo.co>',
    to: 'daniel@tixmo.co',
    subject: 'Tixmo approved delivery test',
    text: 'Daniel, this is the single approved Tixmo outbound email delivery test. No action is required.',
  });
  expect(result).toMatchObject({
    status: 'accepted',
    attemptClaimed: true,
    sendAttempted: true,
    providerAccepted: true,
    inboxArrivalProved: false,
  });
  expect(JSON.stringify(result)).not.toMatch(/canary|provider-id|redis\.test|daniel@|MessageID/);
  expect(h.redis.disconnect).toHaveBeenCalledTimes(1);
});
it('existing marker blocks load/send even when a prior result is ambiguous', async () => {
  const h = harness();
  h.redis.set.mockResolvedValue(null);
  expect(await observe([], env, h.deps)).toMatchObject({
    status: 'duplicate-blocked',
    sendAttempted: false,
    providerAccepted: false,
  });
  expect(h.loadTransport).not.toHaveBeenCalled();
  expect(h.sendMail).not.toHaveBeenCalled();
});
it('two concurrent invocations sharing the atomic marker send at most once', async () => {
  const h = harness();
  let claimed = false;
  h.redis.set.mockImplementation(() => {
    const reply = claimed ? null : 'OK';
    claimed = true;
    return Promise.resolve(reply);
  });
  const results = await Promise.all([observe([], env, h.deps), observe([], env, h.deps)]);
  expect(results.map((row) => row.status).sort()).toEqual(['accepted', 'duplicate-blocked']);
  expect(h.sendMail).toHaveBeenCalledTimes(1);
});
it.each(['connect', 'claim', 'load', 'send'])(
  'fails safely at %s without retry or marker release',
  async (phase) => {
    const h = harness();
    const error = new Error('synthetic-key-canary private-provider-response');
    if (phase === 'connect') h.redis.connect.mockRejectedValue(error);
    if (phase === 'claim') h.redis.set.mockRejectedValue(error);
    if (phase === 'load')
      h.loadTransport.mockImplementation(() => {
        throw error;
      });
    if (phase === 'send') h.sendMail.mockRejectedValue(error);
    const result = await observe([], env, h.deps);
    expect(result.providerAccepted).toBe(false);
    expect(result.status).toBe(phase === 'send' ? 'uncertain' : 'failed');
    expect(JSON.stringify(result)).not.toMatch(/canary|private-provider/);
    expect(h.redis.connect).toHaveBeenCalledTimes(1);
    expect(h.sendMail.mock.calls.length).toBeLessThanOrEqual(1);
  }
);
it('uncertain timed-out claim never initiates transport', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.redis.set.mockReturnValue(new Promise(() => {}));
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(3001);
  expect(await work).toMatchObject({ phase: 'claim', status: 'failed', sendAttempted: false });
  expect(h.loadTransport).not.toHaveBeenCalled();
  expect(h.redis.disconnect).toHaveBeenCalledTimes(1);
});
it('send timeout preserves claimed marker and forbids automatic retry', async () => {
  jest.useFakeTimers();
  const h = harness();
  h.sendMail.mockReturnValue(new Promise(() => {}));
  const work = observe([], env, h.deps);
  await jest.advanceTimersByTimeAsync(11001);
  expect(await work).toMatchObject({
    status: 'uncertain',
    attemptClaimed: true,
    sendAttempted: true,
    providerAccepted: false,
  });
  expect(h.sendMail).toHaveBeenCalledTimes(1);
  expect(h.redis.set).toHaveBeenCalledTimes(1);
});
it('cleanup failure does not erase provider acceptance or repeat send', async () => {
  const h = harness();
  h.redis.disconnect.mockRejectedValue(new Error('privatecanary'));
  expect(await observe([], env, h.deps)).toMatchObject({
    phase: 'cleanup',
    providerAccepted: true,
    sendAttempted: true,
    inboxArrivalProved: false,
  });
  expect(h.sendMail).toHaveBeenCalledTimes(1);
});
it('installed Redis command transform keeps permanent NX with no expiry/delete', () => {
  const set = require('@redis/client/dist/lib/commands/SET');
  expect(set.transformArguments(key, 'claimed', { NX: true })).toEqual([
    'SET',
    key,
    'claimed',
    'NX',
  ]);
});
it('CLI failure exits zero after safe receipt so startup continues', async () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(((
    _value: string,
    callback: () => void
  ) => {
    callback();
    return true;
  }) as any);
  await main(['invalid'], env);
  expect(exit).toHaveBeenCalledWith(0);
  expect(output).toHaveBeenCalledTimes(1);
});
it('CLI watchdog exits zero once even when receipt callback hangs', async () => {
  jest.useFakeTimers();
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['invalid'], env);
  await jest.advanceTimersByTimeAsync(25001);
  expect(exit).toHaveBeenCalledWith(0);
  expect(output).toHaveBeenCalledTimes(1);
});
it('packages a narrowly nonblocking opt-in hook and reuses compiled app email transport after claim', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../../..');
  const source = fs.readFileSync(
    path.join(root, 'tixmoapi2/scripts/approved-email-once.cjs'),
    'utf8'
  );
  const toml = fs.readFileSync(path.join(root, 'tixmoapi2/railway.toml'), 'utf8');
  expect(toml).toContain(
    'node scripts/approved-email-once.cjs || true; fi && exec node dist/index.js'
  );
  expect(toml).toContain('$TIXMO_APPROVED_EMAIL_ONCE');
  expect(fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8')).toContain(
    'COPY scripts/approved-email-once.cjs ./scripts/approved-email-once.cjs'
  );
  expect(source).toContain("require('../dist/config/email').transporter");
  expect(source).not.toMatch(/\.del\(|\.expire\(|\.verify\(|\.get\(|dotenv/);
});
it('actual repository shell continues API startup after an unexpected email helper failure', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const { spawn } = require('node:child_process');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-approved-mail-shell-'));
  try {
    const ledger = path.join(directory, 'phases');
    fs.writeFileSync(ledger, '');
    const stub = `#!${process.execPath}\nconst fs=require('node:fs');const tool=require('node:path').basename(process.argv[1]);const target=process.argv[2];if(tool==='npm') {fs.appendFileSync(process.env.LEDGER,'migrate\\n');process.exit(0);}if(target==='scripts/approved-email-once.cjs'){fs.appendFileSync(process.env.LEDGER,'mail\\n');process.exit(7);}if(target==='dist/index.js'){fs.appendFileSync(process.env.LEDGER,'api\\n');process.exit(0);}process.exit(99);\n`;
    for (const name of ['node', 'npm'])
      fs.writeFileSync(path.join(directory, name), stub, { mode: 0o700 });
    const toml = fs.readFileSync(
      path.resolve(__dirname, '../../../tixmoapi2/railway.toml'),
      'utf8'
    );
    const command = JSON.parse(toml.match(/^startCommand = (".*")$/m)[1]);
    const child = spawn('/bin/sh', ['-c', command], {
      env: { PATH: directory, LEDGER: ledger, TIXMO_APPROVED_EMAIL_ONCE: 'true' },
      stdio: 'ignore',
      detached: true,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }, 5000);
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
    } finally {
      clearTimeout(timer);
    }
    expect(timedOut).toBe(false);
    expect(code).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('migrate\nmail\napi\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

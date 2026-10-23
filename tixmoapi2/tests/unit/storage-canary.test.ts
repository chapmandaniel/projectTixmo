export {};
import { Readable } from 'node:stream';
const { guard, observe, main } = require('../../scripts/storage-canary.cjs');
const env = {
  NODE_ENV: 'production',
  TIXMO_STORAGE_CANARY: 'true',
  S3_ENDPOINT: 'https://t3.storageapi.dev',
  S3_BUCKET_NAME: 'mediabucket-ovwubxuyoklp',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'synthetic-access',
  S3_SECRET_ACCESS_KEY: 'synthetic-secret-canary',
};
const bytes = Buffer.from('Tixmo task602 synthetic storage canary\n');
function handler(options: { version?: boolean; failure?: string } = {}) {
  const requests: any[] = [];
  let stream: Readable | undefined;
  const handle = jest.fn((request: any) => {
    requests.push(request);
    if (options.failure === request.method) throw new Error('private-provider-canary');
    let statusCode = 200;
    let body: Readable = Readable.from([]);
    const headers: any = {};
    if (options.failure === 'server503')
      return Promise.resolve({
        response: {
          statusCode: 503,
          headers: { 'content-type': 'application/xml' },
          body: Readable.from([
            '<Error><Code>ServiceUnavailable</Code><Message>privatecanary</Message></Error>',
          ]),
        },
      });
    if (request.method === 'PUT') {
      headers.etag = '"synthetic"';
      if (options.version) headers['x-amz-version-id'] = 'synthetic-owned-version';
    }
    if (request.method === 'GET') {
      stream =
        options.failure === 'stream-timeout'
          ? new Readable({ read() {} })
          : Readable.from([
              options.failure === 'mismatch'
                ? Buffer.from('wrong')
                : options.failure === 'oversize'
                  ? Buffer.alloc(257)
                  : bytes,
            ]);
      body = stream;
      if (options.version) headers['x-amz-version-id'] = 'synthetic-owned-version';
    }
    if (request.method === 'DELETE') statusCode = 204;
    if (request.method === 'HEAD') statusCode = options.failure === 'head-present' ? 200 : 404;
    return Promise.resolve({ response: { statusCode, headers, body } });
  });
  const destroy = jest.fn();
  return { requestHandler: { handle, destroy }, requests, destroy, body: () => stream };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it.each(['', undefined, 'false', 'TRUE'])('nonoptin skips SDK and all work %s', async (flag) => {
  const h = handler();
  expect(await observe([], { ...env, TIXMO_STORAGE_CANARY: flag }, h)).toEqual({
    scope: 'task602-existing-storage-canary',
    skipped: true,
  });
  expect(h.requestHandler.handle).not.toHaveBeenCalled();
});
it.each([
  { NODE_ENV: 'test' },
  { S3_ENDPOINT: 'https://foreign.invalid' },
  { S3_BUCKET_NAME: 'foreign-bucket' },
  { S3_REGION: 'us-east-1' },
  { S3_ACCESS_KEY_ID: '' },
  { S3_SECRET_ACCESS_KEY: '' },
  { S3_SECRET_ACCESS_KEY: 'secret\ncanary' },
  { S3_URL_STYLE: 'unknown' },
])('rejects unsafe config without SDK requests %j', async (change) => {
  const h = handler();
  expect(await observe([], { ...env, ...change }, h)).toMatchObject({
    ok: false,
    phase: 'guard',
    putAttempted: false,
  });
  expect(h.requestHandler.handle).not.toHaveBeenCalled();
});
it('rejects arguments; follows exact app style and explicit credential precedence', () => {
  expect(() => guard(['--bucket=foreign'], env)).toThrow();
  expect(guard([], env).style).toBe('path');
  expect(guard([], { ...env, AWS_S3_URL_STYLE: 'virtual' }).style).toBe('virtual');
  expect(guard([], { ...env, S3_URL_STYLE: 'path', AWS_S3_URL_STYLE: 'virtual' }).style).toBe(
    'path'
  );
});
it.each(['path', 'virtual'])(
  'actual SDK signs fixed %s endpoint with explicit credentials and performs exact owned cycle',
  async (style) => {
    const h = handler({ version: true });
    const result = await observe([], { ...env, S3_URL_STYLE: style }, h);
    expect(result).toMatchObject({
      ok: true,
      putConfirmed: true,
      readbackMatched: true,
      deleteConfirmed: true,
      removalVerified: true,
      possibleOrphan: false,
      style,
    });
    expect(h.requests.map((row) => row.method)).toEqual(['PUT', 'GET', 'DELETE', 'HEAD']);
    const put = h.requests[0];
    expect(put.protocol).toBe('https:');
    expect(put.hostname).toBe(
      style === 'path' ? 't3.storageapi.dev' : 'mediabucket-ovwubxuyoklp.t3.storageapi.dev'
    );
    expect(put.path).toMatch(
      style === 'path'
        ? /^\/mediabucket-ovwubxuyoklp\/task602-canary\/[a-f0-9-]{36}\.txt$/
        : /^\/task602-canary\/[a-f0-9-]{36}\.txt$/
    );
    expect(put.headers['if-none-match']).toBe('*');
    expect(put.headers.authorization).toContain('Credential=synthetic-access/');
    expect(put.headers.authorization).toContain('/auto/s3/aws4_request');
    expect(Buffer.from(put.body)).toEqual(bytes);
    for (const request of h.requests.slice(1)) {
      expect(request.path).toBe(put.path);
      expect(request.query.versionId).toBe('synthetic-owned-version');
    }
    expect(h.body()?.destroyed).toBe(true);
    expect(h.destroy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-access|canary\n|owned-version|authorization|t3\.storageapi|task602-canary\//
    );
  }
);
it('unversioned cycle uses same unique key and does not fabricate version selectors', async () => {
  const h = handler();
  expect(await observe([], env, h)).toMatchObject({ ok: true });
  for (const request of h.requests.slice(1)) {
    expect(request.path).toBe(h.requests[0].path);
    expect(request.query.versionId).toBeUndefined();
  }
});
it('uncertain PUT does not blindly delete any object or retry', async () => {
  const h = handler({ failure: 'PUT' });
  expect(await observe([], env, h)).toMatchObject({
    ok: false,
    putAttempted: true,
    putConfirmed: false,
    possibleOrphan: true,
    deleteConfirmed: false,
  });
  expect(h.requests.map((row) => row.method)).toEqual(['PUT']);
});
it.each(['GET', 'mismatch', 'oversize'])(
  'confirmed owned object is deleted even after %s failure',
  async (failure) => {
    const h = handler({ version: true, failure });
    const result = await observe([], env, h);
    expect(result).toMatchObject({
      ok: false,
      putConfirmed: true,
      readbackMatched: false,
      deleteConfirmed: true,
      removalVerified: true,
      possibleOrphan: false,
    });
    expect(h.requests.map((row) => row.method)).toEqual(['PUT', 'GET', 'DELETE', 'HEAD']);
    if (h.body()) expect(h.body()?.destroyed).toBe(true);
  }
);
it.each(['DELETE', 'head-present'])('cleanup failure remains explicit %s', async (failure) => {
  const h = handler({ failure });
  const result = await observe([], env, h);
  expect(result).toMatchObject({ ok: false, possibleOrphan: true, removalVerified: false });
  expect(h.requests.filter((row) => row.method === 'DELETE')).toHaveLength(1);
});
it('bounded streaming timeout destroys body then performs owned cleanup', async () => {
  jest.useFakeTimers();
  const h = handler({ failure: 'stream-timeout' });
  const work = observe([], env, h);
  await jest.advanceTimersByTimeAsync(5001);
  expect(await work).toMatchObject({ ok: false, readbackMatched: false, removalVerified: true });
  expect(h.body()?.destroyed).toBe(true);
});
it('request abort bounds uncertain PUT without retry or unsafe delete', async () => {
  jest.useFakeTimers();
  const handle = jest.fn(() => new Promise(() => {}));
  const work = observe([], env, { requestHandler: { handle, destroy: jest.fn() } });
  await jest.advanceTimersByTimeAsync(5001);
  expect(await work).toMatchObject({ ok: false, possibleOrphan: true, putConfirmed: false });
  expect(handle).toHaveBeenCalledTimes(1);
});
it('CLI failure does not block API startup or print raw error/keys', async () => {
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
  expect(JSON.stringify(output.mock.calls)).not.toContain('synthetic-secret');
});

it('actual SDK does not retry a transient provider503 or delete an unconfirmed PUT', async () => {
  const h = handler({ failure: 'server503' });
  expect(await observe([], env, h)).toMatchObject({
    ok: false,
    putConfirmed: false,
    possibleOrphan: true,
  });
  expect(h.requests.map((row) => row.method)).toEqual(['PUT']);
});
it('executable retains bounded nonblocking watchdog and production packaging', async () => {
  jest.useFakeTimers();
  const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  await main(['invalid'], env);
  await jest.advanceTimersByTimeAsync(35001);
  expect(exit).toHaveBeenCalledWith(0);
  expect(output).toHaveBeenCalledTimes(1);
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../../..');
  expect(fs.readFileSync(path.join(root, 'tixmoapi2/Dockerfile'), 'utf8')).toContain(
    'COPY scripts/storage-canary.cjs ./scripts/storage-canary.cjs'
  );
  expect(fs.readFileSync(path.join(root, 'tixmoapi2/railway.toml'), 'utf8')).toContain(
    'node scripts/storage-canary.cjs || true; fi'
  );
  const startup = fs.readFileSync(path.join(root, 'tixmoapi2/railway.toml'), 'utf8');
  expect(startup.indexOf('exec node dist/index.js')).toBeGreaterThan(
    startup.indexOf('node scripts/storage-canary.cjs || true; fi')
  );
});

const { classifyFailure } = require('../../scripts/storage-canary.cjs');
it('failure diagnostics contain only fixed categories and bounded HTTP status', () => {
  for (const [name, category] of [
    ['InvalidAccessKeyId', 'authentication'],
    ['AccessDenied', 'authorization'],
    ['PreconditionFailed', 'conflict'],
    ['NoSuchKey', 'not-found'],
    ['ServiceUnavailable', 'service'],
    ['AbortError', 'timeout'],
    ['private-canary', 'generic'],
  ]) {
    const result = classifyFailure({
      name,
      message: 'private-canary',
      $metadata: { httpStatusCode: 403, headers: { secret: 'private-canary' } },
    });
    expect(result).toEqual({ category, httpStatus: 403 });
    expect(JSON.stringify(result)).not.toContain('private-canary');
  }
  for (const status of [NaN, Infinity, 0, 600, '403', 403.5])
    expect(classifyFailure({ $metadata: { httpStatusCode: status } }).httpStatus).toBeNull();
  const hostile = Object.defineProperty({}, 'name', {
    get() {
      throw Error('private-canary');
    },
  });
  expect(classifyFailure(hostile)).toEqual({ category: 'generic', httpStatus: null });
});
it('actual SDK provider HTTP failure is sanitized without assuming authentication', async () => {
  const h = handler({ failure: 'server503' });
  const result = await observe([], env, h);
  expect(result).toMatchObject({
    failurePhase: 'put',
    failureCategory: 'service',
    failureHttpStatus: 503,
  });
  expect(JSON.stringify(result)).not.toMatch(/privatecanary|synthetic-secret|ServiceUnavailable/);
});
const oldKey = 'task602-canary/11111111-1111-4111-8111-111111111111.txt';
const secondKey = 'task602-canary/22222222-2222-4222-8222-222222222222.txt';
function namespaceHandler(options: { failure?: string; second?: boolean } = {}) {
  const objects = new Map<string, { body: Buffer; type: string }>([
    [oldKey, { body: bytes, type: 'text/plain' }],
  ]);
  if (options.second)
    objects.set(secondKey, { body: Buffer.from('private-user-content'), type: 'text/plain' });
  if (options.failure === 'wrong-content')
    objects.set(oldKey, { body: Buffer.from('private-user-content'), type: 'text/plain' });
  if (options.failure === 'wrong-type')
    objects.set(oldKey, { body: bytes, type: 'application/json' });
  const requests: any[] = [];
  const handle = jest.fn(async (request: any) => {
    requests.push(request);
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let body = Readable.from([]);
    const key = decodeURIComponent(request.path.slice(request.path.indexOf('task602-canary/')));
    if (request.query['list-type'] === '2') {
      expect(request.query.prefix).toBe('task602-canary/');
      expect(request.query['max-keys']).toBe('100');
      headers['content-type'] = 'application/xml';
      const keys =
        options.failure === 'foreign-key'
          ? ['application/private-canary.txt']
          : [...objects.keys()];
      const xml = `<ListBucketResult><IsTruncated>${options.failure === 'truncated'}</IsTruncated><KeyCount>${keys.length}</KeyCount>${keys.map((k) => `<Contents><Key>${k}</Key><Size>${bytes.length}</Size></Contents>`).join('')}</ListBucketResult>`;
      body = Readable.from([xml]);
    } else if (request.method === 'PUT') {
      objects.set(key, { body: Buffer.from(request.body), type: request.headers['content-type'] });
      headers.etag = '"owned-etag"';
    } else if (request.method === 'GET') {
      if (options.failure === 'get-timeout') return await new Promise<never>(() => {});
      const object = objects.get(key)!;
      body = Readable.from([object.body]);
      headers['content-type'] = object.type;
      headers.etag = '"owned-etag"';
      if (options.failure === 'versioned') headers['x-amz-version-id'] = 'private-version';
    } else if (request.method === 'DELETE') {
      if (key === oldKey) expect(request.headers['if-match']).toBe('"owned-etag"');
      if (options.failure === 'changed') {
        statusCode = 412;
        headers['content-type'] = 'application/xml';
        body = Readable.from([
          '<Error><Code>PreconditionFailed</Code><Message>private-canary</Message></Error>',
        ]);
      } else {
        objects.delete(key);
        statusCode = 204;
      }
    } else if (request.method === 'HEAD') statusCode = objects.has(key) ? 200 : 404;
    return { response: { statusCode, headers, body } };
  });
  return { objects, requests, requestHandler: { handle, destroy: jest.fn() } };
}
it('cleanup requires both flags; cleanup flag alone never makes a request', async () => {
  const h = namespaceHandler();
  expect(
    await observe(
      [],
      { ...env, TIXMO_STORAGE_CANARY: 'false', TIXMO_STORAGE_CANARY_CLEANUP: 'true' },
      h
    )
  ).toMatchObject({ skipped: true });
  expect(h.requests).toEqual([]);
});
it('actual SDK cleans only fully validated old canary then verifies final namespace absence', async () => {
  const h = namespaceHandler();
  const result = await observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: 'true' }, h);
  expect(result).toMatchObject({
    ok: true,
    namespaceCleanupRequested: true,
    namespaceScanned: 1,
    namespaceDeleted: 1,
    namespaceVerifiedEmpty: true,
    possibleOrphan: false,
  });
  expect(h.objects.size).toBe(0);
  expect(h.requests.map((r) => (r.query['list-type'] ? 'LIST' : r.method))).toEqual([
    'LIST',
    'GET',
    'DELETE',
    'HEAD',
    'LIST',
    'PUT',
    'GET',
    'DELETE',
    'HEAD',
    'LIST',
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /11111111|task602-canary\/|owned-etag|storageapi|synthetic-secret/
  );
});
it.each(['foreign-key', 'truncated', 'wrong-content', 'wrong-type', 'versioned'])(
  'namespace %s blocks every DELETE and new PUT',
  async (failure) => {
    const h = namespaceHandler({ failure });
    expect(await observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: 'true' }, h)).toMatchObject({
      ok: false,
      putAttempted: false,
      namespaceVerifiedEmpty: false,
      possibleOrphan: true,
    });
    expect(h.requests.some((r) => ['PUT', 'DELETE'].includes(r.method))).toBe(false);
    expect(h.objects.has(oldKey)).toBe(true);
  }
);
it('valid first candidate is NOT deleted when later candidate contains unknown data', async () => {
  const h = namespaceHandler({ second: true });
  expect(await observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: 'true' }, h)).toMatchObject({
    ok: false,
    namespaceDeleted: 0,
  });
  expect(h.requests.some((r) => ['PUT', 'DELETE'].includes(r.method))).toBe(false);
  expect(h.objects.size).toBe(2);
});
it('conditional cleanup refuses changed object and reports safe status/category', async () => {
  const h = namespaceHandler({ failure: 'changed' });
  expect(await observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: 'true' }, h)).toMatchObject({
    ok: false,
    namespaceDeleted: 0,
    failureCategory: 'conflict',
    failureHttpStatus: 412,
  });
  expect(h.objects.has(oldKey)).toBe(true);
  expect(h.requests.some((r) => r.method === 'PUT')).toBe(false);
});
it('namespace read timeout never starts deletion or new canary', async () => {
  jest.useFakeTimers();
  const h = namespaceHandler({ failure: 'get-timeout' });
  const work = observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: 'true' }, h);
  await jest.advanceTimersByTimeAsync(5001);
  expect(await work).toMatchObject({ ok: false, putAttempted: false, namespaceDeleted: 0 });
  expect(h.requests.some((r) => ['PUT', 'DELETE'].includes(r.method))).toBe(false);
});
it.each(['false', 'TRUE', ' true'])(
  'nonexact namespace cleanup opt-in %s preserves original four operations',
  async (flag) => {
    const h = handler();
    expect(await observe([], { ...env, TIXMO_STORAGE_CANARY_CLEANUP: flag }, h)).toMatchObject({
      ok: true,
      namespaceCleanupRequested: false,
    });
    expect(h.requests.map((r) => r.method)).toEqual(['PUT', 'GET', 'DELETE', 'HEAD']);
  }
);

it.each([
  ['node-env', { NODE_ENV: 'test' }],
  ['endpoint', { S3_ENDPOINT: 'private-config-canary' }],
  ['bucket', { S3_BUCKET_NAME: 'private-config-canary' }],
  ['region', { S3_REGION: 'private-config-canary' }],
  ['style', { S3_URL_STYLE: 'private-config-canary' }],
  ['access-key-missing', { S3_ACCESS_KEY_ID: '' }],
  ['access-key-shape', { S3_ACCESS_KEY_ID: 'private-config-canary\n' }],
  ['access-key-shape', { S3_ACCESS_KEY_ID: 'x'.repeat(4097) }],
  ['secret-key-missing', { S3_SECRET_ACCESS_KEY: '' }],
  ['secret-key-shape', { S3_SECRET_ACCESS_KEY: 'private-config-canary\t' }],
  ['secret-key-shape', { S3_SECRET_ACCESS_KEY: 'x'.repeat(4097) }],
])(
  'guard reports only fixed %s without SDK requests or configuration echoes',
  async (reason, patch) => {
    const h = handler();
    const result = await observe([], { ...env, ...(patch as object) }, h);
    expect(result).toMatchObject({
      guardReason: reason,
      failurePhase: 'guard',
      putAttempted: false,
      ok: false,
    });
    expect(h.requests).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-config-canary|synthetic-access|synthetic-secret|storageapi|mediabucket/
    );
  }
);
it('arguments are classified, while nonexact opt-in remains dependency-free skipped', async () => {
  const h = handler();
  expect(await observe(['private-config-canary'], env, h)).toMatchObject({
    guardReason: 'arguments',
    putAttempted: false,
  });
  expect(() => guard([], { ...env, TIXMO_STORAGE_CANARY: 'TRUE' })).toThrow('Rejected');
  expect(await observe([], { ...env, TIXMO_STORAGE_CANARY: 'TRUE' }, h)).toEqual({
    scope: 'task602-existing-storage-canary',
    skipped: true,
  });
  expect(h.requests).toEqual([]);
});
it('valid aliases preserve guard acceptance and provider failures cannot forge guard reasons', async () => {
  const aliases = {
    NODE_ENV: 'production',
    TIXMO_STORAGE_CANARY: 'true',
    AWS_ENDPOINT: env.S3_ENDPOINT,
    AWS_S3_BUCKET: env.S3_BUCKET_NAME,
    AWS_REGION: 'auto',
    AWS_S3_URL_STYLE: 'virtual',
    AWS_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
  };
  expect(guard([], aliases).style).toBe('virtual');
  const h = handler({ failure: 'PUT' });
  expect(await observe([], env, h)).toMatchObject({
    guardReason: 'none',
    failurePhase: 'put',
    putAttempted: true,
  });
});

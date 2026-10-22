import { EventEmitter } from 'node:events';
import * as crypto from '../../src/services/asset-share-crypto';
const { guard, observe, get } = require('../../prisma/check-asset-share-links');
const key = '34'.repeat(32);
const token = 'q'.repeat(43);
const id = '11111111-1111-4111-8111-111111111111';
const env = {
  NODE_ENV: 'production',
  TIXMO_ASSET_LINK_CHECK: 'true',
  DATABASE_URL: 'postgresql://synthetic:canary@db.test/owned?schema=public',
  TIXMO_ASSET_REKEY_DATABASE_URL: 'postgresql://synthetic:canary@db.test/owned?schema=public',
  ASSET_SHARE_ENCRYPTION_KEY: key,
};
const row = () => ({
  id,
  tokenHash: crypto.hashAssetShareToken(token),
  tokenCiphertext: crypto.encryptAssetShareToken(token, { key }),
  expiresAt: new Date(Date.now() + 60000),
  revokedAt: null,
});
function harness(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const PrismaClient = jest.fn().mockImplementation(() => ({
    assetLibraryFolderShare: { findMany },
    $disconnect: disconnect,
  }));
  const http = jest
    .fn()
    .mockResolvedValue({ status: 200, body: { share: { id }, folders: [], assets: [] } });
  return { deps: { crypto, PrismaClient, get: http }, findMany, disconnect, http, PrismaClient };
}
describe('retained encrypted share runtime observer', () => {
  it('checks the complete bounded inventory then actual link identity, with only safe counts', async () => {
    const h = harness([
      row(),
      { ...row(), id: '22222222-2222-4222-8222-222222222222', tokenCiphertext: null },
    ]);
    const result = await observe([], env, h.deps);
    expect(result).toEqual({
      ok: true,
      scope: 'retained-encrypted-asset-links-test-target',
      scanned: 2,
      encryptedVerified: 1,
      hashOnlyUnverified: 1,
      activeAccepted: 1,
      inactiveRejected: 0,
      legacy: 0,
      directDatabaseWrites: false,
      publicGetMayIncrementViews: true,
      hashOnlyBearerAccessProved: false,
    });
    expect(h.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        tokenHash: true,
        tokenCiphertext: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { id: 'asc' },
      take: 1001,
    });
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(h.http).toHaveBeenCalledWith(token);
    expect(h.disconnect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(id);
    expect(JSON.stringify(result)).not.toContain(key);
  });
  it.each([
    { NODE_ENV: 'test' },
    { TIXMO_ASSET_LINK_CHECK: 'false' },
    { TIXMO_ASSET_LINK_CHECK: 'TRUE' },
    { DATABASE_URL: 'postgresql://different/db' },
    { TIXMO_ASSET_REKEY_DATABASE_URL: '' },
    {
      TIXMO_ASSET_REKEY_DATABASE_URL: 'postgresql://db.test/owned?schema=public&schema=foreign',
      DATABASE_URL: 'postgresql://db.test/owned?schema=public&schema=foreign',
    },
    {
      TIXMO_ASSET_REKEY_DATABASE_URL: 'https://db.test/owned',
      DATABASE_URL: 'https://db.test/owned',
    },
    {
      TIXMO_ASSET_REKEY_DATABASE_URL: 'postgresql://db.test/owned?schema=foreign',
      DATABASE_URL: 'postgresql://db.test/owned?schema=foreign',
    },
    { ASSET_SHARE_ENCRYPTION_KEY: 'invalid-canary' },
    { ASSET_SHARE_ENCRYPTION_KEY: { toString: () => key } },
  ])('rejects unsafe config before creating clients: %j', async (change) => {
    const h = harness([]);
    expect(await observe([], { ...env, ...change }, h.deps)).toMatchObject({
      ok: false,
      phase: 'guard',
    });
    expect(h.PrismaClient).not.toHaveBeenCalled();
    expect(h.http).not.toHaveBeenCalled();
  });
  it('rejects arguments before loading clients', () =>
    expect(() => guard(['--apply'], env)).toThrow());
  it.each([
    { tokenCiphertext: '' },
    { tokenCiphertext: 'v1:invalid' },
    { tokenCiphertext: 'v2:invalid' },
    { tokenCiphertext: null, tokenHash: 'invalid-canary' },
    { tokenHash: '0'.repeat(64) },
    { expiresAt: new Date(NaN) },
    { revokedAt: 'invalid' },
  ])('validates all rows before any public GET: %j', async (change) => {
    const h = harness([row(), { ...row(), ...change }]);
    expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'inventory' });
    expect(h.http).not.toHaveBeenCalled();
    expect(h.disconnect).toHaveBeenCalledTimes(1);
  });
  it('rejects an oversized full inventory without HTTP', async () => {
    const h = harness(Array.from({ length: 1001 }, row));
    expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'inventory' });
    expect(h.http).not.toHaveBeenCalled();
  });
  it('does not request hash-only rows or invent retained-link proof for an empty inventory', async () => {
    const h = harness([{ ...row(), tokenCiphertext: null }]);
    expect(await observe([], env, h.deps)).toMatchObject({
      ok: true,
      hashOnlyUnverified: 1,
      encryptedVerified: 0,
      activeAccepted: 0,
    });
    expect(h.http).not.toHaveBeenCalled();
    h.findMany.mockResolvedValue([]);
    expect(await observe([], env, h.deps)).toMatchObject({
      ok: true,
      scanned: 0,
      hashOnlyUnverified: 0,
      encryptedVerified: 0,
      activeAccepted: 0,
    });
  });
  it('rejects legacy classification before any HTTP and requires successful disconnect', async () => {
    const h = harness([row()]);
    const classifier = jest
      .spyOn(h.deps.crypto, 'classifyAssetShareToken')
      .mockReturnValue({ category: 'validLegacy', token });
    try {
      expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'inventory' });
      expect(h.http).not.toHaveBeenCalled();
    } finally {
      classifier.mockRestore();
    }
    h.disconnect.mockRejectedValue(new Error('private-canary'));
    expect(await observe([], env, h.deps)).toEqual({
      ok: false,
      scope: 'retained-encrypted-asset-links-test-target',
      phase: 'disconnect',
      completionProved: false,
    });
  });
  it.each([{ revokedAt: new Date() }, { expiresAt: new Date(Date.now() - 60000) }])(
    'requires inactive links to reject',
    async (change) => {
      const h = harness([{ ...row(), ...change }]);
      h.http.mockResolvedValue({
        status: 404,
        body: { success: false, message: 'Invalid or expired folder share link' },
      });
      expect(await observe([], env, h.deps)).toMatchObject({
        ok: true,
        inactiveRejected: 1,
        activeAccepted: 0,
      });
      h.http.mockResolvedValue({ status: 200, body: { share: { id }, folders: [], assets: [] } });
      expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'links' });
      h.http.mockResolvedValue({
        status: 404,
        body: { success: false, message: 'Route not found' },
      });
      expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'links' });
    }
  );
  it.each([
    { status: 302, body: {} },
    { status: 200, body: { share: { id: 'foreign-canary' }, folders: [], assets: [] } },
    { status: 200, body: {} },
    { status: 404, body: {} },
    { status: 500, body: {} },
  ])(
    'rejects invalid active link responses without exposing their bodies: %j',
    async (response) => {
      const h = harness([row()]);
      h.http.mockResolvedValue(response);
      expect(await observe([], env, h.deps)).toEqual({
        ok: false,
        scope: 'retained-encrypted-asset-links-test-target',
        phase: 'links',
        completionProved: false,
      });
    }
  );
  it('projects provider/database failures to fixed phases only', async () => {
    const h = harness([row()]);
    h.http.mockRejectedValue(new Error(`canary ${token} ${key}`));
    expect(JSON.stringify(await observe([], env, h.deps))).not.toMatch(/canary|qqqq|343434/);
    h.findMany.mockRejectedValue(new Error(env.DATABASE_URL));
    expect(await observe([], env, h.deps)).toMatchObject({ ok: false, phase: 'inventory' });
  });
});
describe('bounded GET transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  function transport() {
    const request = new EventEmitter() as EventEmitter & { end: jest.Mock; destroy: jest.Mock };
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 200;
    const spy = jest
      .spyOn(require('node:https'), 'request')
      .mockImplementation((_options: unknown, callback: unknown) => {
        request.end = jest.fn(() => (callback as (r: unknown) => void)(response));
        request.destroy = jest.fn();
        return request;
      });
    return { request, response, spy };
  }
  it('sends exactly one GET to the fixed host and returns only the bounded parsed response', async () => {
    const h = transport();
    const pending = get(token);
    h.response.emit('data', Buffer.from('{"share":{}}'));
    h.response.emit('end');
    await expect(pending).resolves.toEqual({ status: 200, body: { share: {} } });
    expect(h.spy).toHaveBeenCalledWith(
      {
        hostname: 'backend-api-production-cbfa.up.railway.app',
        port: 443,
        method: 'GET',
        path: `/api/v1/assets/shares/${token}`,
        headers: { Accept: 'application/json' },
      },
      expect.any(Function)
    );
    expect(h.spy).toHaveBeenCalledTimes(1);
  });
  it('enforces a total request deadline and destroys the socket', async () => {
    jest.useFakeTimers();
    const h = transport();
    const pending = expect(get(token)).rejects.toThrow('Rejected');
    jest.advanceTimersByTime(5000);
    await pending;
    expect(h.request.destroy).toHaveBeenCalledTimes(1);
  });
  it('rejects oversize response data and destroys the socket', async () => {
    const h = transport();
    const pending = expect(get(token)).rejects.toThrow('Rejected');
    h.response.emit('data', Buffer.alloc(1024 * 1024 + 1));
    await pending;
    expect(h.request.destroy).toHaveBeenCalledTimes(1);
  });
  it.each(['aborted', 'error'])('rejects interrupted responses: %s', async (event) => {
    const h = transport();
    const pending = expect(get(token)).rejects.toThrow('Rejected');
    h.response.emit(event, new Error(token));
    await pending;
  });
  it('rejects invalid JSON without leaking content', async () => {
    const h = transport();
    const pending = expect(get(token)).rejects.toThrow('Rejected');
    h.response.emit('data', Buffer.from(token));
    h.response.emit('end');
    await pending;
  });
});

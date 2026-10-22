import { createCipheriv, createHash, randomBytes } from 'crypto';
import {
  decryptAssetShareToken,
  classifyAssetShareToken,
  encryptAssetShareToken,
  hashAssetShareToken,
  verifiedAssetShareToken,
} from '../../src/services/asset-share-crypto';
const key = '11'.repeat(32);
const legacySecret = 'synthetic-retained-auth-secret';
const token = randomBytes(32).toString('base64url');
const legacy = () => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256').update(legacySecret).digest(),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(token), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};
it('new dedicated ciphertext survives auth-secret changes and uses randomized authenticated envelopes', () => {
  const first = encryptAssetShareToken(token, { key, legacySecret });
  expect(first).toMatch(/^v2:/);
  expect(encryptAssetShareToken(token, { key })).not.toBe(first);
  expect(
    verifiedAssetShareToken(first, hashAssetShareToken(token), {
      key,
      legacySecret: 'rotated-auth-secret',
    })
  ).toBe(token);
  expect(decryptAssetShareToken(first, { key: '22'.repeat(32) })).toBeUndefined();
  expect(
    decryptAssetShareToken(first.replace('v2:', 'v1:'), { legacySecret: key })
  ).toBeUndefined();
});
it('legacy ciphertext remains readable with dedicated key enabled and explicitly retained legacy secret', () => {
  expect(verifiedAssetShareToken(legacy(), hashAssetShareToken(token), { key, legacySecret })).toBe(
    token
  );
  expect(decryptAssetShareToken(legacy(), { key })).toBeUndefined();
});
it.each([undefined, '', 'short', 'AA'.repeat(32), '11'.repeat(31), '11'.repeat(33)])(
  'new writes reject missing or malformed dedicated key',
  (invalid) => {
    expect(() => encryptAssetShareToken(token, { key: invalid })).toThrow(
      'Asset share encryption unavailable'
    );
  }
);
it.each([null, '', 'v3:a:b:c', 'v2:a:b:c', 'v2:_:_:_', 'v1:a:b:c:extra', 'x'.repeat(257)])(
  'unknown or malformed ciphertext fails closed',
  (value) => {
    expect(decryptAssetShareToken(value, { key, legacySecret })).toBeUndefined();
  }
);
it('corruption and stored-hash mismatch never yield a URL token', () => {
  const value = encryptAssetShareToken(token, { key });
  const parts = value.split(':');
  parts[2] = Buffer.alloc(16).toString('base64url');
  expect(decryptAssetShareToken(parts.join(':'), { key })).toBeUndefined();
  expect(verifiedAssetShareToken(value, '00'.repeat(32), { key })).toBeUndefined();
  expect(verifiedAssetShareToken(value, 'not-a-hash', { key })).toBeUndefined();
});

it('classifies all validation failures using the same acceptance path as token retrieval', () => {
  const current = encryptAssetShareToken(token, { key });
  const hash = hashAssetShareToken(token);
  const damaged = current.split(':');
  damaged[2] = Buffer.alloc(16).toString('base64url');
  const cases: Array<
    [string | null | undefined, string, { key?: string; legacySecret?: string }, string]
  > = [
    [null, hash, { key }, 'missingCipher'],
    [undefined, hash, { key }, 'missingCipher'],
    ['', hash, { key }, 'missingCipher'],
    ['v9:a:b:c', hash, { key }, 'unknownFormat'],
    ['v2:a:b:c', hash, { key }, 'malformedEnvelope'],
    [current + ':extra', hash, { key }, 'malformedEnvelope'],
    [damaged.join(':'), hash, { key }, 'decryptFailed'],
    [current, hash, { key: '22'.repeat(32) }, 'decryptFailed'],
    [legacy(), hash, { key }, 'decryptFailed'],
    [current, 'invalid-private-canary', { key }, 'invalidHash'],
    [current, '00'.repeat(32), { key }, 'hashMismatch'],
    [legacy(), hash, { key, legacySecret }, 'validLegacy'],
    [current, hash, { key }, 'validCurrent'],
  ];
  for (const [cipher, storedHash, config, category] of cases) {
    const result = classifyAssetShareToken(cipher, storedHash, config);
    expect(result.category).toBe(category);
    const expected = category === 'validLegacy' || category === 'validCurrent' ? token : undefined;
    expect(verifiedAssetShareToken(cipher, storedHash, config)).toBe(expected);
    if (expected === undefined) expect(result).toEqual({ category });
  }
});

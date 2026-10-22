import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';

export type AssetShareKeys = { key?: string; legacySecret?: string };
const aad = Buffer.from('tixmo:asset-folder-share:v2', 'utf8');
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const hashAssetShareToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const validAssetShareKey = (key?: string) =>
  typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);

export function encryptAssetShareToken(token: string, keys: AssetShareKeys): string {
  if (!validAssetShareKey(keys.key) || !tokenPattern.test(token))
    throw new Error('Asset share encryption unavailable');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keys.key!, 'hex'), iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [
    'v2',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export type AssetShareCategory =
  | 'missingCipher'
  | 'unknownFormat'
  | 'malformedEnvelope'
  | 'decryptFailed'
  | 'invalidHash'
  | 'hashMismatch'
  | 'validLegacy'
  | 'validCurrent';
export type AssetShareValidationSummary = {
  scanned: number;
  scope: 'all' | 'organization';
} & Record<AssetShareCategory | 'hashOnly', number>;
export class AssetShareValidationError extends Error {
  readonly #summary: Readonly<AssetShareValidationSummary>;
  constructor(summary: AssetShareValidationSummary) {
    super('Asset share rekey verification failed');
    this.#summary = Object.freeze({ ...summary });
  }
  get summary() {
    return this.#summary;
  }
}
type ValidToken = { category: 'validLegacy' | 'validCurrent'; token: string };
type CipherResult =
  | ValidToken
  | { category: 'missingCipher' | 'unknownFormat' | 'malformedEnvelope' | 'decryptFailed' };
export type AssetShareValidation = CipherResult | { category: 'invalidHash' | 'hashMismatch' };
function inspectCipher(value: string | null | undefined, keys: AssetShareKeys): CipherResult {
  if (value === null || value === undefined || value === '') return { category: 'missingCipher' };
  if (typeof value !== 'string' || value.length > 256) return { category: 'malformedEnvelope' };
  const parts = value.split(':');
  if (parts.length !== 4) return { category: 'malformedEnvelope' };
  const [version, ivValue, tagValue, encryptedValue] = parts;
  if (!['v1', 'v2'].includes(version)) return { category: 'unknownFormat' };
  const values = [ivValue, tagValue, encryptedValue];
  if (values.some((part) => !/^[A-Za-z0-9_-]+$/.test(part)))
    return { category: 'malformedEnvelope' };
  const [iv, tag, encrypted] = values.map((part) => Buffer.from(part, 'base64url'));
  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    encrypted.length !== 43 ||
    values.some((part, index) => [iv, tag, encrypted][index].toString('base64url') !== part)
  )
    return { category: 'malformedEnvelope' };
  if (version === 'v2' ? !validAssetShareKey(keys.key) : !keys.legacySecret)
    return { category: 'decryptFailed' };
  try {
    const key =
      version === 'v2'
        ? Buffer.from(keys.key!, 'hex')
        : createHash('sha256').update(keys.legacySecret!).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    if (version === 'v2') decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return tokenPattern.test(token)
      ? { category: version === 'v1' ? 'validLegacy' : 'validCurrent', token }
      : { category: 'decryptFailed' };
  } catch {
    return { category: 'decryptFailed' };
  }
}
export function decryptAssetShareToken(
  value: string | null | undefined,
  keys: AssetShareKeys
): string | undefined {
  const result = inspectCipher(value, keys);
  return 'token' in result ? result.token : undefined;
}
export function classifyAssetShareToken(
  value: string | null | undefined,
  hash: string,
  keys: AssetShareKeys
): AssetShareValidation {
  const result = inspectCipher(value, keys);
  if (!('token' in result)) return result;
  if (!/^[a-f0-9]{64}$/.test(hash)) return { category: 'invalidHash' };
  return timingSafeEqual(
    Buffer.from(hashAssetShareToken(result.token), 'hex'),
    Buffer.from(hash, 'hex')
  )
    ? result
    : { category: 'hashMismatch' };
}
export function verifiedAssetShareToken(
  value: string | null | undefined,
  hash: string,
  keys: AssetShareKeys
): string | undefined {
  const result = classifyAssetShareToken(value, hash, keys);
  return 'token' in result ? result.token : undefined;
}

// Operator policy only: this does not recover or cryptographically verify a bearer.
export function classifyAssetShareForRekey(
  value: string | null | undefined,
  hash: string,
  keys: AssetShareKeys,
  preserveHashOnly = false
): AssetShareValidation | { category: 'hashOnly' } {
  if (preserveHashOnly === true && value === null) {
    return typeof hash === 'string' && hash.length === 64 && /^[a-f0-9]{64}$/.test(hash)
      ? { category: 'hashOnly' }
      : { category: 'invalidHash' };
  }
  return classifyAssetShareToken(value, hash, keys);
}

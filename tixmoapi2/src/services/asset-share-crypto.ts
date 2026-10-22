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

export function decryptAssetShareToken(
  value: string | null | undefined,
  keys: AssetShareKeys
): string | undefined {
  if (typeof value !== 'string' || value.length > 256) return undefined;
  const parts = value.split(':');
  if (parts.length !== 4) return undefined;
  const [version, ivValue, tagValue, encryptedValue] = parts;
  if (!['v1', 'v2'].includes(version)) return undefined;
  const values = [ivValue, tagValue, encryptedValue];
  if (values.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return undefined;
  const [iv, tag, encrypted] = values.map((part) => Buffer.from(part, 'base64url'));
  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    encrypted.length !== 43 ||
    values.some((part, index) => [iv, tag, encrypted][index].toString('base64url') !== part)
  )
    return undefined;
  if (version === 'v2' ? !validAssetShareKey(keys.key) : !keys.legacySecret) return undefined;
  try {
    const key =
      version === 'v2'
        ? Buffer.from(keys.key!, 'hex')
        : createHash('sha256').update(keys.legacySecret!).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    if (version === 'v2') decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return tokenPattern.test(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

export function verifiedAssetShareToken(
  value: string | null | undefined,
  hash: string,
  keys: AssetShareKeys
): string | undefined {
  const token = decryptAssetShareToken(value, keys);
  if (!token || !/^[a-f0-9]{64}$/.test(hash)) return undefined;
  return timingSafeEqual(Buffer.from(hashAssetShareToken(token), 'hex'), Buffer.from(hash, 'hex'))
    ? token
    : undefined;
}

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError';

const AAD = Buffer.from('tixmo:vendor-credential:v1', 'utf8');

export const vendorCredentialKey = (): Buffer => {
  const raw = process.env.VENDOR_CREDENTIAL_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/.test(raw)) {
    throw new ApiError(503, 'Vendor credential encryption is unavailable');
  }
  return Buffer.from(raw, 'hex');
};

/** AES-256-GCM envelope. The API key is never returned to clients or logs. */
export const encryptVendorSecret = (plaintext: string, key = vendorCredentialKey()): string => {
  if (!plaintext) throw new Error('Vendor secret is empty');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};

export const decryptVendorSecret = (envelope: string, key = vendorCredentialKey()): string => {
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Vendor credential could not be read');
  }
  const [iv, tag, encrypted] = parts.slice(1).map((part) => Buffer.from(part, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Vendor credential could not be read');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

export const secretLast4 = (secret: string): string => secret.slice(-4);

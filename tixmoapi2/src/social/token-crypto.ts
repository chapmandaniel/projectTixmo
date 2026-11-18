import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'crypto';

export class SocialTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialTokenError';
  }
}

export type TokenKind = 'sandbox' | 'live';

export interface TokenContext {
  organizationId: string;
  connectionId: string;
  tokenKind: TokenKind;
}

export interface KeyMaterial {
  keyId: string;
  raw: Buffer;
}

export interface KeyRing {
  current: KeyMaterial;
  previous?: KeyMaterial;
}

const SALT = Buffer.from('tixmo/social-token/v1');
const AES_INFO = 'tixmo/social-token/aes';
const LOOKUP_INFO = 'tixmo/social-token/lookup';

export const parseSocialRootKey = (value: string, label: string): Buffer => {
  const trimmed = value.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  }
  throw new SocialTokenError(`${label} must be 32 bytes, as 64 hex characters or standard base64.`);
};

const material = (value: string, label: string): KeyMaterial => {
  const raw = parseSocialRootKey(value, label);
  return { keyId: createHash('sha256').update(raw).digest('hex').slice(0, 8), raw };
};

export const loadKeyRing = (env: NodeJS.ProcessEnv = process.env): KeyRing => {
  const current = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!current?.trim()) throw new SocialTokenError('SOCIAL_TOKEN_ENCRYPTION_KEY is missing.');
  const previous = env.SOCIAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  return {
    current: material(current, 'SOCIAL_TOKEN_ENCRYPTION_KEY'),
    previous: previous?.trim()
      ? material(previous, 'SOCIAL_TOKEN_ENCRYPTION_KEY_PREVIOUS')
      : undefined,
  };
};

const derive = (raw: Buffer, info: string): Buffer =>
  Buffer.from(hkdfSync('sha256', raw, SALT, Buffer.from(info), 32));

export const socialTokenAad = (context: TokenContext): Buffer => {
  if (!context.organizationId || !context.connectionId) {
    throw new SocialTokenError('Token context is incomplete.');
  }
  if (context.tokenKind !== 'sandbox' && context.tokenKind !== 'live') {
    throw new SocialTokenError('Token kind is invalid.');
  }
  return Buffer.from(
    `tixmo:social-token:v1|${context.organizationId}|${context.connectionId}|${context.tokenKind}`
  );
};

export const encryptSocialToken = (
  plaintext: string,
  context: TokenContext,
  ring: KeyRing
): string => {
  if (!plaintext) throw new SocialTokenError('Token is empty.');
  const key = derive(ring.current.raw, AES_INFO);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(socialTokenAad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    ring.current.keyId,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

export const decryptSocialToken = (
  envelope: string,
  context: TokenContext,
  ring: KeyRing
): string => {
  const parts = envelope.split(':');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new SocialTokenError('Token envelope could not be read.');
  }
  const keyId = parts[1];
  const selected =
    keyId === ring.current.keyId
      ? ring.current
      : ring.previous && keyId === ring.previous.keyId
        ? ring.previous
        : null;
  if (!selected) throw new SocialTokenError('Token envelope could not be read.');
  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const data = Buffer.from(parts[4], 'base64url');
  if (iv.length !== 12 || tag.length !== 16) {
    throw new SocialTokenError('Token envelope could not be read.');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', derive(selected.raw, AES_INFO), iv);
    decipher.setAAD(socialTokenAad(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof SocialTokenError) throw error;
    throw new SocialTokenError('Token envelope could not be read.');
  }
};

export const tokenLookupHmac = (plaintext: string, ring: KeyRing): string =>
  createHmac('sha256', derive(ring.current.raw, LOOKUP_INFO)).update(plaintext).digest('hex');

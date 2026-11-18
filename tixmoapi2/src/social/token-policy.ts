import { assertSandboxGraphUrl } from './graph-guard';
import {
  encryptSocialToken,
  loadKeyRing,
  tokenLookupHmac,
  SocialTokenError,
  type KeyRing,
  type TokenKind,
} from './token-crypto';

export type TokenShape = 'sandbox' | 'real' | 'invalid';

export const tokenShape = (token: string): TokenShape => {
  const value = token.trim();
  if (/^(?:EAA|IG[A-Za-z0-9])/.test(value) || /^[A-Za-z0-9]+\|[A-Za-z0-9._~+/-]+$/.test(value)) {
    return 'real';
  }
  if (/^sbx_[A-Za-z0-9_-]+$/.test(value)) return 'sandbox';
  return 'invalid';
};

export interface StoredSocialConnection {
  id: string;
  organizationId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'NEEDS_ATTENTION';
  tokenKind: TokenKind;
  tokenCiphertext: string | null;
  refreshCiphertext: string | null;
  lookupHmac: string | null;
  graphBaseUrl: string | null;
}

export const sealSandboxToken = (input: {
  token: string;
  organizationId: string;
  connectionId: string;
  tokenKind: TokenKind;
  graphBaseUrl: string;
  ring?: KeyRing;
}): {
  ciphertext: string;
  keyId: string;
  lookupHmac: string;
  tokenKind: 'sandbox';
  graphBaseUrl: string;
} => {
  if (input.tokenKind !== 'sandbox') {
    throw new SocialTokenError('Live tokens are refused in the sandbox environment.');
  }
  const shape = tokenShape(input.token);
  if (shape === 'real') throw new SocialTokenError('Real-looking Meta token refused.');
  if (shape !== 'sandbox') throw new SocialTokenError('Sandbox token refused.');
  const url = assertSandboxGraphUrl(input.graphBaseUrl);
  const ring = input.ring || loadKeyRing();
  const context = {
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    tokenKind: 'sandbox' as const,
  };
  const ciphertext = encryptSocialToken(input.token.trim(), context, ring);
  return {
    ciphertext,
    keyId: ring.current.keyId,
    lookupHmac: tokenLookupHmac(input.token.trim(), ring),
    tokenKind: 'sandbox',
    graphBaseUrl: url.origin,
  };
};

/** Disconnect overwrites the secret fields. The caller deletes the row's ciphertext. */
export const disconnectConnection = (row: StoredSocialConnection): StoredSocialConnection => ({
  ...row,
  status: 'DISCONNECTED',
  tokenCiphertext: null,
  refreshCiphertext: null,
  lookupHmac: null,
});

import { createHmac, timingSafeEqual } from 'crypto';

/** Documented Showpass webhook signature: HMAC-SHA1 of the payload id field. */
export const showpassSignature = (payloadId: string, secret: string): string =>
  createHmac('sha1', secret).update(payloadId, 'utf8').digest('hex');

export const showpassSignaturesMatch = (
  expected: string,
  received: string | undefined
): boolean => {
  if (!received || !/^[a-f0-9]+$/i.test(received) || !/^[a-f0-9]+$/i.test(expected)) return false;
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(received, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

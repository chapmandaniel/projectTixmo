import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

/**
 * Missing header keeps the historical create-every-time behavior.
 * A present but unusable header is a client error, not a silent bypass.
 */
export function normalizeOrderIdempotencyKey(header: string | undefined): string | null {
  if (header == null) return null;
  if (!KEY_PATTERN.test(header)) {
    throw ApiError.badRequest('Idempotency-Key must be 1-255 printable ASCII characters', {
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }
  return header;
}

/** Fingerprint of the validated body, in the order the client submitted it. */
export function hashOrderRequest(data: {
  items: Array<{ ticketTypeId: string; quantity: number }>;
  promoCode?: string;
}): string {
  const payload = JSON.stringify({
    items: data.items.map((item) => ({
      ticketTypeId: item.ticketTypeId,
      quantity: item.quantity,
    })),
    promoCode: data.promoCode ?? null,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Any unique violation in the idempotent transaction is treated as the key
 * conflict when that buyer's row is visible. The claim and the order commit
 * together, so an unrelated unique failure rolls the claim back and is rethrown.
 */
export function isOrderIdempotencyConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

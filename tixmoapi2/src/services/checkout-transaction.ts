import { Prisma } from '@prisma/client';
import { config } from '../config/environment';
import { ApiError } from '../utils/ApiError';

const DEFAULT_MAX_WAIT_MS = 2000;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_LOCK_TIMEOUT_MS = 2000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 4000;

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Prisma's interactive-transaction timer covers the COMMIT as well as the
 * callback. Under CPU saturation the 15s timer was firing as COMMIT landed, so
 * Postgres kept the order and the handler still answered 500. The statement
 * limit stays inside the Prisma timeout so a stuck statement is cancelled by
 * the database, which rolls the open transaction back, before that race.
 */
export function checkoutTransactionOptions(): { maxWait: number; timeout: number } {
  return {
    maxWait: positive(config.checkoutTxMaxWaitMs, DEFAULT_MAX_WAIT_MS),
    timeout: positive(config.checkoutTxTimeoutMs, DEFAULT_TIMEOUT_MS),
  };
}

export function checkoutDbLimits(): { lockTimeoutMs: number; statementTimeoutMs: number } {
  const timeout = checkoutTransactionOptions().timeout;
  const statement = Math.min(
    positive(config.checkoutStatementTimeoutMs, DEFAULT_STATEMENT_TIMEOUT_MS),
    Math.max(1, timeout - 500)
  );
  const lock = Math.min(positive(config.checkoutLockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS), statement);
  return { lockTimeoutMs: lock, statementTimeoutMs: statement };
}

/**
 * SET LOCAL via set_config. It lasts for this transaction only, so a pooled
 * connection cannot leak the limit into the next request. lock_timeout and
 * statement_timeout are ordinary Postgres settings (including PostgreSQL 14)
 * and are safe on a direct connection or a transaction-pinned Prisma session.
 */
export async function applyCheckoutDbLimits(tx: Prisma.TransactionClient): Promise<void> {
  const limits = checkoutDbLimits();
  await tx.$queryRaw`SELECT set_config('lock_timeout', ${String(limits.lockTimeoutMs)}, true), set_config('statement_timeout', ${String(limits.statementTimeoutMs)}, true)`;
}

export function checkoutBusyError(): ApiError {
  return ApiError.busy('Checkout is busy. Please try again.', 'CHECKOUT_BUSY', 2);
}

export function rethrowUnlessCheckoutBusy(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (isCheckoutBusyError(error)) throw checkoutBusyError();
  throw error;
}

/**
 * Client-side transaction failures that mean the work did not get a clean
 * commit acknowledgement. Validation errors are ApiError and are not included.
 */
export function isCheckoutBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const timedOut =
    /Transaction already closed|Transaction not found|Transaction API error|expired transaction|lock timeout|statement timeout|canceling statement due to|Unable to start a transaction/i.test(
      message
    );
  if (timedOut) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2028' || error.code === 'P2034';
  }
  return false;
}

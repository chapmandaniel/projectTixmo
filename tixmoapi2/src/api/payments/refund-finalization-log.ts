import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { getRefundActor, nextRefundAttempt, takeRefundSubject } from './refund-actor';
import type { RefundActorStore } from './refund-actor';
import {
  REFUND_FINALIZE_EVENT,
  REFUND_RECOVERY_TICK_EVENT,
  instanceId,
  releaseLabel,
  safeInvocationId,
  safeProviderRefundId,
  safeUuid,
  type RefundFinalizeLine,
  type RefundFinalizeOutcome,
  type RefundFinalizeReason,
  type RefundRecoveryTickLine,
} from './refund-log-format';

const ACTORS = new Set(['scheduler', 'webhook', 'staff']);
const SUBPATHS = new Set(['startup', 'interval', 'webhook_replay']);

export function classifyRefundFinalizeError(error: unknown): {
  outcome: 'refused' | 'error';
  reason: RefundFinalizeReason;
} {
  if (
    error instanceof ApiError &&
    error.statusCode === 404 &&
    error.message === 'Order not found'
  ) {
    return { outcome: 'refused', reason: 'not_found' };
  }
  if (
    error instanceof ApiError &&
    error.statusCode === 409 &&
    error.message === 'Order is not paid'
  ) {
    return { outcome: 'refused', reason: 'order_not_paid' };
  }
  if (
    error instanceof ApiError &&
    error.statusCode === 409 &&
    error.message === 'Processor refund has not been confirmed'
  ) {
    return { outcome: 'refused', reason: 'processor_refund_not_confirmed' };
  }
  return { outcome: 'error', reason: 'exception' };
}

function actorOf(store: RefundActorStore | undefined): RefundFinalizeLine['actor'] {
  if (store && ACTORS.has(store.actor)) return store.actor;
  return 'unknown';
}

function subpathOf(store: RefundActorStore | undefined): RefundFinalizeLine['subpath'] {
  if (store?.subpath && SUBPATHS.has(store.subpath)) return store.subpath;
  return null;
}

function buildFinalizeLine(input: {
  orderId: string;
  outcome: RefundFinalizeOutcome;
  reason: RefundFinalizeReason | null;
  startedAt: Date;
  finishedAt: Date;
}): RefundFinalizeLine {
  const store = getRefundActor();
  const attempt = nextRefundAttempt();
  const subject = takeRefundSubject();
  const reason = input.outcome === 'refused' || input.outcome === 'error' ? input.reason : null;
  return {
    level: 'info',
    event: REFUND_FINALIZE_EVENT,
    message: REFUND_FINALIZE_EVENT,
    actor: actorOf(store),
    subpath: subpathOf(store),
    invocationId: safeInvocationId(store?.invocationId),
    orderId: safeUuid(input.orderId),
    refundId: safeUuid(subject.refundId),
    providerRefundId: safeProviderRefundId(subject.providerRefundId),
    attempt,
    outcome: input.outcome,
    reason,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
    release: releaseLabel(),
    pid: process.pid,
    instanceId: instanceId(),
  };
}

// Emitted only by the caller, after the database transaction has settled.
// A thrown logger or a bad payload must not change the refund result.
export function logRefundFinalize(input: {
  orderId: string;
  outcome: RefundFinalizeOutcome;
  reason: RefundFinalizeReason | null;
  startedAt: Date;
}): void {
  try {
    const line = buildFinalizeLine({ ...input, finishedAt: new Date() });
    logger.info(line.message, { structuredPayload: line });
  } catch {
    // Observability is best-effort. Finalization already settled.
  }
}

export function logRefundRecoveryTick(store: RefundActorStore): void {
  try {
    if (store.actor !== 'scheduler') return;
    if (store.subpath !== 'startup' && store.subpath !== 'interval') return;
    const count = store.scan.candidateCount;
    const line: RefundRecoveryTickLine = {
      level: 'info',
      event: REFUND_RECOVERY_TICK_EVENT,
      message: REFUND_RECOVERY_TICK_EVENT,
      actor: 'scheduler',
      subpath: store.subpath,
      invocationId: safeInvocationId(store.invocationId),
      candidateCount:
        typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null,
      release: releaseLabel(),
      pid: process.pid,
      instanceId: instanceId(),
      at: new Date().toISOString(),
    };
    logger.info(line.message, { structuredPayload: line });
  } catch {
    // A tick log must not stick the scheduler overlap guard.
  }
}

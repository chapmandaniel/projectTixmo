// One JSON object per line, with no ANSI prefix, so Railway can index each
// field with @attr:value. Other log lines keep the existing text format.

export const REFUND_FINALIZE_EVENT = 'refund.finalize';
export const REFUND_RECOVERY_TICK_EVENT = 'refund.recovery.tick';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIPE_EVENT_ID = /^evt_[A-Za-z0-9]+$/;
const STRIPE_REFUND_ID = /^re_[A-Za-z0-9]+$/;
const RELEASE_LABEL = /^[A-Za-z0-9._:-]{1,128}$/;
const INSTANCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const FINALIZE_KEYS = [
  'level',
  'event',
  'message',
  'actor',
  'subpath',
  'invocationId',
  'orderId',
  'refundId',
  'providerRefundId',
  'attempt',
  'outcome',
  'reason',
  'startedAt',
  'finishedAt',
  'durationMs',
  'release',
  'pid',
  'instanceId',
] as const;

const TICK_KEYS = [
  'level',
  'event',
  'message',
  'actor',
  'subpath',
  'invocationId',
  'candidateCount',
  'release',
  'pid',
  'instanceId',
  'at',
] as const;

export type RefundFinalizeOutcome = 'committed' | 'noop_already_refunded' | 'refused' | 'error';
export type RefundFinalizeReason =
  | 'not_found'
  | 'order_not_paid'
  | 'processor_refund_not_confirmed'
  | 'refund_not_covering'
  | 'exception';

export type RefundFinalizeLine = {
  level: 'info';
  event: typeof REFUND_FINALIZE_EVENT;
  message: typeof REFUND_FINALIZE_EVENT;
  actor: 'scheduler' | 'webhook' | 'staff' | 'unknown';
  subpath: 'startup' | 'interval' | 'webhook_replay' | null;
  invocationId: string | null;
  orderId: string | null;
  refundId: string | null;
  providerRefundId: string | null;
  attempt: number;
  outcome: RefundFinalizeOutcome;
  reason: RefundFinalizeReason | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  release: string | null;
  pid: number;
  instanceId: string | null;
};

export type RefundRecoveryTickLine = {
  level: 'info';
  event: typeof REFUND_RECOVERY_TICK_EVENT;
  message: typeof REFUND_RECOVERY_TICK_EVENT;
  actor: 'scheduler';
  subpath: 'startup' | 'interval';
  invocationId: string | null;
  candidateCount: number | null;
  release: string | null;
  pid: number;
  instanceId: string | null;
  at: string;
};

export function safeUuid(value: string | null | undefined): string | null {
  if (!value || !UUID.test(value)) return null;
  return value.toLowerCase();
}

export function safeInvocationId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (UUID.test(value)) return value.toLowerCase();
  if (STRIPE_EVENT_ID.test(value)) return value;
  return null;
}

export function safeProviderRefundId(value: string | null | undefined): string | null {
  if (!value || !STRIPE_REFUND_ID.test(value)) return null;
  return value;
}

export function releaseLabel(): string | null {
  const value = process.env.RELEASE;
  if (!value || !RELEASE_LABEL.test(value)) return null;
  return value;
}

export function instanceId(): string | null {
  const value = process.env.RAILWAY_REPLICA_ID;
  if (!value || !INSTANCE_ID.test(value)) return null;
  return value;
}

export function isRefundFinalizeLine(value: unknown): value is RefundFinalizeLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  if (line.event !== REFUND_FINALIZE_EVENT || line.message !== REFUND_FINALIZE_EVENT) return false;
  return Object.keys(line).every((key) => (FINALIZE_KEYS as readonly string[]).includes(key));
}

export function isRefundRecoveryTickLine(value: unknown): value is RefundRecoveryTickLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  if (line.event !== REFUND_RECOVERY_TICK_EVENT || line.message !== REFUND_RECOVERY_TICK_EVENT) {
    return false;
  }
  return Object.keys(line).every((key) => (TICK_KEYS as readonly string[]).includes(key));
}

export function formatLogLine(info: {
  timestamp?: unknown;
  level?: unknown;
  message?: unknown;
  structuredPayload?: unknown;
}): string {
  const payload = info.structuredPayload;
  if (isRefundFinalizeLine(payload) || isRefundRecoveryTickLine(payload)) {
    return JSON.stringify(payload);
  }
  return `${String(info.timestamp)} ${String(info.level)}: ${String(info.message)}`;
}

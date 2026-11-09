import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

// Trusted in-process context only. Entry points create these stores.
// Request bodies must never supply actor, subpath, or invocation id.
export type RefundActorName = 'scheduler' | 'webhook' | 'staff';
export type RefundSubpath = 'startup' | 'interval' | 'webhook_replay';

export type RefundActorStore = {
  actor: RefundActorName;
  subpath: RefundSubpath | null;
  invocationId: string;
  counters: { attempt: number };
  subject: { refundId: string | null; providerRefundId: string | null };
  scan: { candidateCount: number | null };
};

const storage = new AsyncLocalStorage<RefundActorStore>();

const freshStore = (
  actor: RefundActorName,
  subpath: RefundSubpath | null,
  invocationId: string,
  shared?: Pick<RefundActorStore, 'counters' | 'scan'>
): RefundActorStore => ({
  actor,
  subpath,
  invocationId,
  counters: shared?.counters ?? { attempt: 0 },
  subject: { refundId: null, providerRefundId: null },
  scan: shared?.scan ?? { candidateCount: null },
});

export function schedulerRefundStore(subpath: 'startup' | 'interval'): RefundActorStore {
  return freshStore('scheduler', subpath, randomUUID());
}

export function webhookRefundStore(eventId: string): RefundActorStore {
  return freshStore('webhook', null, eventId);
}

export function staffRefundStore(): RefundActorStore {
  return freshStore('staff', null, randomUUID());
}

// Scheduled recovery keeps the tick's invocation and is not a delivered webhook.
export function schedulerWebhookReplayStore(parent: RefundActorStore): RefundActorStore {
  return freshStore('scheduler', 'webhook_replay', parent.invocationId, {
    counters: parent.counters,
    scan: parent.scan,
  });
}

export function getRefundActor(): RefundActorStore | undefined {
  return storage.getStore();
}

export function runWithRefundActor<T>(store: RefundActorStore, work: () => T): T {
  return storage.run(store, work);
}

export function setRefundSubject(refundId: string | null, providerRefundId: string | null): void {
  const store = storage.getStore();
  if (!store) return;
  store.subject = { refundId, providerRefundId };
}

export function takeRefundSubject(): { refundId: string | null; providerRefundId: string | null } {
  const store = storage.getStore();
  if (!store) return { refundId: null, providerRefundId: null };
  const subject = store.subject;
  store.subject = { refundId: null, providerRefundId: null };
  return subject;
}

export function nextRefundAttempt(): number {
  const store = storage.getStore();
  if (!store) return 1;
  store.counters.attempt += 1;
  return store.counters.attempt;
}

// Only the scheduler's own refund-row scan records the tick's candidate count.
// A webhook, or a stored-webhook replay nested under the scheduler, must not.
export function noteSchedulerRefundCandidates(count: number): void {
  const store = storage.getStore();
  if (!store || store.actor !== 'scheduler') return;
  if (store.subpath !== 'startup' && store.subpath !== 'interval') return;
  if (!Number.isInteger(count) || count < 0) return;
  store.scan.candidateCount = count;
}

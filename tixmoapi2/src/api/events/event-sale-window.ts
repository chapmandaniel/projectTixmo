// Buyer sale timing for a public event. Instants are compared to the server
// clock. The event timezone is display-only and never shifts these bounds.
// Scanning, refunds, and payment recovery keep their own clocks.

export const EVENT_ENDED_CODE = 'EVENT_ENDED';
export const EVENT_UNDATED_CODE = 'EVENT_UNDATED';
export const EVENT_ENDED_MESSAGE = 'This event has ended.';
export const EVENT_UNDATED_MESSAGE = "This event isn't open for sale yet.";

export interface EventSaleTimingInput {
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
}

export interface EventSaleTiming {
  ended: boolean;
  undated: boolean;
}

const instantMillis = (value: Date | string | null | undefined): number | null => {
  if (value == null || value === '') return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

/**
 * Undated: no start instant at all.
 * Ended: the end instant has passed, or there is no end instant and the start
 * instant has passed. A start that has passed while the end is still ahead is
 * in progress, not ended. Equality counts as passed, matching sales windows.
 */
export const eventSaleTiming = (
  event: EventSaleTimingInput,
  now: Date = new Date()
): EventSaleTiming => {
  const start = instantMillis(event.startDatetime);
  const end = instantMillis(event.endDatetime);
  const nowMs = now.getTime();
  const undated = start === null;
  const ended =
    (end !== null && nowMs >= end) || (end === null && start !== null && nowMs >= start);
  return { ended, undated };
};

/**
 * Buyer-facing flags for a public event payload.
 * A draft is not on sale yet, including when dates are filled in or already
 * past. Those links use the undated notice instead of an ended event or a 404.
 * Published, on-sale, and sold-out events keep the clock comparison above.
 */
export const withEventSaleTiming = <T extends EventSaleTimingInput & { status?: string | null }>(
  event: T,
  now: Date = new Date()
): T & EventSaleTiming => ({
  ...event,
  ...(event.status === 'DRAFT' ? { ended: false, undated: true } : eventSaleTiming(event, now)),
});

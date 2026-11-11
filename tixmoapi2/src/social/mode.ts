export type ThresholdMode = 'NORMAL' | 'ON_SALE_DAY' | 'EVENT_DAY';

export const MODE_ORDER: readonly ThresholdMode[] = ['EVENT_DAY', 'ON_SALE_DAY', 'NORMAL'];

export interface ModeThreshold {
  multiplier: number;
  minComments: number;
  windowMinutes: number;
  unansweredMinutes: number;
}

export const DEFAULT_MODE_THRESHOLDS: Record<ThresholdMode, ModeThreshold> = {
  NORMAL: { multiplier: 3, minComments: 10, windowMinutes: 60, unansweredMinutes: 4 * 60 },
  ON_SALE_DAY: { multiplier: 2, minComments: 5, windowMinutes: 60, unansweredMinutes: 60 },
  EVENT_DAY: { multiplier: 1.5, minComments: 3, windowMinutes: 15, unansweredMinutes: 30 },
};

export interface ModeHold {
  mode: ThresholdMode;
  /** Exclusive instant. At this time the hold has ended. */
  until: string;
}

export interface EventSchedule {
  id: string;
  name: string;
  timezone: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
  salesStart?: string | null;
  ticketTypeSalesStarts?: readonly (string | null | undefined)[];
}

const NAMED_MODES = new Set<string>(MODE_ORDER);

export const isThresholdMode = (value: unknown): value is ThresholdMode =>
  typeof value === 'string' && NAMED_MODES.has(value);

export const zonedParts = (
  instant: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  key: string;
} => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const year = Number(bag.year);
  const month = Number(bag.month);
  const day = Number(bag.day);
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    key,
  };
};

export const shiftDateKey = (key: string, days: number): string => {
  const [year, month, day] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const monthText = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dayText = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${monthText}-${dayText}`;
};

const instant = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const onSaleDateKeys = (event: EventSchedule): string[] => {
  const keys = new Set<string>();
  for (const value of [event.salesStart, ...(event.ticketTypeSalesStarts || [])]) {
    const time = instant(value);
    if (time === null) continue;
    keys.add(zonedParts(new Date(time), event.timezone).key);
  }
  return [...keys];
};

export const automaticMode = (event: EventSchedule, now: Date): ThresholdMode => {
  const start = instant(event.startDatetime);
  const end = instant(event.endDatetime);
  const nowMs = now.getTime();
  if (start !== null && end !== null && nowMs >= start - 6 * 60 * 60 * 1000 && nowMs <= end) {
    return 'EVENT_DAY';
  }
  if (!onSaleDateKeys(event).length) return 'NORMAL';
  const today = zonedParts(now, event.timezone).key;
  return onSaleDateKeys(event).includes(today) ? 'ON_SALE_DAY' : 'NORMAL';
};

export const resolveMode = (
  event: EventSchedule,
  now: Date,
  hold?: ModeHold | null
): { mode: ThresholdMode; source: 'automatic' | 'hold' } => {
  if (hold) {
    if (!isThresholdMode(hold.mode)) {
      throw new Error('Manual holds use NORMAL, ON-SALE DAY, or EVENT DAY.');
    }
    const until = Date.parse(hold.until);
    if (Number.isFinite(until) && now.getTime() < until) {
      return { mode: hold.mode, source: 'hold' };
    }
  }
  return { mode: automaticMode(event, now), source: 'automatic' };
};

export const tightestMode = (
  events: readonly EventSchedule[],
  now: Date,
  holds: Readonly<Record<string, ModeHold | null | undefined>> = {}
): { mode: ThresholdMode; eventId: string | null; eventName: string | null } => {
  let best: { mode: ThresholdMode; eventId: string; eventName: string } | null = null;
  for (const event of events) {
    const resolved = resolveMode(event, now, holds[event.id]);
    if (!best || MODE_ORDER.indexOf(resolved.mode) < MODE_ORDER.indexOf(best.mode)) {
      best = { mode: resolved.mode, eventId: event.id, eventName: event.name };
    }
  }
  return best || { mode: 'NORMAL', eventId: null, eventName: null };
};

export interface EditionRange {
  startMs: number;
  endMs: number;
}

/** Earliest sales or start instant through end, inclusive. Null when the edition cannot be ranged. */
export const editionRange = (event: EventSchedule): EditionRange | null => {
  const end = instant(event.endDatetime);
  if (end === null) return null;
  const starts = [event.salesStart, ...(event.ticketTypeSalesStarts || []), event.startDatetime]
    .map((value) => instant(value))
    .filter((value): value is number => value !== null);
  if (!starts.length) return null;
  return { startMs: Math.min(...starts), endMs: end };
};

export const canOverrideEventMapping = (role: string | null | undefined): boolean =>
  role === 'OWNER' || role === 'ADMIN';

export const resolveEventMapping = (input: {
  postTime: string;
  events: readonly EventSchedule[];
  overrideEventId?: string | null;
}): { eventId: string | null; source: 'override' | 'automatic' | 'unmapped' } => {
  if (input.overrideEventId) {
    return { eventId: input.overrideEventId, source: 'override' };
  }
  const postMs = Date.parse(input.postTime);
  if (!Number.isFinite(postMs)) return { eventId: null, source: 'unmapped' };
  const containing = input.events.filter((event) => {
    const range = editionRange(event);
    return range !== null && postMs >= range.startMs && postMs <= range.endMs;
  });
  if (!containing.length) return { eventId: null, source: 'unmapped' };
  if (containing.length === 1) return { eventId: containing[0].id, source: 'automatic' };
  const ranked = [...containing].sort((left, right) => {
    const leftStart = instant(left.startDatetime);
    const rightStart = instant(right.startDatetime);
    const leftDistance =
      leftStart === null ? Number.POSITIVE_INFINITY : Math.abs(postMs - leftStart);
    const rightDistance =
      rightStart === null ? Number.POSITIVE_INFINITY : Math.abs(postMs - rightStart);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return (rightStart ?? 0) - (leftStart ?? 0);
  });
  return { eventId: ranked[0].id, source: 'automatic' };
};

/** Bucket baseline b. B is comments per hour. EVENT DAY spreads B across four 15-minute buckets. */
export const bucketBaseline = (hourlyBaseline: number, mode: ThresholdMode): number =>
  mode === 'EVENT_DAY' ? hourlyBaseline / 4 : hourlyBaseline;

/** Smallest integer count that satisfies min and multiplier × b. */
export const atLimitCount = (minComments: number, multiplierTimesBaseline: number): number => {
  const bar = Math.max(minComments, multiplierTimesBaseline);
  return Math.ceil(bar - 1e-9);
};

export const waveFires = (
  count: number,
  threshold: ModeThreshold,
  hourlyBaseline: number
): boolean => {
  const baseline = bucketBaseline(
    hourlyBaseline,
    threshold.windowMinutes === 15 ? 'EVENT_DAY' : 'NORMAL'
  );
  return count >= threshold.minComments && count >= threshold.multiplier * baseline;
};

export const waveFiresForMode = (
  count: number,
  mode: ThresholdMode,
  hourlyBaseline: number,
  threshold: ModeThreshold = DEFAULT_MODE_THRESHOLDS[mode]
): boolean => {
  const baseline = bucketBaseline(hourlyBaseline, mode);
  return count >= threshold.minComments && count >= threshold.multiplier * baseline;
};

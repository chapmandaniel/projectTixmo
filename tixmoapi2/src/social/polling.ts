/** Phase 1 configures the cadence and does not poll. */

export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_EVENT_DAY_POLL_INTERVAL_MS = 60 * 1000;
export const DEFAULT_POLL_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_EVENT_DAY_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export interface PollConfig {
  intervalMs: number;
  eventDayIntervalMs: number;
  lookbackMs: number;
  eventDayLookbackMs: number;
}

const positiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
};

export const readPollConfig = (env: NodeJS.ProcessEnv = process.env): PollConfig => ({
  intervalMs: positiveInt(env.SOCIAL_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
  eventDayIntervalMs: positiveInt(
    env.SOCIAL_POLL_EVENT_DAY_INTERVAL_MS,
    DEFAULT_EVENT_DAY_POLL_INTERVAL_MS
  ),
  lookbackMs: positiveInt(env.SOCIAL_POLL_LOOKBACK_MS, DEFAULT_POLL_LOOKBACK_MS),
  eventDayLookbackMs: positiveInt(
    env.SOCIAL_POLL_EVENT_DAY_LOOKBACK_MS,
    DEFAULT_EVENT_DAY_LOOKBACK_MS
  ),
});

export interface PollPlan {
  intervalMs: number;
  lookbackMs: number;
  postsSince: string;
  nextPollAt: string;
  running: false;
}

export const planPoll = (
  config: PollConfig,
  mode: 'NORMAL' | 'ON_SALE_DAY' | 'EVENT_DAY',
  now: Date
): PollPlan => {
  const eventDay = mode === 'EVENT_DAY';
  const intervalMs = eventDay ? config.eventDayIntervalMs : config.intervalMs;
  const lookbackMs = eventDay ? config.eventDayLookbackMs : config.lookbackMs;
  return {
    intervalMs,
    lookbackMs,
    postsSince: new Date(now.getTime() - lookbackMs).toISOString(),
    nextPollAt: new Date(now.getTime() + intervalMs).toISOString(),
    running: false,
  };
};

/** Successive planned poll instants. Index 0 is the first poll. */
export const successivePolls = (start: Date, intervalMs: number, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    new Date(start.getTime() + index * intervalMs).toISOString()
  );

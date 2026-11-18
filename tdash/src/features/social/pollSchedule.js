/** Phase 1 records the cadence and does not poll. */

export const DEFAULT_POLL = {
    intervalMs: 5 * 60 * 1000,
    eventDayIntervalMs: 60 * 1000,
    lookbackMs: 14 * 24 * 60 * 60 * 1000,
    eventDayLookbackMs: 48 * 60 * 60 * 1000,
};

export const planDashboardPoll = (config, mode, now = new Date()) => {
    const poll = { ...DEFAULT_POLL, ...(config?.poll || {}) };
    const eventDay = mode === 'EVENT_DAY';
    const intervalMs = eventDay ? poll.eventDayIntervalMs : poll.intervalMs;
    const lookbackMs = eventDay ? poll.eventDayLookbackMs : poll.lookbackMs;
    return {
        intervalMs,
        lookbackMs,
        postsSince: new Date(now.getTime() - lookbackMs).toISOString(),
        nextPollAt: new Date(now.getTime() + intervalMs).toISOString(),
        running: false,
    };
};

export const successivePolls = (start, intervalMs, count) =>
    Array.from({ length: count }, (_, index) => new Date(start.getTime() + index * intervalMs).toISOString());

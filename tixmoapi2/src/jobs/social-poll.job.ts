import prisma from '../config/prisma';
import { logger } from '../config/logger';
import { readSocialConfig } from '../social/config';
import { emitSocialLog } from '../social/log';
import { planPoll, readPollConfig } from '../social/polling';
import { syncOrganization } from '../social/sync';
import { tightestMode, type EventSchedule } from '../social/mode';

let intervalId: ReturnType<typeof setInterval> | null = null;
let activeRun: Promise<void> | null = null;

const loadSchedules = async (organizationId: string): Promise<EventSchedule[]> => {
  const events = await prisma.event.findMany({
    where: { organizationId, deletedAt: null },
    include: { ticketTypes: { select: { salesStart: true } } },
  });
  return events.map((event) => ({
    id: event.id,
    name: event.name,
    timezone: event.timezone || 'America/St_Johns',
    startDatetime: event.startDatetime?.toISOString() || null,
    endDatetime: event.endDatetime?.toISOString() || null,
    salesStart: event.salesStart?.toISOString() || null,
    ticketTypeSalesStarts: event.ticketTypes
      .map((tier) => tier.salesStart?.toISOString() || null)
      .filter(Boolean) as string[],
  }));
};

async function tickSocialPoll() {
  const config = readSocialConfig();
  if (!config.enabled || !config.ready || !config.pollEnabled) return;

  const orgs = await prisma.socialConnection.findMany({
    where: { status: { in: ['CONNECTED', 'NEEDS_ATTENTION'] }, tokenCiphertext: { not: null } },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  const now = new Date();
  for (const { organizationId } of orgs) {
    const schedules = await loadSchedules(organizationId);
    const mode = tightestMode(schedules, now)?.mode || 'NORMAL';
    const plan = planPoll(readPollConfig(), mode, now);
    emitSocialLog(logger, 'info', 'poll.tick', {
      organizationId,
      running: true,
      intervalMs: plan.intervalMs,
    });
    try {
      await syncOrganization({
        organizationId,
        trigger: 'poll',
        logger,
        now,
      });
    } catch (error) {
      logger.error('Social poll sync failed', error as Error);
    }
  }
}

function runSocialPoll() {
  if (activeRun) return;
  activeRun = tickSocialPoll().finally(() => {
    activeRun = null;
  });
}

/** Off by default. Enable with SOCIAL_POLL_ENABLED=true (Labs). */
export function startSocialPollJob() {
  if (intervalId) return;
  const config = readSocialConfig();
  if (!config.pollEnabled) {
    logger.info('Social poll job not started (SOCIAL_POLL_ENABLED is not true)');
    return;
  }
  const intervalMs = Math.min(config.poll.intervalMs, config.poll.eventDayIntervalMs);
  logger.info(`Social poll job started (base interval: ${intervalMs}ms)`);
  intervalId = setInterval(runSocialPoll, intervalMs);
  runSocialPoll();
}

export function stopSocialPollJob() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

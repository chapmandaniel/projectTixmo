import { randomUUID } from 'crypto';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { ensureOrgSettings } from './connections';
import {
  DEFAULT_KEYWORD_VALUES,
  DEFAULT_THRESHOLD_VALUES,
  dashboardThresholdLabels,
} from './defaults';
import { canOverrideEventMapping } from './mode';
import { emitSocialLog, type SocialLogger } from './log';

const requireAdmin = (role?: string | null) => {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw ApiError.forbidden('Org admins edit social settings');
  }
};

export const getSettings = async (organizationId: string) => {
  const settings = await ensureOrgSettings(organizationId);
  const holds = await prisma.socialModeHold.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const mappings = await prisma.socialEventMapping.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
  });
  return {
    thresholds: dashboardThresholdLabels(
      (settings.thresholds as typeof DEFAULT_THRESHOLD_VALUES) || DEFAULT_THRESHOLD_VALUES
    ),
    thresholdValues: settings.thresholds,
    keywords: settings.keywords,
    highEmailEnabled: settings.highEmailEnabled,
    digestEnabled: settings.digestEnabled,
    digestHourLocal: settings.digestHourLocal,
    holds: holds.map((hold) => ({
      id: hold.id,
      eventId: hold.eventId,
      mode: hold.mode,
      until: hold.until.toISOString(),
    })),
    mappings: mappings.map((row) => ({
      id: row.id,
      externalPostId: row.externalPostId,
      eventId: row.eventId,
      source: row.source,
    })),
  };
};

export const saveThresholds = async (input: {
  organizationId: string;
  role?: string | null;
  thresholds?: typeof DEFAULT_THRESHOLD_VALUES;
  reset?: boolean;
  highEmailEnabled?: boolean;
  digestEnabled?: boolean;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  await ensureOrgSettings(input.organizationId);
  const data: Record<string, unknown> = {};
  if (input.reset) data.thresholds = DEFAULT_THRESHOLD_VALUES;
  else if (input.thresholds) data.thresholds = input.thresholds;
  if (typeof input.highEmailEnabled === 'boolean') data.highEmailEnabled = input.highEmailEnabled;
  if (typeof input.digestEnabled === 'boolean') data.digestEnabled = input.digestEnabled;
  await prisma.socialOrgSettings.update({
    where: { organizationId: input.organizationId },
    data,
  });
  emitSocialLog(input.logger, 'info', 'settings.thresholds', {
    organizationId: input.organizationId,
    queryModel: 'SocialOrgSettings',
    queryAction: 'update',
  });
  return getSettings(input.organizationId);
};

export const saveKeywords = async (input: {
  organizationId: string;
  role?: string | null;
  keywords?: typeof DEFAULT_KEYWORD_VALUES;
  reset?: boolean;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  await ensureOrgSettings(input.organizationId);
  await prisma.socialOrgSettings.update({
    where: { organizationId: input.organizationId },
    data: {
      keywords: input.reset ? DEFAULT_KEYWORD_VALUES : input.keywords || DEFAULT_KEYWORD_VALUES,
    },
  });
  emitSocialLog(input.logger, 'info', 'settings.keywords', {
    organizationId: input.organizationId,
    queryModel: 'SocialOrgSettings',
    queryAction: 'update',
  });
  return getSettings(input.organizationId);
};

export const setModeHold = async (input: {
  organizationId: string;
  role?: string | null;
  userId: string;
  mode: 'NORMAL' | 'ON_SALE_DAY' | 'EVENT_DAY';
  until: string;
  eventId?: string | null;
  clear?: boolean;
  logger?: SocialLogger;
}) => {
  requireAdmin(input.role);
  if (input.clear) {
    await prisma.socialModeHold.deleteMany({
      where: {
        organizationId: input.organizationId,
        eventId: input.eventId || null,
      },
    });
  } else {
    const until = new Date(input.until);
    if (Number.isNaN(until.getTime())) throw ApiError.badRequest('Hold until date is invalid');
    await prisma.socialModeHold.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        eventId: input.eventId || null,
        mode: input.mode,
        until,
        actorId: input.userId,
      },
    });
  }
  emitSocialLog(input.logger, 'info', 'settings.hold', {
    organizationId: input.organizationId,
    queryModel: 'SocialModeHold',
    queryAction: input.clear ? 'delete' : 'create',
  });
  return getSettings(input.organizationId);
};

export const saveEventMapping = async (input: {
  organizationId: string;
  role?: string | null;
  userId: string;
  externalPostId: string;
  eventId: string;
  logger?: SocialLogger;
}) => {
  if (!canOverrideEventMapping(input.role)) {
    throw ApiError.forbidden('Org admins override event mapping');
  }
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, organizationId: input.organizationId, deletedAt: null },
  });
  if (!event) throw ApiError.notFound('Event not found');
  await prisma.socialEventMapping.upsert({
    where: {
      organizationId_externalPostId: {
        organizationId: input.organizationId,
        externalPostId: input.externalPostId,
      },
    },
    create: {
      id: randomUUID(),
      organizationId: input.organizationId,
      externalPostId: input.externalPostId,
      eventId: input.eventId,
      source: 'override',
      actorId: input.userId,
    },
    update: {
      eventId: input.eventId,
      source: 'override',
      actorId: input.userId,
    },
  });
  await prisma.socialPost.updateMany({
    where: { organizationId: input.organizationId, externalPostId: input.externalPostId },
    data: { eventId: input.eventId },
  });
  emitSocialLog(input.logger, 'info', 'settings.mapping', {
    organizationId: input.organizationId,
    queryModel: 'SocialEventMapping',
    queryAction: 'upsert',
  });
  return getSettings(input.organizationId);
};

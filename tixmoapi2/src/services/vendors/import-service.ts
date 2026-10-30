import { Prisma, VendorProvider } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import { notificationApiService } from '../../api/notifications/service';
import { redisLockService } from '../redis-lock.service';
import { decryptVendorSecret, encryptVendorSecret, secretLast4 } from '../vendor-credential-crypto';
import { ApiError } from '../../utils/ApiError';
import { classifyVendorEvent, eventFingerprint, slugifyVendorSlug } from './discovery';
import { createVendorAdapter } from './registry';
import { VendorAuthError, VendorEventRecord } from './types';

export const DEFAULT_VENDOR_OWNED_FIELDS = [
  'name',
  'description',
  'startDatetime',
  'endDatetime',
  'timezone',
  'images',
  'externalPurchaseUrl',
  'ticketTypePrice',
];

const LEASE_MS = 120_000;

type Mapping = { externalTicketTypeId: string; tierName: string };

const readMappings = (value: unknown): Mapping[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.externalTicketTypeId !== 'string' || typeof row.tierName !== 'string') return [];
    const tierName = row.tierName.trim();
    if (!tierName || tierName.length > 120) return [];
    return [{ externalTicketTypeId: row.externalTicketTypeId, tierName }];
  });
};

const assertZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
  } catch {
    throw ApiError.badRequest('Invalid IANA event timezone');
  }
};

const purchaseUrl = (event: VendorEventRecord): string => {
  let url: URL;
  try {
    url = new URL(event.purchaseUrl);
  } catch {
    throw ApiError.badRequest(`Showpass event ${event.fixtureId} has no purchase link`);
  }
  if (url.protocol !== 'https:') {
    throw ApiError.badRequest(`Showpass event ${event.fixtureId} purchase link must be https`);
  }
  return url.toString();
};

const publicConnection = (connection: {
  id: string;
  provider: VendorProvider;
  status: string;
  keyLast4: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  festivalConfigs: Array<{
    id: string;
    vendorVenueId: string;
    currency: string;
    timezone: string | null;
    syncIntervalMinutes: number;
    nextSyncAt: Date | null;
    ticketTypeMappings: Prisma.JsonValue;
    vendorOwnedFields: string[];
  }>;
}) => ({
  id: connection.id,
  provider: connection.provider,
  status: connection.status,
  keyLast4: connection.keyLast4,
  lastSyncAt: connection.lastSyncAt,
  lastError: connection.lastError,
  lastErrorAt: connection.lastErrorAt,
  festivals: connection.festivalConfigs.map((config) => ({
    id: config.id,
    vendorVenueId: config.vendorVenueId,
    currency: config.currency,
    timezone: config.timezone,
    syncIntervalMinutes: config.syncIntervalMinutes,
    nextSyncAt: config.nextSyncAt,
    ticketTypeMappings: readMappings(config.ticketTypeMappings),
    vendorOwnedFields: config.vendorOwnedFields,
  })),
});

const loadConnection = (organizationId: string) =>
  prisma.vendorConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider: 'SHOWPASS' } },
    include: { festivalConfigs: true },
  });

const adapterFor = (
  connection: { keyCiphertext: string; webhookSecretCiphertext: string | null },
  venueId: string
) => {
  const apiKey = decryptVendorSecret(connection.keyCiphertext);
  const webhookSecret = connection.webhookSecretCiphertext
    ? decryptVendorSecret(connection.webhookSecretCiphertext)
    : '';
  return createVendorAdapter({ provider: 'showpass', apiKey, venueId, webhookSecret });
};

const alertOrganizers = async (organizationId: string, message: string) => {
  const users = await prisma.user.findMany({
    where: { organizationId, role: { in: ['OWNER', 'ADMIN'] }, disabledAt: null },
    select: { id: true },
  });
  for (const user of users) {
    await notificationApiService.createNotification({
      userId: user.id,
      type: 'ANNOUNCEMENT',
      subject: 'Showpass sync failed',
      message,
      metadata: { provider: 'showpass', code: 'VENDOR_SYNC_FAILED' },
    });
  }
};

const markAuthFailure = async (organizationId: string, message: string) => {
  await prisma.vendorConnection.update({
    where: { organizationId_provider: { organizationId, provider: 'SHOWPASS' } },
    data: { status: 'REVOKED', lastError: message, lastErrorAt: new Date() },
  });
  await alertOrganizers(
    organizationId,
    'Showpass rejected the API key. Reconnect the integration to resume event sync.'
  );
};

const uniqueSlug = async (db: Prisma.TransactionClient, vendorSlug: string) => {
  const root = slugifyVendorSlug(vendorSlug);
  let slug = root;
  let counter = 0;
  for (;;) {
    const existing = await db.event.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    counter += 1;
    slug = `${root}-${counter}`;
  }
};

const ensureVenue = async (
  db: Prisma.TransactionClient,
  organizationId: string,
  event: VendorEventRecord
) => {
  const existing = await db.venue.findFirst({
    where: { organizationId, name: event.venueName },
    select: { id: true },
  });
  if (existing) return existing.id;
  const location = event.location || {
    street: 'Unknown',
    city: 'Unknown',
    state: 'Unknown',
    country: 'Unknown',
    postalCode: '00000',
  };
  const created = await db.venue.create({
    data: {
      organizationId,
      name: event.venueName,
      address: location,
      capacity: 1,
      timezone: event.timezone,
    },
    select: { id: true },
  });
  return created.id;
};

const applyTicketTypes = async (
  db: Prisma.TransactionClient,
  eventId: string,
  event: VendorEventRecord,
  mappings: Mapping[],
  owned: string[]
) => {
  const existing = await db.ticketType.findMany({ where: { eventId } });
  const byVendor = new Map<string, (typeof existing)[number]>();
  for (const ticket of existing) {
    const metadata = ticket.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const vendorId = (metadata as Record<string, unknown>).vendorTicketTypeId;
      if (typeof vendorId === 'string') byVendor.set(vendorId, ticket);
    }
  }
  for (const ticket of event.ticketTypes) {
    const mapped = mappings.find((row) => row.externalTicketTypeId === ticket.externalId);
    const tierName = mapped?.tierName || ticket.name;
    const current = byVendor.get(ticket.externalId);
    const metadata = {
      vendorTicketTypeId: ticket.externalId,
      vendorName: ticket.name,
      inventoryLeft: ticket.inventoryLeft,
    };
    if (!current) {
      await db.ticketType.create({
        data: {
          eventId,
          name: tierName,
          price: new Decimal(ticket.price),
          quantityTotal: 0,
          quantityAvailable: 0,
          quantitySold: 0,
          status: 'HIDDEN',
          metadata,
        },
      });
      continue;
    }
    await db.ticketType.update({
      where: { id: current.id },
      data: {
        ...(owned.includes('ticketTypePrice') ? { price: new Decimal(ticket.price) } : {}),
        metadata,
      },
    });
  }
};

const vendorFieldData = (event: VendorEventRecord, owned: string[]) => {
  const start = new Date(event.startsOn);
  const end = event.endsOn ? new Date(event.endsOn) : null;
  const data: Prisma.EventUpdateInput = {};
  if (owned.includes('name')) data.name = event.name;
  if (owned.includes('description')) data.description = event.description;
  if (owned.includes('startDatetime')) data.startDatetime = start;
  if (owned.includes('endDatetime')) data.endDatetime = end && end > start ? end : null;
  if (owned.includes('timezone')) data.timezone = event.timezone;
  if (owned.includes('images')) {
    data.images = { main: event.image, banner: event.imageBanner };
  }
  if (owned.includes('externalPurchaseUrl')) data.externalPurchaseUrl = purchaseUrl(event);
  return data;
};

const createFieldData = (event: VendorEventRecord) => {
  const fields = vendorFieldData(event, DEFAULT_VENDOR_OWNED_FIELDS);
  return {
    name: typeof fields.name === 'string' ? fields.name : event.name,
    description: typeof fields.description === 'string' ? fields.description : '',
    startDatetime: fields.startDatetime instanceof Date ? fields.startDatetime : null,
    endDatetime: fields.endDatetime instanceof Date ? fields.endDatetime : null,
    timezone: typeof fields.timezone === 'string' ? fields.timezone : event.timezone,
    images: fields.images ?? undefined,
    externalPurchaseUrl:
      typeof fields.externalPurchaseUrl === 'string'
        ? fields.externalPurchaseUrl
        : purchaseUrl(event),
  };
};

const writeEvent = async (
  db: Prisma.TransactionClient,
  organizationId: string,
  event: VendorEventRecord,
  mappings: Mapping[],
  owned: string[]
) => {
  assertZone(event.timezone);
  const fingerprint = eventFingerprint(event);
  const link = await db.vendorEventLink.findUnique({
    where: {
      organizationId_provider_externalItemId: {
        organizationId,
        provider: 'SHOWPASS',
        externalItemId: event.externalItemId,
      },
    },
    include: { event: true },
  });
  if (link) {
    await db.event.update({
      where: { id: link.eventId },
      data: vendorFieldData(event, owned),
    });
    await applyTicketTypes(db, link.eventId, event, mappings, owned);
    await db.vendorEventLink.update({
      where: { id: link.id },
      data: { contentFingerprint: fingerprint, externalSlug: event.slug, lastSyncedAt: new Date() },
    });
    return db.event.findUniqueOrThrow({ where: { id: link.eventId } });
  }
  const venueId = await ensureVenue(db, organizationId, event);
  const slug = await uniqueSlug(db, event.slug);
  const created = await db.event.create({
    data: {
      organizationId,
      venueId,
      slug,
      status: 'PUBLISHED',
      ticketingMode: 'EXTERNAL',
      category: null,
      tags: [],
      ...createFieldData(event),
    },
  });
  await applyTicketTypes(db, created.id, event, mappings, owned);
  await db.vendorEventLink.create({
    data: {
      eventId: created.id,
      organizationId,
      provider: 'SHOWPASS',
      externalId: event.externalId,
      externalItemId: event.externalItemId,
      externalSlug: event.slug,
      contentFingerprint: fingerprint,
    },
  });
  return created;
};

const replaceSoldCounts = async (
  organizationId: string,
  eventId: string,
  externalItemId: string,
  counts: Array<{ externalTicketTypeId: string; soldCount: number }>
) => {
  for (const count of counts) {
    await prisma.vendorSoldCountSnapshot.upsert({
      where: {
        eventId_externalTicketTypeId: {
          eventId,
          externalTicketTypeId: count.externalTicketTypeId,
        },
      },
      create: {
        eventId,
        organizationId,
        provider: 'SHOWPASS',
        externalItemId,
        externalTicketTypeId: count.externalTicketTypeId,
        soldCount: count.soldCount,
        source: 'SYNC',
      },
      update: {
        soldCount: count.soldCount,
        source: 'SYNC',
        capturedAt: new Date(),
      },
    });
  }
};

export class VendorImportService {
  async connect(
    organizationId: string,
    input: { apiKey: string; vendorVenueId: string; webhookSecret?: string }
  ) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw ApiError.notFound('Organization not found');
    const probe = createVendorAdapter({
      provider: 'showpass',
      apiKey: input.apiKey,
      venueId: input.vendorVenueId,
      webhookSecret: input.webhookSecret,
    });
    try {
      await probe.verifyCredentials();
    } catch (error) {
      if (error instanceof VendorAuthError) throw ApiError.badRequest(error.message);
      throw error;
    }
    const keyCiphertext = encryptVendorSecret(input.apiKey);
    const webhookSecretCiphertext = input.webhookSecret
      ? encryptVendorSecret(input.webhookSecret)
      : undefined;
    const connection = await prisma.vendorConnection.upsert({
      where: { organizationId_provider: { organizationId, provider: 'SHOWPASS' } },
      create: {
        organizationId,
        provider: 'SHOWPASS',
        status: 'ACTIVE',
        keyCiphertext,
        keyLast4: secretLast4(input.apiKey),
        webhookSecretCiphertext: webhookSecretCiphertext ?? null,
        lastError: null,
      },
      update: {
        status: 'ACTIVE',
        keyCiphertext,
        keyLast4: secretLast4(input.apiKey),
        ...(webhookSecretCiphertext ? { webhookSecretCiphertext } : {}),
        lastError: null,
        lastErrorAt: null,
      },
    });
    await prisma.vendorFestivalConfig.upsert({
      where: {
        organizationId_provider_vendorVenueId: {
          organizationId,
          provider: 'SHOWPASS',
          vendorVenueId: input.vendorVenueId,
        },
      },
      create: {
        organizationId,
        connectionId: connection.id,
        provider: 'SHOWPASS',
        vendorVenueId: input.vendorVenueId,
        currency: 'CAD',
        vendorOwnedFields: DEFAULT_VENDOR_OWNED_FIELDS,
        ticketTypeMappings: [],
        nextSyncAt: new Date(Date.now() + 60 * 60_000),
      },
      update: { connectionId: connection.id },
    });
    return this.getConnection(organizationId);
  }

  async getConnection(organizationId: string) {
    const connection = await loadConnection(organizationId);
    if (!connection) return null;
    return publicConnection(connection);
  }

  async saveConfig(
    organizationId: string,
    input: {
      vendorVenueId: string;
      currency?: string;
      timezone?: string | null;
      syncIntervalMinutes?: number;
      vendorOwnedFields?: string[];
      ticketTypeMappings?: Mapping[];
      webhookSecret?: string;
    }
  ) {
    const connection = await loadConnection(organizationId);
    if (!connection) throw ApiError.notFound('Showpass is not connected');
    const config = connection.festivalConfigs.find(
      (row) => row.vendorVenueId === input.vendorVenueId
    );
    if (!config) throw ApiError.notFound('Festival vendor config not found');
    if (input.timezone) assertZone(input.timezone);
    if (input.webhookSecret) {
      await prisma.vendorConnection.update({
        where: { id: connection.id },
        data: { webhookSecretCiphertext: encryptVendorSecret(input.webhookSecret) },
      });
    }
    const saved = await prisma.vendorFestivalConfig.update({
      where: { id: config.id },
      data: {
        ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.syncIntervalMinutes ? { syncIntervalMinutes: input.syncIntervalMinutes } : {}),
        ...(input.vendorOwnedFields ? { vendorOwnedFields: input.vendorOwnedFields } : {}),
        ...(input.ticketTypeMappings ? { ticketTypeMappings: input.ticketTypeMappings } : {}),
      },
    });
    return {
      id: saved.id,
      vendorVenueId: saved.vendorVenueId,
      currency: saved.currency,
      timezone: saved.timezone,
      syncIntervalMinutes: saved.syncIntervalMinutes,
      ticketTypeMappings: readMappings(saved.ticketTypeMappings),
      vendorOwnedFields: saved.vendorOwnedFields,
    };
  }

  async preview(organizationId: string, vendorVenueId: string) {
    const connection = await loadConnection(organizationId);
    if (!connection) throw ApiError.notFound('Showpass is not connected');
    const config = connection.festivalConfigs.find((row) => row.vendorVenueId === vendorVenueId);
    if (!config) throw ApiError.notFound('Festival vendor config not found');
    let events: VendorEventRecord[];
    try {
      events = await adapterFor(connection, vendorVenueId).listEvents();
    } catch (error) {
      if (error instanceof VendorAuthError) {
        await markAuthFailure(organizationId, error.message);
        throw ApiError.badRequest(error.message);
      }
      throw error;
    }
    const links = await prisma.vendorEventLink.findMany({
      where: { organizationId, provider: 'SHOWPASS' },
      include: {
        event: {
          include: { ticketTypes: true },
        },
      },
    });
    const byItem = new Map(links.map((link) => [link.externalItemId, link]));
    return {
      events: events.map((event) => {
        const fingerprint = eventFingerprint(event);
        const link = byItem.get(event.externalItemId);
        const status = classifyVendorEvent(fingerprint, link?.contentFingerprint);
        const diff: Record<string, { from: unknown; to: unknown }> = {};
        if (link && status === 'changed') {
          if (link.event.name !== event.name) diff.name = { from: link.event.name, to: event.name };
          if (link.event.timezone !== event.timezone)
            diff.timezone = { from: link.event.timezone, to: event.timezone };
          const start = link.event.startDatetime?.toISOString() ?? null;
          if (start !== new Date(event.startsOn).toISOString())
            diff.startsOn = { from: start, to: event.startsOn };
          for (const ticket of event.ticketTypes) {
            const current = link.event.ticketTypes.find((row) => {
              const metadata = row.metadata;
              return (
                metadata &&
                typeof metadata === 'object' &&
                !Array.isArray(metadata) &&
                (metadata as Record<string, unknown>).vendorTicketTypeId === ticket.externalId
              );
            });
            if (current && !current.price.equals(new Decimal(ticket.price))) {
              diff[`ticket:${ticket.externalId}`] = {
                from: current.price.toString(),
                to: ticket.price,
              };
            }
          }
        }
        return {
          fixtureId: event.fixtureId,
          externalItemId: event.externalItemId,
          externalId: event.externalId,
          name: event.name,
          slug: event.slug,
          timezone: event.timezone,
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          purchaseUrl: event.purchaseUrl,
          isRecurringParent: event.isRecurringParent,
          status,
          eventId: link?.eventId ?? null,
          diff: status === 'changed' ? diff : null,
          ticketTypes: event.ticketTypes.map((ticket) => ({
            externalTicketTypeId: ticket.externalId,
            name: ticket.name,
            price: ticket.price,
            inventoryLeft: ticket.inventoryLeft,
          })),
        };
      }),
    };
  }

  async importEvents(organizationId: string, vendorVenueId: string, externalItemIds: string[]) {
    const connection = await loadConnection(organizationId);
    if (!connection) throw ApiError.notFound('Showpass is not connected');
    const config = connection.festivalConfigs.find((row) => row.vendorVenueId === vendorVenueId);
    if (!config) throw ApiError.notFound('Festival vendor config not found');
    const adapter = adapterFor(connection, vendorVenueId);
    let catalog: VendorEventRecord[];
    try {
      catalog = await adapter.listEvents();
    } catch (error) {
      if (error instanceof VendorAuthError) {
        await markAuthFailure(organizationId, error.message);
        throw ApiError.badRequest(error.message);
      }
      throw error;
    }
    const selected = catalog.filter((event) => externalItemIds.includes(event.externalItemId));
    if (selected.length !== externalItemIds.length) {
      throw ApiError.badRequest('One or more Showpass events are not in the preview');
    }
    const mappings = readMappings(config.ticketTypeMappings);
    const owned = config.vendorOwnedFields.length
      ? config.vendorOwnedFields
      : DEFAULT_VENDOR_OWNED_FIELDS;
    const merged = [...mappings];
    for (const event of selected) {
      for (const ticket of event.ticketTypes) {
        if (!merged.some((row) => row.externalTicketTypeId === ticket.externalId)) {
          merged.push({ externalTicketTypeId: ticket.externalId, tierName: ticket.name });
        }
      }
    }
    const events = await prisma.$transaction(async (tx) => {
      const written = [];
      for (const event of selected) {
        written.push(await writeEvent(tx, organizationId, event, merged, owned));
      }
      await tx.vendorFestivalConfig.update({
        where: { id: config.id },
        data: { ticketTypeMappings: merged, currency: selected[0]?.currency || config.currency },
      });
      return written;
    });
    return {
      count: events.length,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        timezone: event.timezone,
        ticketingMode: event.ticketingMode,
        externalPurchaseUrl: event.externalPurchaseUrl,
        category: event.category,
        status: event.status,
        startDatetime: event.startDatetime,
      })),
      ticketTypeMappings: merged,
    };
  }

  async listSoldCounts(organizationId: string, eventId?: string) {
    const rows = await prisma.vendorSoldCountSnapshot.findMany({
      where: { organizationId, ...(eventId ? { eventId } : {}) },
      orderBy: [{ externalItemId: 'asc' }, { externalTicketTypeId: 'asc' }],
      include: { event: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((row) => ({
      eventId: row.eventId,
      eventName: row.event.name,
      slug: row.event.slug,
      fixtureId: `sp-evt-${row.externalItemId}`,
      externalItemId: row.externalItemId,
      externalTicketTypeId: row.externalTicketTypeId,
      soldCount: row.soldCount,
      source: row.source,
      capturedAt: row.capturedAt,
    }));
  }

  async syncOrganization(organizationId: string) {
    const token = await redisLockService.acquireLock(
      `lock:vendor-sync:${organizationId}`,
      LEASE_MS
    );
    if (!token) return { skipped: true as const, organizationId };
    try {
      return await this.syncUnlocked(organizationId);
    } finally {
      await redisLockService.releaseLock(`lock:vendor-sync:${organizationId}`, token);
    }
  }

  private async syncUnlocked(organizationId: string) {
    const connection = await loadConnection(organizationId);
    if (!connection) throw ApiError.notFound('Showpass is not connected');
    const results = [];
    for (const config of connection.festivalConfigs) {
      const lease = randomUUID();
      const stale = new Date(Date.now() - LEASE_MS);
      const claimed = await prisma.vendorFestivalConfig.updateMany({
        where: {
          id: config.id,
          OR: [{ syncLeaseToken: null }, { syncStartedAt: { lt: stale } }],
        },
        data: { syncLeaseToken: lease, syncStartedAt: new Date() },
      });
      if (claimed.count !== 1) {
        results.push({ vendorVenueId: config.vendorVenueId, skipped: true });
        continue;
      }
      try {
        const adapter = adapterFor(connection, config.vendorVenueId);
        const events = await adapter.listEvents();
        const links = await prisma.vendorEventLink.findMany({
          where: { organizationId, provider: 'SHOWPASS' },
        });
        const mappings = readMappings(config.ticketTypeMappings);
        const owned = config.vendorOwnedFields.length
          ? config.vendorOwnedFields
          : DEFAULT_VENDOR_OWNED_FIELDS;
        for (const link of links) {
          const incoming = events.find((event) => event.externalItemId === link.externalItemId);
          if (!incoming) continue;
          await prisma.$transaction((tx) =>
            writeEvent(tx, organizationId, incoming, mappings, owned)
          );
          const counts = await adapter.getSoldCounts(link.externalItemId);
          await replaceSoldCounts(organizationId, link.eventId, link.externalItemId, counts);
        }
        const next = new Date(Date.now() + config.syncIntervalMinutes * 60_000);
        await prisma.vendorFestivalConfig.update({
          where: { id: config.id },
          data: { syncLeaseToken: null, nextSyncAt: next },
        });
        results.push({ vendorVenueId: config.vendorVenueId, updated: links.length });
      } catch (error) {
        await prisma.vendorFestivalConfig.updateMany({
          where: { id: config.id, syncLeaseToken: lease },
          data: { syncLeaseToken: null },
        });
        if (error instanceof VendorAuthError) {
          await markAuthFailure(organizationId, error.message);
          return {
            skipped: false as const,
            status: 'REVOKED' as const,
            lastError: error.message,
            alert: true,
          };
        }
        const message = error instanceof Error ? error.message : 'Showpass sync failed';
        await prisma.vendorConnection.update({
          where: { id: connection.id },
          data: { status: 'ERROR', lastError: message, lastErrorAt: new Date() },
        });
        await alertOrganizers(
          organizationId,
          'Showpass sync failed. Open integrations to review the error.'
        );
        throw error;
      }
    }
    await prisma.vendorConnection.update({
      where: { id: connection.id },
      data: { status: 'ACTIVE', lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    });
    return { skipped: false as const, status: 'ACTIVE' as const, results };
  }

  async runDueSyncs() {
    const due = await prisma.vendorFestivalConfig.findMany({
      where: {
        provider: 'SHOWPASS',
        OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }],
      },
      select: { organizationId: true },
    });
    const organizations = [...new Set(due.map((row) => row.organizationId))];
    const outcomes = [];
    for (const organizationId of organizations) {
      try {
        outcomes.push(await this.syncOrganization(organizationId));
      } catch (error) {
        outcomes.push({
          organizationId,
          failed: true,
          message: error instanceof Error ? error.message : 'Showpass sync failed',
        });
      }
    }
    return outcomes;
  }
}

export const vendorImportService = new VendorImportService();

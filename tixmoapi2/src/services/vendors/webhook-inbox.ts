import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { decryptVendorSecret } from '../vendor-credential-crypto';
import {
  countInvoice,
  invoiceQuantityFingerprint,
  isAllowedInvoiceEventType,
  MAX_INVOICE_ID_LENGTH,
  readSignedIdentity,
} from './invoice-counts';
import { showpassSignature, showpassSignaturesMatch } from './showpass-signature';
import { VendorCountDelta } from './types';

const LEASE_MS = 60_000;

const headerValue = (headers: Record<string, string | string[] | undefined>, name: string) => {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
};

const claim = async (
  id: string,
  identity: {
    connectionId: string;
    organizationId: string;
    signedInvoiceId: string;
    eventType: string;
    payloadFingerprint: string;
    webhookEventUuid: string;
  }
) => {
  const leaseToken = randomUUID();
  const now = new Date();
  const stale = new Date(now.getTime() - LEASE_MS);
  await prisma.vendorWebhookInbox.upsert({
    where: { id },
    create: {
      id,
      provider: 'SHOWPASS',
      status: 'PROCESSING',
      leaseToken,
      attempts: 0,
      processingStartedAt: now,
      connectionId: identity.connectionId,
      organizationId: identity.organizationId,
      signedInvoiceId: identity.signedInvoiceId,
      eventType: identity.eventType,
      payloadFingerprint: identity.payloadFingerprint,
      webhookEventUuid: identity.webhookEventUuid,
    },
    update: {},
  });
  const claimed = await prisma.vendorWebhookInbox.updateMany({
    where: {
      id,
      OR: [
        { status: 'FAILED' },
        { status: 'PROCESSING', processingStartedAt: { lt: stale } },
        { status: 'PROCESSING', leaseToken, attempts: 0 },
      ],
    },
    data: {
      status: 'PROCESSING',
      leaseToken,
      attempts: { increment: 1 },
      processingStartedAt: now,
      errorMessage: null,
    },
  });
  return claimed.count === 1 ? leaseToken : null;
};

const applyDeltas = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  organizationIds: string[],
  deltas: VendorCountDelta[]
) => {
  for (const delta of deltas) {
    const links = await tx.vendorEventLink.findMany({
      where: {
        provider: 'SHOWPASS',
        externalItemId: delta.externalItemId,
        organizationId: { in: organizationIds },
      },
    });
    for (const link of links) {
      const current = await tx.vendorSoldCountSnapshot.findUnique({
        where: {
          eventId_externalTicketTypeId: {
            eventId: link.eventId,
            externalTicketTypeId: delta.externalTicketTypeId,
          },
        },
      });
      const soldCount = Math.max(0, (current?.soldCount ?? 0) + delta.quantity);
      if (!current) {
        await tx.vendorSoldCountSnapshot.create({
          data: {
            eventId: link.eventId,
            organizationId: link.organizationId,
            provider: 'SHOWPASS',
            externalItemId: delta.externalItemId,
            externalTicketTypeId: delta.externalTicketTypeId,
            soldCount,
            source: 'WEBHOOK',
          },
        });
      } else {
        await tx.vendorSoldCountSnapshot.update({
          where: { id: current.id },
          data: { soldCount, source: 'WEBHOOK', capturedAt: new Date() },
        });
      }
    }
  }
};

const inboxId = (connectionId: string, invoiceId: string, eventType: string) =>
  `showpass:${connectionId}:${invoiceId}:${eventType}`;

const deltaKey = (delta: VendorCountDelta) =>
  `${delta.externalItemId}:${delta.externalTicketTypeId}`;

const readStoredDeltas = (value: unknown): VendorCountDelta[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.externalItemId !== 'string' || typeof row.externalTicketTypeId !== 'string') {
      return [];
    }
    if (typeof row.quantity !== 'number') return [];
    return [
      {
        externalItemId: row.externalItemId,
        externalTicketTypeId: row.externalTicketTypeId,
        quantity: row.quantity,
      },
    ];
  });
};

/**
 * Refund and void quantities are not signed. They are accepted only when this
 * connection already recorded a purchase for the same invoice id, and only up
 * to the quantities still remaining on that purchase.
 */
const assertRefundWithinPurchase = async (
  connectionId: string,
  invoiceId: string,
  deltas: VendorCountDelta[]
) => {
  const rows = await prisma.vendorWebhookInbox.findMany({
    where: {
      connectionId,
      signedInvoiceId: invoiceId,
      status: 'PROCESSED',
      eventType: { in: ['invoice.purchase', 'invoice.refund', 'invoice.void'] },
    },
    select: { eventType: true, countDeltas: true },
  });
  const remaining = new Map<string, number>();
  for (const row of rows) {
    for (const delta of readStoredDeltas(row.countDeltas)) {
      const key = deltaKey(delta);
      const current = remaining.get(key) ?? 0;
      remaining.set(key, current + delta.quantity);
    }
  }
  if (![...remaining.values()].some((quantity) => quantity > 0)) {
    throw new ApiError(409, 'No recorded purchase for this invoice on this connection');
  }
  for (const delta of deltas) {
    const key = deltaKey(delta);
    const left = remaining.get(key) ?? 0;
    if (-delta.quantity > left) {
      throw new ApiError(409, 'Refund quantity exceeds the recorded purchase');
    }
  }
};

export const receiveShowpassWebhook = async (
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  routeToken?: string
) => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Showpass webhook body is not JSON');
  }
  const identity = readSignedIdentity(payload);
  if (!identity) throw ApiError.badRequest('Showpass webhook payload is not a recognized invoice');
  if (identity.invoiceId.length > MAX_INVOICE_ID_LENGTH) {
    throw ApiError.badRequest('Showpass invoice id is too long');
  }
  const provided = headerValue(headers, 'x-showpass-signature');
  const connections = await prisma.vendorConnection.findMany({
    where: {
      provider: 'SHOWPASS',
      webhookSecretCiphertext: { not: null },
      ...(routeToken ? { webhookRouteToken: routeToken } : {}),
    },
    select: { id: true, organizationId: true, webhookSecretCiphertext: true },
  });
  const matched = [];
  for (const connection of connections) {
    if (!connection.webhookSecretCiphertext) continue;
    let secret = '';
    try {
      secret = decryptVendorSecret(connection.webhookSecretCiphertext);
    } catch {
      continue;
    }
    if (showpassSignaturesMatch(showpassSignature(identity.invoiceId, secret), provided)) {
      matched.push(connection);
    }
  }
  if (!matched.length) throw new ApiError(401, 'Invalid webhook signature');
  if (!isAllowedInvoiceEventType(identity.eventType)) {
    throw ApiError.badRequest('Showpass webhook event type is not accepted');
  }

  const counted = countInvoice(payload);
  if (
    !counted ||
    counted.invoiceId !== identity.invoiceId ||
    counted.eventType !== identity.eventType
  ) {
    throw ApiError.badRequest('Showpass webhook payload is not a recognized invoice');
  }
  const fingerprint = invoiceQuantityFingerprint(counted.deltas);
  let applied = 0;
  let duplicates = 0;
  for (const connection of matched) {
    const id = inboxId(connection.id, identity.invoiceId, identity.eventType);
    if (identity.eventType !== 'invoice.purchase') {
      await assertRefundWithinPurchase(connection.id, identity.invoiceId, counted.deltas);
    }
    const existing = await prisma.vendorWebhookInbox.findUnique({ where: { id } });
    if (existing?.status === 'PROCESSED') {
      if (existing.payloadFingerprint === fingerprint) {
        duplicates += 1;
        continue;
      }
      throw new ApiError(409, 'Showpass webhook quantities do not match the recorded invoice');
    }
    const leaseToken = await claim(id, {
      connectionId: connection.id,
      organizationId: connection.organizationId,
      signedInvoiceId: identity.invoiceId,
      eventType: identity.eventType,
      payloadFingerprint: fingerprint,
      webhookEventUuid: counted.webhookId,
    });
    if (!leaseToken) {
      const again = await prisma.vendorWebhookInbox.findUnique({ where: { id } });
      if (again?.status === 'PROCESSED' && again.payloadFingerprint !== fingerprint) {
        throw new ApiError(409, 'Showpass webhook quantities do not match the recorded invoice');
      }
      duplicates += 1;
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await applyDeltas(tx, [connection.organizationId], counted.deltas);
        const finished = await tx.vendorWebhookInbox.updateMany({
          where: { id, leaseToken },
          data: {
            status: 'PROCESSED',
            leaseToken: null,
            processedAt: new Date(),
            organizationId: connection.organizationId,
            connectionId: connection.id,
            countDeltas: counted.deltas,
            errorMessage: counted.deltas.length ? null : 'No sold-count change for this event type',
          },
        });
        if (finished.count !== 1) throw new Error('Webhook lease was lost');
      });
      applied += counted.deltas.length;
    } catch (error) {
      await prisma.vendorWebhookInbox.updateMany({
        where: { id, leaseToken },
        data: {
          status: 'FAILED',
          leaseToken: null,
          errorMessage: 'Showpass webhook could not be applied',
        },
      });
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Showpass webhook could not be applied');
    }
  }
  return {
    duplicate: duplicates === matched.length,
    webhookId: counted.webhookId,
    applied,
  };
};

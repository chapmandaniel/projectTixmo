import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { decryptVendorSecret } from '../vendor-credential-crypto';
import { countInvoice } from './invoice-counts';
import { showpassSignature, showpassSignaturesMatch } from './showpass-signature';
import { VendorCountDelta } from './types';

const LEASE_MS = 60_000;

const headerValue = (headers: Record<string, string | string[] | undefined>, name: string) => {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
};

const claim = async (id: string) => {
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

export const receiveShowpassWebhook = async (
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
) => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Showpass webhook body is not JSON');
  }
  const counted = countInvoice(payload);
  if (!counted) throw ApiError.badRequest('Showpass webhook payload is not a recognized invoice');
  const provided = headerValue(headers, 'x-showpass-signature');
  const connections = await prisma.vendorConnection.findMany({
    where: { provider: 'SHOWPASS', webhookSecretCiphertext: { not: null } },
    select: { organizationId: true, webhookSecretCiphertext: true },
  });
  const matched: string[] = [];
  for (const connection of connections) {
    if (!connection.webhookSecretCiphertext) continue;
    let secret = '';
    try {
      secret = decryptVendorSecret(connection.webhookSecretCiphertext);
    } catch {
      continue;
    }
    if (showpassSignaturesMatch(showpassSignature(counted.invoiceId, secret), provided)) {
      matched.push(connection.organizationId);
    }
  }
  if (!matched.length) throw new ApiError(401, 'Invalid webhook signature');

  const leaseToken = await claim(counted.webhookId);
  if (!leaseToken) return { duplicate: true, webhookId: counted.webhookId };

  try {
    await prisma.$transaction(async (tx) => {
      await applyDeltas(tx, matched, counted.deltas);
      const finished = await tx.vendorWebhookInbox.updateMany({
        where: { id: counted.webhookId, leaseToken },
        data: {
          status: 'PROCESSED',
          leaseToken: null,
          processedAt: new Date(),
          organizationId: matched[0],
          errorMessage: counted.deltas.length ? null : 'No sold-count change for this event type',
        },
      });
      if (finished.count !== 1) throw new Error('Webhook lease was lost');
    });
  } catch (error) {
    await prisma.vendorWebhookInbox.updateMany({
      where: { id: counted.webhookId, leaseToken },
      data: {
        status: 'FAILED',
        leaseToken: null,
        errorMessage: 'Showpass webhook could not be applied',
      },
    });
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Showpass webhook could not be applied');
  }
  return { duplicate: false, webhookId: counted.webhookId, applied: counted.deltas.length };
};

import { Scanner, ScanLog, ScannerStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { parseTicketQRData } from '../../utils/qrcode';
import crypto from 'crypto';

import prisma from '../../config/prisma';
import {
  lockedTicket,
  ticketFailure,
  consumeTicket,
} from '../../services/ticket-admission.service';
import { orderDisputed } from '../../services/ticket-void.service';

interface RegisterScannerData {
  name: string;
  deviceId?: string;
  organizationId: string;
  eventId?: string;
  createdBy: string;
}

interface ListScannersParams {
  organizationId?: string;
  eventId?: string;
  status?: ScannerStatus;
  page?: number;
  limit?: number;
}

interface PaginatedScanners {
  scanners: Scanner[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ScanTicketData {
  scannerId: string;
  qrData: string;
  scanType: 'ENTRY' | 'EXIT' | 'VALIDATION';
  metadata?: Record<string, unknown>;
}

interface ListScanLogsParams {
  scannerId?: string;
  ticketId?: string;
  eventId?: string;
  organizationId?: string;
  success?: boolean;
  page?: number;
  limit?: number;
}

interface PaginatedScanLogs {
  scanLogs: ScanLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Generate a secure API key for scanner
 */
function generateApiKey(): string {
  return `sk_scanner_${crypto.randomBytes(32).toString('hex')}`;
}

export class ScannerService {
  /**
   * Register a new scanner
   */
  async registerScanner(data: RegisterScannerData): Promise<Scanner> {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Verify event exists if provided
    if (data.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
      });

      if (!event) {
        throw ApiError.notFound('Event not found');
      }

      // Verify event belongs to organization
      if (event.organizationId !== data.organizationId) {
        throw ApiError.badRequest('Event does not belong to the specified organization');
      }
    }

    // Generate API key
    const apiKey = generateApiKey();

    // Create scanner
    const scanner = await prisma.scanner.create({
      data: {
        name: data.name,
        deviceId: data.deviceId,
        apiKey,
        organizationId: data.organizationId,
        eventId: data.eventId,
        createdBy: data.createdBy,
      },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
        event: {
          select: {
            name: true,
            startDatetime: true,
            endDatetime: true,
          },
        },
      },
    });

    return scanner;
  }

  /**
   * Authenticate scanner by API key
   */
  async authenticateScanner(apiKey: string): Promise<Scanner> {
    const scanner = await prisma.scanner.findUnique({
      where: { apiKey },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            startDatetime: true,
            endDatetime: true,
          },
        },
      },
    });

    if (!scanner) {
      throw ApiError.unauthorized('Invalid API key');
    }

    if (scanner.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Scanner is ${scanner.status.toLowerCase()}`);
    }

    // Update last used timestamp
    await prisma.scanner.update({
      where: { id: scanner.id },
      data: { lastUsedAt: new Date() },
    });

    return scanner;
  }

  /**
   * List scanners
   */
  async listScanners(params: ListScannersParams): Promise<PaginatedScanners> {
    const { page = 1, limit = 20, organizationId, eventId, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ScannerWhereInput = {};
    if (organizationId) where.organizationId = organizationId;
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;

    const [scanners, total] = await Promise.all([
      prisma.scanner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
          event: {
            select: {
              name: true,
              startDatetime: true,
              endDatetime: true,
            },
          },
        },
      }),
      prisma.scanner.count({ where }),
    ]);

    return {
      scanners,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get scanner by ID
   */
  async getScannerById(id: string): Promise<Scanner | null> {
    return await prisma.scanner.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
        event: {
          select: {
            name: true,
            startDatetime: true,
            endDatetime: true,
          },
        },
      },
    });
  }

  /**
   * Update scanner
   */
  async updateScanner(
    id: string,
    data: { name?: string; status?: ScannerStatus; eventId?: string | null }
  ): Promise<Scanner> {
    const scanner = await prisma.scanner.findUnique({
      where: { id },
    });

    if (!scanner) {
      throw ApiError.notFound('Scanner not found');
    }

    // If changing event, verify it exists and belongs to same organization
    if (data.eventId !== undefined && data.eventId !== null) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
      });

      if (!event) {
        throw ApiError.notFound('Event not found');
      }

      if (event.organizationId !== scanner.organizationId) {
        throw ApiError.badRequest('Event does not belong to the scanner organization');
      }
    }

    return await prisma.scanner.update({
      where: { id },
      data,
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
        event: {
          select: {
            name: true,
            startDatetime: true,
            endDatetime: true,
          },
        },
      },
    });
  }

  /**
   * Delete/revoke scanner
   */
  async deleteScanner(id: string): Promise<void> {
    const scanner = await prisma.scanner.findUnique({
      where: { id },
    });

    if (!scanner) {
      throw ApiError.notFound('Scanner not found');
    }

    // Soft delete by setting status to REVOKED
    await prisma.scanner.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  /**
   * Scan ticket with QR code
   */
  async scanTicket(data: ScanTicketData): Promise<{
    success: boolean;
    ticket?: unknown;
    scanLog: ScanLog;
    reason?: string;
  }> {
    const parsed = parseTicketQRData(data.qrData);
    return prisma.$transaction(async (tx) => {
      const ticket = parsed ? await lockedTicket(tx, parsed.ticketId) : null;
      // Recheck scope and active status at the use boundary, including offline
      // uploads and internal callers that don't pass through HTTP middleware.
      await tx.$queryRaw`SELECT id FROM scanners WHERE id = ${data.scannerId} FOR UPDATE`;
      const scanner = await tx.scanner.findUnique({ where: { id: data.scannerId } });
      if (!scanner || scanner.status !== 'ACTIVE')
        throw ApiError.forbidden('Scanner is not active');
      let reason: string | undefined;
      if (!parsed) reason = 'Invalid QR code format';
      else if (!ticket) reason = 'Ticket not found';
      else if (
        scanner.organizationId !== ticket.event.organizationId ||
        (scanner.eventId && scanner.eventId !== ticket.eventId)
      ) {
        throw ApiError.forbidden('Scanner is not assigned to this event');
      } else if (parsed.eventId !== ticket.eventId || parsed.barcode !== ticket.barcode) {
        reason = 'Ticket credential is no longer valid';
      } else reason = ticketFailure(ticket, data.scanType === 'ENTRY', false);
      if (!reason && ticket && data.scanType === 'ENTRY')
        await consumeTicket(tx, ticket.id, data.scannerId);
      const scanLog = await tx.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId: ticket?.id ?? null,
          eventId: ticket?.eventId ?? null,
          scanType: data.scanType,
          success: !reason,
          failureReason: reason,
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });
      return { success: !reason, reason, ticket: ticket || undefined, scanLog };
    });
  }

  /**
   * Get scan logs
   */
  async getScanLogs(params: ListScanLogsParams): Promise<PaginatedScanLogs> {
    const { page = 1, limit = 20, scannerId, ticketId, eventId, organizationId, success } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ScanLogWhereInput = {};
    if (scannerId) where.scannerId = scannerId;
    if (ticketId) where.ticketId = ticketId;
    if (eventId) where.eventId = eventId;
    if (organizationId) where.scanner = { organizationId };
    if (success !== undefined) where.success = success;

    const [scanLogs, total] = await Promise.all([
      prisma.scanLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scannedAt: 'desc' },
        include: {
          scanner: {
            select: {
              name: true,
              deviceId: true,
            },
          },
          ticket: {
            select: {
              barcode: true,
              status: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.scanLog.count({ where }),
    ]);

    return {
      scanLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Sync tickets for offline validation
   * @deprecated Use syncTicketsStream instead for better performance
   */
  async authorizeSync(scannerId: string, eventId?: string): Promise<string> {
    const scanner = await prisma.scanner.findUnique({ where: { id: scannerId } });
    if (!scanner || scanner.status !== 'ACTIVE') throw ApiError.forbidden('Scanner is not active');
    const target = eventId || scanner.eventId;
    if (!target) throw ApiError.badRequest('Event ID is required for sync');
    const event = await prisma.event.findUnique({ where: { id: target } });
    if (
      !event ||
      event.organizationId !== scanner.organizationId ||
      (scanner.eventId && scanner.eventId !== target)
    ) {
      throw ApiError.forbidden('Scanner is not assigned to this event');
    }
    return target;
  }

  private syncStatus(ticket: {
    status: string;
    order: { status: string; refundStatus: string };
    event: { status: string; deletedAt: Date | null };
  }): string {
    if (orderDisputed(ticket.order.refundStatus) || ticket.status === 'CANCELLED')
      return 'CANCELLED';
    return ticket.order.status === 'PAID' &&
      ticket.order.refundStatus !== 'PROCESSING' &&
      !ticket.event.deletedAt &&
      ['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(ticket.event.status)
      ? ticket.status
      : 'CANCELLED';
  }

  async syncTickets(
    scannerId: string,
    eventId?: string,
    since?: Date
  ): Promise<{
    tickets: Array<{
      id: string;
      barcode: string;
      status: string;
      ticketTypeId: string;
      hash: string; // For integrity check
    }>;
    timestamp: Date;
  }> {
    const targetEventId = await this.authorizeSync(scannerId, eventId);
    const timestamp = new Date();
    const where: Prisma.TicketWhereInput = { eventId: targetEventId };
    if (since)
      where.OR = [
        { updatedAt: { gte: since } },
        { order: { updatedAt: { gte: since } } },
        { event: { updatedAt: { gte: since } } },
      ];
    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        barcode: true,
        status: true,
        ticketTypeId: true,
        updatedAt: true,
        order: { select: { status: true, refundStatus: true } },
        event: { select: { status: true, deletedAt: true } },
      },
    });

    // Map to minimal format
    const mappedTickets = tickets.map((t) => ({
      id: t.id,
      barcode: this.syncStatus(t) === 'CANCELLED' ? '' : t.barcode,
      status: this.syncStatus(t),
      ticketTypeId: t.ticketTypeId,
      hash: crypto
        .createHash('sha256')
        .update(
          `${t.id}:${this.syncStatus(t) === 'CANCELLED' ? '' : t.barcode}:${this.syncStatus(t)}`
        )
        .digest('hex')
        .substring(0, 16),
    }));

    return {
      tickets: mappedTickets,
      timestamp,
    };
  }

  /**
   * Sync tickets for offline validation (Streamed)
   */
  async *syncTicketsStream(
    scannerId: string,
    eventId?: string,
    since?: Date,
    batchSize = 1000
  ): AsyncGenerator<
    Array<{
      id: string;
      barcode: string;
      status: string;
      ticketTypeId: string;
      hash: string;
    }>
  > {
    const targetEventId = await this.authorizeSync(scannerId, eventId);
    const where: Prisma.TicketWhereInput = { eventId: targetEventId };
    if (since)
      where.OR = [
        { updatedAt: { gte: since } },
        { order: { updatedAt: { gte: since } } },
        { event: { updatedAt: { gte: since } } },
      ];
    let cursor: string | undefined;

    while (true) {
      await this.authorizeSync(scannerId, targetEventId);
      const tickets = await prisma.ticket.findMany({
        where,
        take: batchSize,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          barcode: true,
          status: true,
          ticketTypeId: true,
          order: { select: { status: true, refundStatus: true } },
          event: { select: { status: true, deletedAt: true } },
        },
      });

      if (tickets.length === 0) {
        break;
      }

      // Update cursor
      cursor = tickets[tickets.length - 1].id;

      // Map to minimal format
      const mappedTickets = tickets.map((t) => ({
        id: t.id,
        barcode: this.syncStatus(t) === 'CANCELLED' ? '' : t.barcode,
        status: this.syncStatus(t),
        ticketTypeId: t.ticketTypeId,
        hash: crypto
          .createHash('sha256')
          .update(
            `${t.id}:${this.syncStatus(t) === 'CANCELLED' ? '' : t.barcode}:${this.syncStatus(t)}`
          )
          .digest('hex')
          .substring(0, 16),
      }));

      yield mappedTickets;

      if (tickets.length < batchSize) {
        break;
      }
    }
  }

  /**
   * Process offline scans
   */
  async processOfflineScans(
    scannerId: string,
    scans: Array<{
      qrData: string;
      scannedAt: string; // ISO string from client
      scanType: 'ENTRY' | 'EXIT' | 'VALIDATION';
      metadata?: Record<string, unknown>;
    }>
  ): Promise<{
    processed: number;
    success: number;
    failed: number;
    results: Array<{
      qrData: string;
      success: boolean;
      reason?: string;
    }>;
  }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const scan of scans) {
      try {
        // The server records when admission is accepted. Client timestamps are
        // claims retained in metadata and must not rewrite committed history.
        const claimedTime = new Date(scan.scannedAt).getTime();
        if (!Number.isFinite(claimedTime) || claimedTime > Date.now() + 300_000) {
          throw ApiError.badRequest('Invalid offline scan timestamp');
        }

        const result = await this.scanTicket({
          scannerId,
          qrData: scan.qrData,
          scanType: scan.scanType,
          metadata: { ...scan.metadata, offline: true, scannedAt: scan.scannedAt },
        });

        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }

        results.push({
          qrData: scan.qrData,
          success: result.success,
          reason: result.reason,
        });
      } catch (error) {
        failedCount++;
        results.push({
          qrData: scan.qrData,
          success: false,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processed: scans.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }
}

export const scannerService = new ScannerService();

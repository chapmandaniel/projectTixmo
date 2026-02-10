import { Scanner, ScanLog, ScannerStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { parseTicketQRData } from '../../utils/qrcode';
import crypto from 'crypto';

import prisma from '../../config/prisma';

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
    // Parse QR code data
    const qrParsed = parseTicketQRData(data.qrData);

    if (!qrParsed) {
      // Log failed scan
      const failedLog = await prisma.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId: '00000000-0000-0000-0000-000000000000', // Invalid ticket
          eventId: '00000000-0000-0000-0000-000000000000', // Invalid event
          scanType: data.scanType,
          success: false,
          failureReason: 'Invalid QR code format',
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        reason: 'Invalid QR code format',
        scanLog: failedLog,
      };
    }

    const { ticketId, eventId } = qrParsed;

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        ticketType: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      const failedLog = await prisma.scanLog.create({
        data: {
          scannerId: data.scannerId,
          ticketId,
          eventId,
          scanType: data.scanType,
          success: false,
          failureReason: 'Ticket not found',
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        reason: 'Ticket not found',
        scanLog: failedLog,
      };
    }

    // Validate ticket
    let failureReason: string | undefined;

    if (ticket.status === 'CANCELLED') {
      failureReason = 'Ticket has been cancelled';
    } else if (ticket.status === 'USED' && data.scanType === 'ENTRY') {
      failureReason = 'Ticket has already been used';
    } else if (ticket.eventId !== eventId) {
      failureReason = 'Ticket is for a different event';
    } else if (ticket.event.status !== 'PUBLISHED') {
      failureReason = 'Event is not published';
    }

    // Create scan log
    const scanLog = await prisma.scanLog.create({
      data: {
        scannerId: data.scannerId,
        ticketId,
        eventId,
        scanType: data.scanType,
        success: !failureReason,
        failureReason,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });

    if (failureReason) {
      return {
        success: false,
        reason: failureReason,
        ticket,
        scanLog,
      };
    }

    // Mark ticket as used for ENTRY scans
    if (data.scanType === 'ENTRY' && ticket.status === 'VALID') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'USED',
          checkedInAt: new Date(),
        },
      });
    }

    return {
      success: true,
      ticket,
      scanLog,
    };
  }

  /**
   * Get scan logs
   */
  async getScanLogs(params: ListScanLogsParams): Promise<PaginatedScanLogs> {
    const { page = 1, limit = 20, scannerId, ticketId, eventId, success } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ScanLogWhereInput = {};
    if (scannerId) where.scannerId = scannerId;
    if (ticketId) where.ticketId = ticketId;
    if (eventId) where.eventId = eventId;
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
    // Get scanner to verify permissions
    const scanner = await prisma.scanner.findUnique({
      where: { id: scannerId },
    });

    if (!scanner) {
      throw ApiError.notFound('Scanner not found');
    }

    // Determine event ID
    const targetEventId = eventId || scanner.eventId;
    if (!targetEventId) {
      throw ApiError.badRequest('Event ID is required for sync');
    }

    // Verify scanner access to event
    if (scanner.eventId && scanner.eventId !== targetEventId) {
      throw ApiError.forbidden('Scanner is not assigned to this event');
    }

    // Fetch tickets
    const where: Prisma.TicketWhereInput = {
      eventId: targetEventId,
      status: { in: ['VALID', 'USED'] }, // Only sync relevant tickets
    };

    if (since) {
      where.updatedAt = { gte: since };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        id: true,
        barcode: true,
        status: true,
        ticketTypeId: true,
        updatedAt: true,
      },
    });

    // Map to minimal format
    const mappedTickets = tickets.map((t) => ({
      id: t.id,
      barcode: t.barcode,
      status: t.status,
      ticketTypeId: t.ticketTypeId,
      hash: crypto
        .createHash('sha256')
        .update(`${t.id}:${t.barcode}:${t.status}`)
        .digest('hex')
        .substring(0, 16),
    }));

    return {
      tickets: mappedTickets,
      timestamp: new Date(),
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
    // Get scanner to verify permissions
    const scanner = await prisma.scanner.findUnique({
      where: { id: scannerId },
    });

    if (!scanner) {
      throw ApiError.notFound('Scanner not found');
    }

    // Determine event ID
    const targetEventId = eventId || scanner.eventId;
    if (!targetEventId) {
      throw ApiError.badRequest('Event ID is required for sync');
    }

    // Verify scanner access to event
    if (scanner.eventId && scanner.eventId !== targetEventId) {
      throw ApiError.forbidden('Scanner is not assigned to this event');
    }

    // Fetch tickets
    const where: Prisma.TicketWhereInput = {
      eventId: targetEventId,
      status: { in: ['VALID', 'USED'] }, // Only sync relevant tickets
    };

    if (since) {
      where.updatedAt = { gte: since };
    }

    let cursor: string | undefined;

    while (true) {
      const params: Prisma.TicketFindManyArgs = {
        where,
        take: batchSize,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          barcode: true,
          status: true,
          ticketTypeId: true,
          updatedAt: true,
        },
      };

      if (cursor) {
        params.cursor = { id: cursor };
        params.skip = 1;
      }

      const tickets = await prisma.ticket.findMany(params);

      if (tickets.length === 0) {
        break;
      }

      // Update cursor
      cursor = tickets[tickets.length - 1].id;

      // Map to minimal format
      const mappedTickets = tickets.map((t) => ({
        id: t.id,
        barcode: t.barcode,
        status: t.status,
        ticketTypeId: t.ticketTypeId,
        hash: crypto
          .createHash('sha256')
          .update(`${t.id}:${t.barcode}:${t.status}`)
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
        // Reuse scanTicket logic but with specific timestamp
        // Note: scanTicket uses current time for check-in, we might need to adjust it or accept it's "synced at" time
        // For accurate history, we should ideally respect scannedAt.
        // However, scanTicket method doesn't accept timestamp override currently.
        // Let's call scanTicket and if successful, update the log's timestamp manually.

        const result = await this.scanTicket({
          scannerId,
          qrData: scan.qrData,
          scanType: scan.scanType,
          metadata: { ...scan.metadata, offline: true, scannedAt: scan.scannedAt },
        });

        if (result.success) {
          successCount++;
          // Update the log timestamp to reflect actual scan time
          await prisma.scanLog.update({
            where: { id: result.scanLog.id },
            data: { scannedAt: new Date(scan.scannedAt) },
          });

          // Also update ticket checkedInAt if it was an entry scan
          if (scan.scanType === 'ENTRY' && result.ticket) {
            // We can't easily access the ticket update from here without re-querying or modifying scanTicket return
            // But scanTicket updates checkedInAt to NOW. We should correct it.
            await prisma.ticket.update({
              where: { id: (result.ticket as any).id },
              data: { checkedInAt: new Date(scan.scannedAt) },
            });
          }
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

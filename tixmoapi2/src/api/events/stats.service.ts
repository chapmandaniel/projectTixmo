import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const prisma = new PrismaClient();

interface EventStats {
  eventId: string;
  eventName: string;
  totalTickets: number;
  ticketsSold: number;
  ticketsUsed: number;
  ticketsValid: number;
  ticketsCancelled: number;
  currentOccupancy: number;
  entryCount: number;
  exitCount: number;
  scanSuccessRate: number;
  lastScanAt?: Date;
}

interface EntryTimeline {
  timestamp: Date;
  entryCount: number;
  exitCount: number;
  occupancy: number;
}

export class EventStatsService {
  /**
   * Get real-time event statistics
   */
  async getEventStats(eventId: string): Promise<EventStats> {
    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Get ticket counts by status
    const [totalTickets, ticketsSold, ticketsUsed, ticketsValid, ticketsCancelled] =
      await Promise.all([
        prisma.ticket.count({ where: { eventId } }),
        prisma.ticket.count({
          where: {
            eventId,
            status: { in: ['VALID', 'USED', 'TRANSFERRED'] },
          },
        }),
        prisma.ticket.count({ where: { eventId, status: 'USED' } }),
        prisma.ticket.count({ where: { eventId, status: 'VALID' } }),
        prisma.ticket.count({ where: { eventId, status: 'CANCELLED' } }),
      ]);

    // Get scan statistics
    const [entryScans, exitScans, successfulScans, totalScans, lastScan] = await Promise.all([
      prisma.scanLog.count({
        where: { eventId, scanType: 'ENTRY', success: true },
      }),
      prisma.scanLog.count({
        where: { eventId, scanType: 'EXIT', success: true },
      }),
      prisma.scanLog.count({ where: { eventId, success: true } }),
      prisma.scanLog.count({ where: { eventId } }),
      prisma.scanLog.findFirst({
        where: { eventId },
        orderBy: { scannedAt: 'desc' },
        select: { scannedAt: true },
      }),
    ]);

    // Calculate current occupancy (entries - exits)
    const currentOccupancy = entryScans - exitScans;

    // Calculate scan success rate
    const scanSuccessRate = totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

    return {
      eventId,
      eventName: event.name,
      totalTickets,
      ticketsSold,
      ticketsUsed,
      ticketsValid,
      ticketsCancelled,
      currentOccupancy: Math.max(0, currentOccupancy), // Ensure non-negative
      entryCount: entryScans,
      exitCount: exitScans,
      scanSuccessRate: Math.round(scanSuccessRate * 100) / 100, // Round to 2 decimals
      lastScanAt: lastScan?.scannedAt,
    };
  }

  /**
   * Get entry timeline for event (hourly breakdown)
   */
  async getEntryTimeline(eventId: string, hours = 24): Promise<EntryTimeline[]> {
    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Get scans for the time period
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const scans = await prisma.scanLog.findMany({
      where: {
        eventId,
        scannedAt: { gte: startTime },
        success: true,
      },
      orderBy: { scannedAt: 'asc' },
      select: {
        scannedAt: true,
        scanType: true,
      },
    });

    // Group by hour
    const timelineMap = new Map<string, { entries: number; exits: number }>();

    scans.forEach((scan) => {
      const hour = new Date(scan.scannedAt);
      hour.setMinutes(0, 0, 0); // Round to hour
      const key = hour.toISOString();

      const current = timelineMap.get(key) || { entries: 0, exits: 0 };

      if (scan.scanType === 'ENTRY') {
        current.entries++;
      } else if (scan.scanType === 'EXIT') {
        current.exits++;
      }

      timelineMap.set(key, current);
    });

    // Convert to timeline array with cumulative occupancy
    const timeline: EntryTimeline[] = [];
    let cumulativeOccupancy = 0;

    Array.from(timelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([timestamp, counts]) => {
        cumulativeOccupancy += counts.entries - counts.exits;

        timeline.push({
          timestamp: new Date(timestamp),
          entryCount: counts.entries,
          exitCount: counts.exits,
          occupancy: Math.max(0, cumulativeOccupancy),
        });
      });

    return timeline;
  }

  /**
   * Get current occupancy for event
   */
  async getCurrentOccupancy(eventId: string): Promise<{
    eventId: string;
    currentOccupancy: number;
    capacity: number;
    percentageFull: number;
  }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { capacity: true },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    const [entryCount, exitCount] = await Promise.all([
      prisma.scanLog.count({
        where: { eventId, scanType: 'ENTRY', success: true },
      }),
      prisma.scanLog.count({
        where: { eventId, scanType: 'EXIT', success: true },
      }),
    ]);

    const currentOccupancy = Math.max(0, entryCount - exitCount);
    // Fix: Handle null capacity and potential division by zero
    const capacity = event.capacity || 0;
    const percentageFull = capacity > 0 ? (currentOccupancy / capacity) * 100 : 0;

    return {
      eventId,
      currentOccupancy,
      capacity,
      percentageFull: Math.round(percentageFull * 100) / 100,
    };
  }

  /**
   * Get scanner statistics for event
   */
  async getScannerStats(eventId: string): Promise<{
    totalScanners: number;
    activeScanners: number;
    scannerActivity: Array<{
      scannerId: string;
      scannerName: string;
      scanCount: number;
      successRate: number;
      lastScanAt?: Date;
    }>;
  }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Get scanners for this event
    const scanners = await prisma.scanner.findMany({
      where: {
        OR: [{ eventId }, { organizationId: event.organizationId, eventId: null }],
      },
    });

    const activeScanners = scanners.filter((s) => s.status === 'ACTIVE').length;

    // Get scan activity per scanner
    const scannerActivity = await Promise.all(
      scanners.map(async (scanner) => {
        const [totalScans, successfulScans, lastScan] = await Promise.all([
          prisma.scanLog.count({
            where: { scannerId: scanner.id, eventId },
          }),
          prisma.scanLog.count({
            where: { scannerId: scanner.id, eventId, success: true },
          }),
          prisma.scanLog.findFirst({
            where: { scannerId: scanner.id, eventId },
            orderBy: { scannedAt: 'desc' },
            select: { scannedAt: true },
          }),
        ]);

        const successRate = totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

        return {
          scannerId: scanner.id,
          scannerName: scanner.name,
          scanCount: totalScans,
          successRate: Math.round(successRate * 100) / 100,
          lastScanAt: lastScan?.scannedAt,
        };
      })
    );

    return {
      totalScanners: scanners.length,
      activeScanners,
      scannerActivity: scannerActivity.sort((a, b) => b.scanCount - a.scanCount),
    };
  }
}

export const eventStatsService = new EventStatsService();

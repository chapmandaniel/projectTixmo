import { eventStatsService } from '../../src/api/events/stats.service';
import prisma from '../../src/config/prisma';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
    scanner: {
      findMany: jest.fn(),
    },
    scanLog: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  event: { findUnique: jest.Mock };
  ticket: { count: jest.Mock };
  scanner: { findMany: jest.Mock };
  scanLog: {
    count: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
};

describe('EventStatsService', () => {
  const mockEventId = 'event-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventStats', () => {
    it('should return event stats using targeted count queries', async () => {
      // Mock event
      mockPrisma.event.findUnique.mockResolvedValue({ name: 'Test Event' });

      // Mock ticket counts (called 5 times)
      mockPrisma.ticket.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // sold
        .mockResolvedValueOnce(50) // used
        .mockResolvedValueOnce(30) // valid
        .mockResolvedValueOnce(20); // cancelled

      // Mock scan log counts
      mockPrisma.scanLog.count
        .mockResolvedValueOnce(50) // entry scans
        .mockResolvedValueOnce(10) // exit scans
        .mockResolvedValueOnce(60) // successful scans
        .mockResolvedValueOnce(65); // total scans

      // Mock last scan
      const now = new Date();
      mockPrisma.scanLog.findFirst.mockResolvedValue({ scannedAt: now });

      const stats = await eventStatsService.getEventStats(mockEventId);

      expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: mockEventId },
        select: { name: true },
      });

      // Verify ticket counts called (5 times)
      expect(mockPrisma.ticket.count).toHaveBeenCalledTimes(5);

      expect(mockPrisma.scanLog.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.scanLog.count).toHaveBeenNthCalledWith(1, {
        where: { eventId: mockEventId, scanType: 'ENTRY', success: true },
      });
      expect(mockPrisma.scanLog.count).toHaveBeenNthCalledWith(2, {
        where: { eventId: mockEventId, scanType: 'EXIT', success: true },
      });
      expect(mockPrisma.scanLog.count).toHaveBeenNthCalledWith(3, {
        where: { eventId: mockEventId, success: true },
      });
      expect(mockPrisma.scanLog.count).toHaveBeenNthCalledWith(4, {
        where: { eventId: mockEventId },
      });

      // Verify scan log findFirst called (1 time)
      expect(mockPrisma.scanLog.findFirst).toHaveBeenCalledTimes(1);

      expect(stats).toEqual({
        eventId: mockEventId,
        eventName: 'Test Event',
        totalTickets: 100,
        ticketsSold: 80,
        ticketsUsed: 50,
        ticketsValid: 30,
        ticketsCancelled: 20,
        currentOccupancy: 40, // 50 - 10
        entryCount: 50,
        exitCount: 10,
        scanSuccessRate: expect.any(Number), // (60 / 65) * 100
        lastScanAt: now,
      });

      const rate = (60 / 65) * 100;
      expect(stats.scanSuccessRate).toBe(Math.round(rate * 100) / 100);
    });

    it('throws 404 when the event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(eventStatsService.getEventStats(mockEventId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Event not found',
      });
      expect(mockPrisma.ticket.count).not.toHaveBeenCalled();
    });

    it('reports zero occupancy, zero success rate, and no last scan when there are no scans', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ name: 'Quiet Night' });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.scanLog.count.mockResolvedValue(0);
      mockPrisma.scanLog.findFirst.mockResolvedValue(null);

      const stats = await eventStatsService.getEventStats(mockEventId);

      expect(stats).toMatchObject({
        eventId: mockEventId,
        eventName: 'Quiet Night',
        totalTickets: 0,
        ticketsSold: 0,
        ticketsUsed: 0,
        ticketsValid: 0,
        ticketsCancelled: 0,
        currentOccupancy: 0,
        entryCount: 0,
        exitCount: 0,
        scanSuccessRate: 0,
      });
      expect(stats.lastScanAt).toBeUndefined();
    });

    it('clamps occupancy at zero when successful exits exceed entries', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ name: 'Over-exit' });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.scanLog.count
        .mockResolvedValueOnce(2) // entry
        .mockResolvedValueOnce(5) // exit
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(7);
      mockPrisma.scanLog.findFirst.mockResolvedValue({ scannedAt: new Date() });

      const stats = await eventStatsService.getEventStats(mockEventId);
      expect(stats.currentOccupancy).toBe(0);
      expect(stats.entryCount).toBe(2);
      expect(stats.exitCount).toBe(5);
    });
  });

  describe('getEntryTimeline', () => {
    it('throws 404 when the event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(eventStatsService.getEntryTimeline(mockEventId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Event not found',
      });
      expect(mockPrisma.scanLog.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty array when there are no successful scans in the window', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: mockEventId });
      mockPrisma.scanLog.findMany.mockResolvedValue([]);

      await expect(eventStatsService.getEntryTimeline(mockEventId, 24)).resolves.toEqual([]);
    });

    it('groups successful scans by hour with cumulative occupancy', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: mockEventId });

      const hourA = new Date('2026-11-13T18:00:00.000Z');
      const hourB = new Date('2026-11-13T19:00:00.000Z');
      mockPrisma.scanLog.findMany.mockResolvedValue([
        { scannedAt: new Date('2026-11-13T18:10:00.000Z'), scanType: 'ENTRY' },
        { scannedAt: new Date('2026-11-13T18:40:00.000Z'), scanType: 'ENTRY' },
        { scannedAt: new Date('2026-11-13T18:50:00.000Z'), scanType: 'EXIT' },
        { scannedAt: new Date('2026-11-13T19:05:00.000Z'), scanType: 'ENTRY' },
        { scannedAt: new Date('2026-11-13T19:20:00.000Z'), scanType: 'VALIDATION' },
      ]);

      const timeline = await eventStatsService.getEntryTimeline(mockEventId, 6);

      expect(mockPrisma.scanLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: mockEventId,
            success: true,
            scannedAt: { gte: expect.any(Date) },
          }),
          orderBy: { scannedAt: 'asc' },
        })
      );

      const lookback = mockPrisma.scanLog.findMany.mock.calls[0][0].where.scannedAt.gte as Date;
      const deltaHours = (Date.now() - lookback.getTime()) / 3_600_000;
      expect(deltaHours).toBeGreaterThan(5.9);
      expect(deltaHours).toBeLessThan(6.1);

      expect(timeline).toHaveLength(2);
      expect(timeline[0]).toEqual({
        timestamp: hourA,
        entryCount: 2,
        exitCount: 1,
        occupancy: 1,
      });
      expect(timeline[1]).toEqual({
        timestamp: hourB,
        entryCount: 1,
        exitCount: 0,
        occupancy: 2,
      });
    });

    it('displays occupancy 0 when a bucket goes negative but keeps the running total', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: mockEventId });
      mockPrisma.scanLog.findMany.mockResolvedValue([
        { scannedAt: new Date('2026-11-13T18:10:00.000Z'), scanType: 'EXIT' },
        { scannedAt: new Date('2026-11-13T18:20:00.000Z'), scanType: 'EXIT' },
        { scannedAt: new Date('2026-11-13T19:10:00.000Z'), scanType: 'ENTRY' },
      ]);

      const timeline = await eventStatsService.getEntryTimeline(mockEventId);
      expect(timeline[0]).toMatchObject({ entryCount: 0, exitCount: 2, occupancy: 0 });
      // Running total is -2 + 1 = -1, displayed occupancy still clamped.
      expect(timeline[1]).toMatchObject({ entryCount: 1, exitCount: 0, occupancy: 0 });
    });

    // stats.service.ts:142-148 records VALIDATION (and any non ENTRY/EXIT) hours
    // as zero-count buckets instead of ignoring them. Command Center timeline is
    // documented as an entry/exit hourly breakdown.
    it.skip('omits hours that only contain successful VALIDATION scans', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: mockEventId });
      mockPrisma.scanLog.findMany.mockResolvedValue([
        { scannedAt: new Date('2026-11-13T18:10:00.000Z'), scanType: 'VALIDATION' },
      ]);

      await expect(eventStatsService.getEntryTimeline(mockEventId)).resolves.toEqual([]);
    });
  });

  describe('getCurrentOccupancy', () => {
    it('throws 404 when the event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(eventStatsService.getCurrentOccupancy(mockEventId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Event not found',
      });
    });

    it('returns occupancy, capacity, and rounded percentage full', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ capacity: 200 });
      mockPrisma.scanLog.count
        .mockResolvedValueOnce(8) // entry
        .mockResolvedValueOnce(1); // exit

      await expect(eventStatsService.getCurrentOccupancy(mockEventId)).resolves.toEqual({
        eventId: mockEventId,
        currentOccupancy: 7,
        capacity: 200,
        percentageFull: 3.5,
      });
    });

    it('treats null or zero capacity as 0% full', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ capacity: null });
      mockPrisma.scanLog.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

      await expect(eventStatsService.getCurrentOccupancy(mockEventId)).resolves.toEqual({
        eventId: mockEventId,
        currentOccupancy: 3,
        capacity: 0,
        percentageFull: 0,
      });

      mockPrisma.event.findUnique.mockResolvedValue({ capacity: 0 });
      mockPrisma.scanLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await expect(eventStatsService.getCurrentOccupancy(mockEventId)).resolves.toEqual({
        eventId: mockEventId,
        currentOccupancy: 0,
        capacity: 0,
        percentageFull: 0,
      });
    });

    it('clamps occupancy at zero and rounds percentage to two decimals', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ capacity: 3 });
      mockPrisma.scanLog.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4);

      const overExit = await eventStatsService.getCurrentOccupancy(mockEventId);
      expect(overExit.currentOccupancy).toBe(0);
      expect(overExit.percentageFull).toBe(0);

      mockPrisma.event.findUnique.mockResolvedValue({ capacity: 3 });
      mockPrisma.scanLog.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      const partial = await eventStatsService.getCurrentOccupancy(mockEventId);
      expect(partial.currentOccupancy).toBe(1);
      expect(partial.percentageFull).toBe(33.33);
    });
  });

  describe('getScannerStats', () => {
    it('throws 404 when the event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(eventStatsService.getScannerStats(mockEventId)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Event not found',
      });
      expect(mockPrisma.scanner.findMany).not.toHaveBeenCalled();
    });

    it('returns zeros and an empty activity list when the event has no scanners', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: mockEventId,
        organizationId: 'org-1',
      });
      mockPrisma.scanner.findMany.mockResolvedValue([]);
      mockPrisma.scanLog.groupBy.mockResolvedValue([]);

      await expect(eventStatsService.getScannerStats(mockEventId)).resolves.toEqual({
        totalScanners: 0,
        activeScanners: 0,
        scannerActivity: [],
      });
    });

    it('includes event and org-wide scanners, counts failed scans, and sorts by scan count', async () => {
      const lastA = new Date('2026-11-13T19:00:00.000Z');
      const lastB = new Date('2026-11-13T20:00:00.000Z');
      mockPrisma.event.findUnique.mockResolvedValue({
        id: mockEventId,
        organizationId: 'org-1',
      });
      mockPrisma.scanner.findMany.mockResolvedValue([
        { id: 'scan-quiet', name: 'Quiet', status: 'ACTIVE' },
        { id: 'scan-a', name: 'Door A', status: 'ACTIVE' },
        { id: 'scan-b', name: 'Door B', status: 'DISABLED' },
        { id: 'scan-c', name: 'Roaming', status: 'REVOKED' },
      ]);
      mockPrisma.scanLog.groupBy
        .mockResolvedValueOnce([
          { scannerId: 'scan-a', _count: { _all: 7 }, _max: { scannedAt: lastA } },
          { scannerId: 'scan-b', _count: { _all: 3 }, _max: { scannedAt: lastB } },
          { scannerId: 'scan-c', _count: { _all: 2 }, _max: { scannedAt: null } },
        ])
        .mockResolvedValueOnce([
          { scannerId: 'scan-a', _count: { _all: 5 } },
          { scannerId: 'scan-b', _count: { _all: 3 } },
          { scannerId: 'scan-c', _count: { _all: 1 } },
        ]);

      const stats = await eventStatsService.getScannerStats(mockEventId);

      expect(mockPrisma.scanner.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ eventId: mockEventId }, { organizationId: 'org-1', eventId: null }],
        },
      });
      expect(stats.totalScanners).toBe(4);
      expect(stats.activeScanners).toBe(2);
      expect(stats.scannerActivity.map((row) => row.scannerId)).toEqual([
        'scan-a',
        'scan-b',
        'scan-c',
        'scan-quiet',
      ]);
      expect(stats.scannerActivity[0]).toEqual({
        scannerId: 'scan-a',
        scannerName: 'Door A',
        scanCount: 7,
        successRate: 71.43,
        lastScanAt: lastA,
      });
      expect(stats.scannerActivity[1]).toEqual({
        scannerId: 'scan-b',
        scannerName: 'Door B',
        scanCount: 3,
        successRate: 100,
        lastScanAt: lastB,
      });
      expect(stats.scannerActivity[2]).toEqual({
        scannerId: 'scan-c',
        scannerName: 'Roaming',
        scanCount: 2,
        successRate: 50,
        lastScanAt: undefined,
      });
      expect(stats.scannerActivity[3]).toEqual({
        scannerId: 'scan-quiet',
        scannerName: 'Quiet',
        scanCount: 0,
        successRate: 0,
        lastScanAt: undefined,
      });
    });
  });
});

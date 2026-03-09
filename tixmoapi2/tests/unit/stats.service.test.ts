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
    scanLog: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('EventStatsService', () => {
  const mockEventId = 'event-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventStats', () => {
    it('should return event stats using targeted count queries', async () => {
      // Mock event
      (prisma.event.findUnique as jest.Mock).mockResolvedValue({ name: 'Test Event' });

      // Mock ticket counts (called 5 times)
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // sold
        .mockResolvedValueOnce(50)  // used
        .mockResolvedValueOnce(30)  // valid
        .mockResolvedValueOnce(20); // cancelled

      // Mock scan log counts
      (prisma.scanLog.count as jest.Mock)
        .mockResolvedValueOnce(50) // entry scans
        .mockResolvedValueOnce(10) // exit scans
        .mockResolvedValueOnce(60) // successful scans
        .mockResolvedValueOnce(65); // total scans

      // Mock last scan
      const now = new Date();
      (prisma.scanLog.findFirst as jest.Mock).mockResolvedValue({ scannedAt: now });

      const stats = await eventStatsService.getEventStats(mockEventId);

      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: mockEventId },
        select: { name: true },
      });

      // Verify ticket counts called (5 times)
      expect(prisma.ticket.count).toHaveBeenCalledTimes(5);

      expect(prisma.scanLog.count).toHaveBeenCalledTimes(4);
      expect(prisma.scanLog.count).toHaveBeenNthCalledWith(1, {
        where: { eventId: mockEventId, scanType: 'ENTRY', success: true },
      });
      expect(prisma.scanLog.count).toHaveBeenNthCalledWith(2, {
        where: { eventId: mockEventId, scanType: 'EXIT', success: true },
      });
      expect(prisma.scanLog.count).toHaveBeenNthCalledWith(3, {
        where: { eventId: mockEventId, success: true },
      });
      expect(prisma.scanLog.count).toHaveBeenNthCalledWith(4, {
        where: { eventId: mockEventId },
      });

      // Verify scan log findFirst called (1 time)
      expect(prisma.scanLog.findFirst).toHaveBeenCalledTimes(1);

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
  });
});

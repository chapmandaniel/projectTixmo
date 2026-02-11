
import { reportService } from '../../src/api/reports/service';
import prisma from '../../src/config/prisma';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
  },
}));

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should use aggregate for revenue calculation', async () => {
      // Mock data
      (prisma.event.findMany as jest.Mock).mockResolvedValue([{ id: 'event-1' }]);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 5000 },
      });
      (prisma.ticket.count as jest.Mock).mockResolvedValue(100);
      (prisma.event.count as jest.Mock).mockResolvedValue(5);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]); // for recentOrders

      const stats = await reportService.getDashboardStats({ organizationId: 'org-1' });

      // Verify aggregate was called
      expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);
      expect(prisma.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        _sum: { totalAmount: true },
      }));

      // Verify result
      expect(stats.totalRevenue).toBe(5000);
    });

    it('should handle null revenue (no orders)', async () => {
      // Mock data
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: null },
      });
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);
      (prisma.event.count as jest.Mock).mockResolvedValue(0);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await reportService.getDashboardStats({});

      // Verify aggregate was called
      expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);

      // Verify result
      expect(stats.totalRevenue).toBe(0);
    });
  });
});

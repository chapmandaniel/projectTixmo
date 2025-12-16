import { PrismaClient, Waitlist } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const prisma = new PrismaClient();

export class WaitlistService {
  /**
   * Join waitlist for an event
   */
  async joinWaitlist(userId: string, eventId: string): Promise<Waitlist> {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Check if already on waitlist
    const existing = await prisma.waitlist.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('User already on waitlist for this event');
    }

    // Add to waitlist
    return await prisma.waitlist.create({
      data: {
        userId,
        eventId,
        status: 'PENDING',
      },
    });
  }

  /**
   * Leave waitlist for an event
   */
  async leaveWaitlist(userId: string, eventId: string): Promise<void> {
    const existing = await prisma.waitlist.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!existing) {
      throw ApiError.notFound('User not on waitlist for this event');
    }

    await prisma.waitlist.delete({
      where: {
        id: existing.id,
      },
    });
  }

  /**
   * Get waitlist status for a user and event
   */
  async getWaitlistStatus(userId: string, eventId: string): Promise<Waitlist | null> {
    return await prisma.waitlist.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
  }

  /**
   * Process waitlist (Stub for now)
   * In a real system, this would be called when tickets become available (e.g. order cancellation, capacity increase).
   * It would find the oldest pending waitlist entries and notify users.
   */
  async processWaitlist(_eventId: string): Promise<void> {
    // 1. Check available inventory
    // 2. Find pending waitlist entries ordered by createdAt ASC
    // 3. Notify users and update status to NOTIFIED
    // console.log(`Processing waitlist for event ${eventId}`);
  }
}

export const waitlistService = new WaitlistService();

import { Waitlist } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { notificationService } from '../../utils/notificationService';

import prisma from '../../config/prisma';

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
   * Get user's position in the waitlist
   */
  async getWaitlistPosition(userId: string, eventId: string): Promise<number | null> {
    const entry = await prisma.waitlist.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (!entry || entry.status !== 'PENDING') return null;

    const position = await prisma.waitlist.count({
      where: {
        eventId,
        status: 'PENDING',
        createdAt: { lt: entry.createdAt },
      },
    });

    return position + 1; // 1-indexed
  }

  /**
   * Process waitlist when tickets become available
   * Finds oldest PENDING entries and notifies users.
   */
  async processWaitlist(eventId: string, maxNotify: number = 5): Promise<void> {
    // Find available ticket types for this event
    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        eventId,
        quantityAvailable: { gt: 0 },
        status: 'ACTIVE',
      },
    });

    if (ticketTypes.length === 0) return;

    // Find oldest pending waitlist entries
    const pendingEntries = await prisma.waitlist.findMany({
      where: {
        eventId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: maxNotify,
      include: {
        user: { select: { email: true, firstName: true } },
      },
    });

    // Notify each user and update status
    for (const entry of pendingEntries) {
      try {
        await notificationService.sendEmail({
          to: entry.userId, // In production, use entry.user.email
          subject: 'Tickets Available!',
          html: `<p>Tickets are now available for an event you were waiting for. Hurry — limited availability!</p>`,
          text: `Tickets are now available for an event you were waiting for. Hurry — limited availability!`,
        });

        await prisma.waitlist.update({
          where: { id: entry.id },
          data: {
            status: 'NOTIFIED',
          },
        });
      } catch (error) {
        console.error(`Failed to notify waitlist entry ${entry.id}:`, error);
      }
    }
  }
}

export const waitlistService = new WaitlistService();


import { ApiError } from '@utils/ApiError';
import { Event, Prisma, EventStatus } from '@prisma/client';

import prisma from '../../config/prisma';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../config/logger';

interface CreateEventInput {
  title: string;
  description: string;
  organizationId: string;
  venueId: string;
  startDateTime: string;
  endDateTime: string;
  status?: EventStatus;
  capacity?: number;
  imageUrl?: string;
  metadata?: Prisma.InputJsonValue | null | undefined;
  category?: string;
  timezone?: string;
  tags?: string[];
}

interface UpdateEventInput {
  title?: string;
  description?: string;
  venueId?: string;
  startDateTime?: string;
  endDateTime?: string;
  status?: EventStatus;
  capacity?: number;
  imageUrl?: string;
  metadata?: Prisma.InputJsonValue | null | undefined;
  category?: string;
  timezone?: string;
  tags?: string[];
}


interface ListEventsParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  venueId?: string;
  status?: EventStatus;
  search?: string;
}

interface PaginatedEvents {
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Valid event status transitions.
 * Key = current status, Value = set of allowed next statuses.
 */
const VALID_STATUS_TRANSITIONS: Record<EventStatus, Set<EventStatus>> = {
  DRAFT: new Set(['PUBLISHED', 'DELETED']),
  PUBLISHED: new Set(['ON_SALE', 'CANCELLED', 'COMPLETED']),
  ON_SALE: new Set(['SOLD_OUT', 'CANCELLED', 'COMPLETED']),
  SOLD_OUT: new Set(['ON_SALE', 'CANCELLED', 'COMPLETED']), // ON_SALE if capacity increases
  CANCELLED: new Set([]), // Terminal state
  COMPLETED: new Set([]), // Terminal state
  DELETED: new Set(['DRAFT']), // Can be restored to DRAFT
};

export class EventService {
  /**
   * Generate a unique slug from a title, appending a suffix on collision.
   */
  private async generateUniqueSlug(baseTitle: string, excludeId?: string): Promise<string> {
    const baseSlug = baseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''); // trim leading/trailing dashes

    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await prisma.event.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Validate a status transition
   */
  private validateStatusTransition(currentStatus: EventStatus, newStatus: EventStatus): void {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.has(newStatus)) {
      throw ApiError.badRequest(
        `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
        `Allowed transitions from ${currentStatus}: ${allowedTransitions && allowedTransitions.size > 0
          ? Array.from(allowedTransitions).join(', ')
          : 'none (terminal state)'
        }`
      );
    }
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventInput): Promise<Event> {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Check if venue exists (only if provided)
    if (data.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: data.venueId },
      });

      if (!venue) {
        throw ApiError.notFound('Venue not found');
      }
    }

    // Validate dates (only if both provided)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (data.startDateTime) {
      startDate = new Date(data.startDateTime);
    }
    if (data.endDateTime) {
      endDate = new Date(data.endDateTime);
    }

    if (startDate && endDate) {
      if (endDate <= startDate) {
        throw ApiError.badRequest('End date/time must be after start date/time');
      }
    }

    // Generate unique slug from title (handles collisions)
    const slug = await this.generateUniqueSlug(data.title);

    // Create event
    return await prisma.event.create({
      data: {
        name: data.title,
        slug: slug,
        description: data.description || '', // Allow empty description for drafts
        organizationId: data.organizationId,
        venueId: data.venueId || null,
        startDatetime: startDate || null,
        endDatetime: endDate || null,
        timezone: data.timezone || null,
        status: data.status || 'DRAFT',
        capacity: data.capacity || null,
        category: data.category || null,
        tags: data.tags || [],
        images: data.imageUrl
          ? ({ main: data.imageUrl } as unknown as Prisma.InputJsonValue)
          : undefined,
        metadata:
          data.metadata !== undefined
            ? (data.metadata as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<Event | null> {
    return await prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            capacity: true,
            timezone: true,
          },
        },
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });
  }

  /**
   * Update event
   */
  async updateEvent(id: string, data: UpdateEventInput): Promise<Event> {
    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw ApiError.notFound('Event not found');
    }

    // If updating venue, check if it exists
    if (data.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: data.venueId },
      });

      if (!venue) {
        throw ApiError.notFound('Venue not found');
      }
    }

    // Validate status transition if status is being changed
    if (data.status && data.status !== existingEvent.status) {
      this.validateStatusTransition(existingEvent.status, data.status);
    }

    // Validate dates if both are provided or combined with existing
    const newStart = data.startDateTime ? new Date(data.startDateTime) : existingEvent.startDatetime;
    const newEnd = data.endDateTime ? new Date(data.endDateTime) : existingEvent.endDatetime;

    if (newStart && newEnd) {
      if (newEnd <= newStart) {
        throw ApiError.badRequest('End date/time must be after start date/time');
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.title) {
      updateData.name = data.title;
      // Only regenerate slug if event is still in DRAFT (preserve URLs for published events)
      if (existingEvent.status === 'DRAFT') {
        updateData.slug = await this.generateUniqueSlug(data.title, id);
      }
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.venueId) updateData.venueId = data.venueId;
    if (data.status) updateData.status = data.status;
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.category) updateData.category = data.category;
    if (data.timezone) updateData.timezone = data.timezone;
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata as unknown as Prisma.InputJsonValue;
    if (data.imageUrl)
      updateData.images = { main: data.imageUrl } as unknown as Prisma.InputJsonValue;

    if (data.startDateTime) {
      updateData.startDatetime = new Date(data.startDateTime);
    }
    if (data.endDateTime) {
      updateData.endDatetime = new Date(data.endDateTime);
    }

    // Update event
    const updatePayload = {
      ...updateData,
    } as unknown as Prisma.EventUpdateInput;

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updatePayload,
    });

    // Invalidate cache
    try {
      if (existingEvent.slug) {
        await getRedisClient().del(`public_event:slug:${existingEvent.slug}`);
      }
      // If slug changed, invalidate new one too (though unlikely needed immediately)
      if (updatedEvent.slug && updatedEvent.slug !== existingEvent.slug) {
        await getRedisClient().del(`public_event:slug:${updatedEvent.slug}`);
      }
    } catch (error) {
      logger.error('Redis cache invalidation error (updateEvent):', error);
    }

    return updatedEvent;
  }

  /**
   * Delete event
   */
  async deleteEvent(id: string): Promise<void> {
    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });

    if (!existingEvent) {
      throw ApiError.notFound('Event not found');
    }

    // Check if event has any tickets
    if (existingEvent._count.tickets > 0) {
      throw ApiError.badRequest(
        'Cannot delete event with existing tickets. Consider cancelling instead.'
      );
    }

    // Delete event (Soft Delete)
    await prisma.event.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DELETED',
      },
    });

    // Invalidate cache
    try {
      if (existingEvent.slug) {
        await getRedisClient().del(`public_event:slug:${existingEvent.slug}`);
      }
    } catch (error) {
      logger.error('Redis cache invalidation error (deleteEvent):', error);
    }
  }

  /**
   * Restore deleted event
   */
  async restoreEvent(id: string): Promise<Event> {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    if (!event.deletedAt) {
      throw ApiError.badRequest('Event is not deleted');
    }

    return await prisma.event.update({
      where: { id },
      data: {
        deletedAt: null,
        status: 'DRAFT', // Restore as DRAFT for safety
      },
    });
  }

  /**
   * List deleted events
   */
  async listDeletedEvents(
    organizationId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedEvents> {
    // Cap limit to prevent unbounded queries
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const where: Prisma.EventWhereInput = {
      organizationId,
      deletedAt: { not: null },
    };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { deletedAt: 'desc' },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              tickets: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page: safePage,
        limit: cappedLimit,
        total,
        pages: Math.ceil(total / cappedLimit),
      },
    };
  }

  /**
   * List events with pagination and filters
   */
  async listEvents(params: ListEventsParams): Promise<PaginatedEvents> {
    const { page = 1, limit = 20, organizationId, venueId, status, search } = params;
    // Cap limit to prevent unbounded queries
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    // Build where clause (use Prisma types)
    const where: Prisma.EventWhereInput = {
      deletedAt: null, // Only active events
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (venueId) {
      where.venueId = venueId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { startDatetime: 'asc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          _count: {
            select: {
              tickets: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page: safePage,
        limit: cappedLimit,
        total,
        pages: Math.ceil(total / cappedLimit),
      },
    };
  }

  /**
   * Generic event status transition (enforces state machine + readiness checks)
   */
  async transitionEventStatus(id: string, newStatus: EventStatus): Promise<Event> {
    // Delegate to existing methods for PUBLISHED and CANCELLED
    if (newStatus === EventStatus.PUBLISHED) return this.publishEvent(id);
    if (newStatus === EventStatus.CANCELLED) return this.cancelEvent(id);

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw ApiError.notFound('Event not found');
    if (event.deletedAt) throw ApiError.badRequest('Cannot transition a deleted event');

    this.validateStatusTransition(event.status, newStatus);

    return await prisma.event.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  /**
   * Publish event (change status from DRAFT to PUBLISHED)
   */
  async publishEvent(id: string): Promise<Event> {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    if (event.deletedAt) {
      throw ApiError.badRequest('Cannot publish a deleted event');
    }

    // Validate status transition
    this.validateStatusTransition(event.status, 'PUBLISHED');

    // Strictly validate required fields for publishing
    const missingFields = [];
    if (!event.venueId) missingFields.push('Venue');
    if (!event.startDatetime) missingFields.push('Start Date');
    if (!event.endDatetime) missingFields.push('End Date');
    if (!event.capacity) missingFields.push('Capacity');

    if (missingFields.length > 0) {
      throw ApiError.badRequest(`Cannot publish event. Missing required fields: ${missingFields.join(', ')}`);
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
      },
    });

    // Invalidate cache
    try {
      if (event.slug) {
        await getRedisClient().del(`public_event:slug:${event.slug}`);
      }
    } catch (error) {
      logger.error('Redis cache invalidation error (publishEvent):', error);
    }

    return updated;
  }

  /**
   * Cancel event — also invalidates all tickets and handles orders
   */
  async cancelEvent(id: string): Promise<Event> {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { in: ['PENDING', 'PAID'] } },
          include: { tickets: true },
        },
        ticketTypes: true,
      },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    if (event.deletedAt) {
      throw ApiError.badRequest('Cannot cancel a deleted event');
    }

    // Validate status transition
    this.validateStatusTransition(event.status, 'CANCELLED');

    // Cancel event and cascade to tickets/orders in a transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Cancel all VALID/TRANSFERRED tickets for this event
      await tx.ticket.updateMany({
        where: {
          eventId: id,
          status: { in: ['VALID', 'TRANSFERRED'] },
        },
        data: { status: 'CANCELLED' },
      });

      // 2. Handle PENDING orders — release held inventory
      for (const order of event.orders) {
        if (order.status === 'PENDING') {
          // Release held inventory
          const ticketTypeCounts = new Map<string, number>();
          for (const ticket of order.tickets) {
            const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
            ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
          }

          for (const [ticketTypeId, quantity] of ticketTypeCounts.entries()) {
            await tx.ticketType.update({
              where: { id: ticketTypeId },
              data: {
                quantityHeld: { decrement: quantity },
                quantityAvailable: { increment: quantity },
              },
            });
          }

          // Cancel the order
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          });

          // Cancel associated tickets
          await tx.ticket.updateMany({
            where: { orderId: order.id },
            data: { status: 'CANCELLED' },
          });
        }

        // Note: PAID orders are kept as-is for refund processing.
        // They should be refunded separately via the refund flow.
        // Mark them as needing attention by keeping their status.
      }

      // 3. Update event status
      const cancelledEvent = await tx.event.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      return cancelledEvent;
    });

    // Invalidate cache (outside transaction)
    try {
      if (event.slug) {
        await getRedisClient().del(`public_event:slug:${event.slug}`);
      }
    } catch (error) {
      logger.error('Redis cache invalidation error (cancelEvent):', error);
    }

    return result;
  }

  /**
   * Clone an event (with ticket types) as a new DRAFT
   */
  async cloneEvent(id: string): Promise<Event> {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: true },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    const slug = await this.generateUniqueSlug(`${event.name}-copy`);

    return await prisma.$transaction(async (tx) => {
      const cloned = await tx.event.create({
        data: {
          name: `${event.name} (Copy)`,
          slug,
          description: event.description || '',
          organizationId: event.organizationId,
          venueId: event.venueId,
          startDatetime: null,
          endDatetime: null,
          timezone: event.timezone,
          status: 'DRAFT',
          capacity: event.capacity,
          category: event.category,
          tags: event.tags,
          images: event.images as any,
          metadata: event.metadata as any,
        },
      });

      // Clone ticket types (reset quantities)
      for (const tt of event.ticketTypes) {
        await tx.ticketType.create({
          data: {
            eventId: cloned.id,
            name: tt.name,
            description: tt.description,
            price: tt.price,
            quantityTotal: tt.quantityTotal,
            quantityAvailable: tt.quantityTotal,
            maxPerOrder: tt.maxPerOrder,
            salesStart: null,
            salesEnd: null,
            sortOrder: tt.sortOrder,
          },
        });
      }

      return cloned;
    });
  }

  /**
   * List public events (no auth required)
   * Only shows PUBLISHED, ON_SALE, and SOLD_OUT events.
   */
  async listPublicEvents(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<PaginatedEvents> {
    const { page = 1, limit = 20, category, search } = params;
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const publicStatuses: EventStatus[] = [
      EventStatus.PUBLISHED,
      EventStatus.ON_SALE,
      EventStatus.SOLD_OUT,
    ];

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      status: { in: publicStatuses },
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { startDatetime: 'asc' },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          venue: {
            select: { id: true, name: true, address: true },
          },
          ticketTypes: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              price: true,
              quantityAvailable: true,
              salesStart: true,
              salesEnd: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page: safePage,
        limit: cappedLimit,
        total,
        pages: Math.ceil(total / cappedLimit),
      },
    };
  }

  /**
   * Get a single public event by slug (no auth required)
   * Returns full event detail with ticket types and their tiers.
   */
  async getPublicEventBySlug(slug: string): Promise<Event | null> {
    const cacheKey = `public_event:slug:${slug}`;

    try {
      const cachedEvent = await getRedisClient().get(cacheKey);
      if (cachedEvent) {
        return JSON.parse(cachedEvent, (_key, value) => {
          if (
            typeof value === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)
          ) {
            return new Date(value);
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return value;
        }) as Event;
      }
    } catch (error) {
      logger.error('Redis cache error (getPublicEventBySlug):', error);
    }

    const publicStatuses: EventStatus[] = [
      EventStatus.PUBLISHED,
      EventStatus.ON_SALE,
      EventStatus.SOLD_OUT,
    ];

    const event = await prisma.event.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: { in: publicStatuses },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        venue: {
          select: { id: true, name: true, address: true },
        },
        ticketTypes: {
          where: { status: 'ACTIVE' },
          include: {
            tiers: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (event) {
      try {
        await getRedisClient().set(cacheKey, JSON.stringify(event), { EX: 300 }); // 5 minutes TTL
      } catch (error) {
        logger.error('Redis cache error (set getPublicEventBySlug):', error);
      }
    }

    return event;
  }
}
export const eventService = new EventService();

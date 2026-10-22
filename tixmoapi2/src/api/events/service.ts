import { ApiError } from '@utils/ApiError';
import { Event, Prisma, EventStatus } from '@prisma/client';

import prisma from '../../config/prisma';
import { ActorScope, assertOrganizationAccess } from '../../utils/tenantScope';
import { lockOrder } from '../../services/order-inventory.service';
import { orderService } from '../orders/service';

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
  private assertTimeZone(zone?: string) {
    if (zone !== undefined) {
      try {
        if (!zone) throw new Error();
        new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format();
      } catch {
        throw ApiError.badRequest('Invalid IANA event timezone');
      }
    }
  }
  /**
   * Get user's organization ID
   */
  async getUserOrganizationId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  }

  /**
   * Generate a unique slug from a title, appending a suffix on collision.
   */
  private async generateUniqueSlug(
    baseTitle: string,
    excludeId?: string,
    db: Prisma.TransactionClient = prisma
  ): Promise<string> {
    const baseSlug = baseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''); // trim leading/trailing dashes

    let slug = baseSlug;
    let counter = 0;

    for (;;) {
      const existing = await db.event.findUnique({
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
          `Allowed transitions from ${currentStatus}: ${
            allowedTransitions && allowedTransitions.size > 0
              ? Array.from(allowedTransitions).join(', ')
              : 'none (terminal state)'
          }`
      );
    }
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventInput, db: Prisma.TransactionClient = prisma): Promise<Event> {
    if (data.status && data.status !== 'DRAFT')
      throw ApiError.badRequest('New events must start as drafts');
    this.assertTimeZone(data.timezone);
    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Check if venue exists (only if provided)
    if (data.venueId) {
      const venue = await db.venue.findUnique({
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
    const slug = await this.generateUniqueSlug(data.title, undefined, db);

    // Create event
    return await db.event.create({
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
        images: data.imageUrl ? { main: data.imageUrl } : undefined,
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
  async setSalesPause(
    id: string,
    input: { paused: boolean; reason: string; requestId: string },
    actor: ActorScope
  ) {
    if (!['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(actor.role)) throw ApiError.forbidden();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw ApiError.notFound('Event not found');
      assertOrganizationAccess(actor, event.organizationId);
      if (event.deletedAt) throw ApiError.badRequest('Cannot control sales of a deleted event');
      const prior = await tx.eventSalesControl.findUnique({
        where: { eventId_requestId: { eventId: id, requestId: input.requestId } },
      });
      if (
        prior &&
        (prior.actorId !== actor.userId ||
          prior.reason !== input.reason ||
          prior.afterPaused !== input.paused)
      )
        throw ApiError.conflict('Request key was used with different input', {
          code: 'SALES_PAUSE_REQUEST_CONFLICT',
        });
      const evidence =
        prior ||
        (await tx.eventSalesControl.create({
          data: {
            eventId: id,
            organizationId: event.organizationId,
            actorId: actor.userId,
            requestId: input.requestId,
            reason: input.reason,
            beforePaused: event.salesPaused,
            afterPaused: input.paused,
          },
        }));
      if (!prior && event.salesPaused !== input.paused)
        await tx.event.update({ where: { id }, data: { salesPaused: input.paused } });
      return {
        eventId: id,
        salesPaused: evidence.afterPaused,
        changed: evidence.beforePaused !== evidence.afterPaused,
        requestId: evidence.requestId,
        auditId: evidence.id,
        replayed: !!prior,
      };
    });
  }

  async updateEvent(
    id: string,
    data: UpdateEventInput,
    db: Prisma.TransactionClient = prisma
  ): Promise<Event> {
    if (db === prisma) return prisma.$transaction((tx) => this.updateEvent(id, data, tx));
    await db.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
    // Check if event exists
    const existingEvent = await db.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      throw ApiError.notFound('Event not found');
    }

    if (existingEvent.deletedAt) throw ApiError.badRequest('Cannot edit a deleted event');
    if (data.status && data.status !== existingEvent.status)
      throw ApiError.badRequest('Use the dedicated event status action');
    this.assertTimeZone(data.timezone);
    // If updating venue, check if it exists
    if (data.venueId) {
      const venue = await db.venue.findUnique({
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
    const newStart = data.startDateTime
      ? new Date(data.startDateTime)
      : existingEvent.startDatetime;
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
        updateData.slug = await this.generateUniqueSlug(data.title, id, db);
      }
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.venueId) updateData.venueId = data.venueId;
    // Generic updates never write lifecycle or independent sales-control state.
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.category) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.timezone) updateData.timezone = data.timezone;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.imageUrl) updateData.images = { main: data.imageUrl };

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

    return await db.event.update({
      where: { id },
      data: updatePayload,
    });
  }

  /**
   * Delete event
   */
  async deleteEvent(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw ApiError.notFound('Event not found');
      if (await tx.ticket.count({ where: { eventId: id } })) {
        throw ApiError.badRequest(
          'Cannot delete event with existing tickets. Consider cancelling instead.'
        );
      }
      await tx.event.update({ where: { id }, data: { deletedAt: new Date(), status: 'DELETED' } });
    });
  }

  /** Restore as a draft under the same event lock used by checkout and configuration. */
  async restoreEvent(id: string): Promise<Event> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw ApiError.notFound('Event not found');
      if (!event.deletedAt) throw ApiError.badRequest('Event is not deleted');
      return tx.event.update({ where: { id }, data: { deletedAt: null, status: 'DRAFT' } });
    });
  }

  /**
   * List deleted events
   */
  async listDeletedEvents(
    organizationId: string,
    page = 1,
    limit = 20,
    search?: string
  ): Promise<PaginatedEvents> {
    // Cap limit to prevent unbounded queries
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const where: Prisma.EventWhereInput = {
      organizationId,
      deletedAt: { not: null },
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
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
    if (newStatus === EventStatus.DELETED)
      throw ApiError.badRequest('Use the dedicated delete action');
    if (newStatus === EventStatus.DRAFT)
      throw ApiError.badRequest('Use the dedicated restore action');

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw ApiError.notFound('Event not found');
      if (event.deletedAt) throw ApiError.badRequest('Cannot transition a deleted event');

      this.validateStatusTransition(event.status, newStatus);

      return await tx.event.update({
        where: { id },
        data: { status: newStatus },
      });
    });
  }

  /**
   * Publish event (change status from DRAFT to PUBLISHED)
   */
  async publishEvent(id: string, db: Prisma.TransactionClient = prisma): Promise<Event> {
    if (db === prisma) return prisma.$transaction((tx) => this.publishEvent(id, tx));
    await db.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
    const event = await db.event.findUnique({
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
      throw ApiError.badRequest(
        `Cannot publish event. Missing required fields: ${missingFields.join(', ')}`
      );
    }

    const activeTypes = await db.ticketType.count({
      where: {
        eventId: id,
        status: 'ACTIVE',
        quantityTotal: { gt: 0 },
        tierInventoryStatus: 'READY',
      },
    });
    if (!activeTypes)
      throw ApiError.badRequest('Cannot publish event without available ticket configuration');
    if (event.endDatetime! <= event.startDatetime! || event.startDatetime! <= new Date())
      throw ApiError.badRequest('Cannot publish an event with invalid or past dates');
    this.assertTimeZone(event.timezone || undefined);
    return await db.event.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
      },
    });
  }

  /**
   * Cancel event — also invalidates all tickets and handles orders
   */
  async cancelEvent(id: string): Promise<Event> {
    // Close sales first under the same event lock used by checkout and
    // admission. The resumable per-order pass takes no event-first order locks.
    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id } });
      if (!event) throw ApiError.notFound('Event not found');
      if (event.deletedAt) throw ApiError.badRequest('Cannot cancel a deleted event');
      if (event.status !== 'CANCELLED') this.validateStatusTransition(event.status, 'CANCELLED');
      return tx.event.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
    const orders = await prisma.order.findMany({
      where: { eventId: id, status: { in: ['PENDING', 'PAID'] } },
      select: { id: true },
    });
    for (const order of orders) {
      await prisma.$transaction(async (tx) => {
        await lockOrder(tx, order.id);
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        if (current.status === 'PAID')
          await tx.ticket.updateMany({
            where: { orderId: order.id, status: { in: ['VALID', 'TRANSFERRED'] } },
            data: { status: 'CANCELLED' },
          });
      });
      // Pending orders release their own holds exactly once. Paid tickets keep
      // SOLD accounting until an actual refund succeeds.
      const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      if (current.status === 'PENDING') await orderService.cancelOrder(order.id);
    }
    return cancelled;
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
   * Keep this uncached for V1 checkout: the payload contains ticket type IDs,
   * active tiers, and live availability that must not survive event resets or
   * ticket mutations.
   */
  async getPublicEventBySlug(slug: string) {
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
            _count: { select: { tiers: true } },
            tiers: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!event) return null;
    return {
      ...event,
      ticketTypes: event.ticketTypes.map(({ _count, ...ticketType }) => ({
        ...ticketType,
        // Expose schedule presence, never inactive tier rows or raw counts.
        hasConfiguredTiers: _count.tiers > 0,
      })),
    };
  }
}
export const eventService = new EventService();

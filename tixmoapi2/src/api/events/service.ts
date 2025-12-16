import { ApiError } from '@utils/ApiError';
import { PrismaClient, Event, Prisma, EventStatus } from '@prisma/client';

const prisma = new PrismaClient();

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

export class EventService {
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

    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: data.venueId },
    });

    if (!venue) {
      throw ApiError.notFound('Venue not found');
    }

    // Validate dates
    const startDate = new Date(data.startDateTime);
    const endDate = new Date(data.endDateTime);

    if (endDate <= startDate) {
      throw ApiError.badRequest('End date/time must be after start date/time');
    }

    // Generate slug from title
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Create event
    return await prisma.event.create({
      data: {
        name: data.title,
        slug: slug,
        description: data.description,
        organizationId: data.organizationId,
        venueId: data.venueId,
        startDatetime: startDate,
        endDatetime: endDate,
        timezone: data.timezone || venue.timezone,
        status: data.status || 'DRAFT',
        capacity: data.capacity || venue.capacity,
        category: data.category || 'General',
        tags: [],
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
    return await prisma.event.findUnique({
      where: { id },
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

    // Validate dates if both are provided
    if (data.startDateTime && data.endDateTime) {
      const startDate = new Date(data.startDateTime);
      const endDate = new Date(data.endDateTime);

      if (endDate <= startDate) {
        throw ApiError.badRequest('End date/time must be after start date/time');
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.title) {
      updateData.name = data.title;
      updateData.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
      updatedAt: new Date(),
    } as unknown as Prisma.EventUpdateInput;

    return await prisma.event.update({
      where: { id },
      data: updatePayload,
    });
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

    // Delete event
    await prisma.event.delete({
      where: { id },
    });
  }

  /**
   * List events with pagination and filters
   */
  async listEvents(params: ListEventsParams): Promise<PaginatedEvents> {
    const { page = 1, limit = 20, organizationId, venueId, status, search } = params;
    const skip = (page - 1) * limit;

    // Build where clause (use Prisma types)
    const where: Prisma.EventWhereInput = {};

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
        take: limit,
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
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
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

    if (event.status === 'PUBLISHED') {
      throw ApiError.badRequest('Event is already published');
    }

    if (event.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot publish a cancelled event');
    }

    return await prisma.event.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Cancel event
   */
  async cancelEvent(id: string): Promise<Event> {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    if (event.status === 'CANCELLED') {
      throw ApiError.badRequest('Event is already cancelled');
    }

    return await prisma.event.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });
  }
}

export const eventService = new EventService();

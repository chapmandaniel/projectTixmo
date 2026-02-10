import { Venue, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

import prisma from '../../config/prisma';

interface CreateVenueInput {
  name: string;
  organizationId: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  capacity: number;
  description?: string;
  timezone?: string;
  seatingChart?: Prisma.InputJsonValue | null;
}

interface UpdateVenueInput {
  name?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  capacity?: number;
  description?: string;
  timezone?: string;
  seatingChart?: Prisma.InputJsonValue | null;
}

interface ListVenuesParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  city?: string;
}

interface PaginatedVenues {
  venues: Venue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class VenueService {
  /**
   * Create a new venue
   */
  async createVenue(data: CreateVenueInput): Promise<Venue> {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw ApiError.notFound('Organization not found');
    }

    // Create venue
    const createPayload = {
      name: data.name,
      organizationId: data.organizationId,
      address: data.address,
      capacity: data.capacity,
      timezone: data.timezone || 'UTC',
      ...(data.seatingChart !== undefined
        ? { seatingChart: data.seatingChart as unknown as Prisma.InputJsonValue }
        : {}),
      ...(data.description !== undefined
        ? { metadata: { description: data.description } as unknown as Prisma.InputJsonValue }
        : {}),
    } as unknown as Prisma.VenueCreateInput;

    const venue = await prisma.venue.create({
      data: createPayload,
    });

    return venue;
  }

  /**
   * Get venue by ID
   */
  async getVenueById(id: string): Promise<Venue | null> {
    return await prisma.venue.findUnique({
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
        _count: {
          select: {
            events: true,
          },
        },
      },
    });
  }

  /**
   * Update venue
   */
  async updateVenue(id: string, data: UpdateVenueInput): Promise<Venue> {
    // Check if venue exists
    const existingVenue = await prisma.venue.findUnique({
      where: { id },
    });

    if (!existingVenue) {
      throw ApiError.notFound('Venue not found');
    }

    // Build update payload explicitly to satisfy Prisma JSON typings
    const updatePayload = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.description !== undefined
        ? { metadata: { description: data.description } as unknown as Prisma.InputJsonValue }
        : {}),
      ...(data.seatingChart !== undefined
        ? { seatingChart: data.seatingChart as unknown as Prisma.InputJsonValue }
        : {}),
      updatedAt: new Date(),
    } as unknown as Prisma.VenueUpdateInput;

    return await prisma.venue.update({
      where: { id },
      data: updatePayload,
    });
  }

  /**
   * Delete venue
   */
  async deleteVenue(id: string): Promise<void> {
    // Check if venue exists
    const existingVenue = await prisma.venue.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    if (!existingVenue) {
      throw ApiError.notFound('Venue not found');
    }

    // Check if venue has any events
    if (existingVenue._count.events > 0) {
      throw ApiError.badRequest('Cannot delete venue with existing events');
    }

    // Delete venue
    await prisma.venue.delete({
      where: { id },
    });
  }

  /**
   * List venues with pagination and filters
   */
  async listVenues(params: ListVenuesParams): Promise<PaginatedVenues> {
    const { page = 1, limit = 20, organizationId, city } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: import('@prisma/client').Prisma.VenueWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (city) {
      // Prisma JSON path filtering differs by version; use a safe unknown cast to avoid type errors while keeping the filter intent
      (where as unknown as Record<string, unknown>).address = {
        path: ['city'],
        equals: city,
      } as unknown;
    }

    const [venues, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
      }),
      prisma.venue.count({ where }),
    ]);

    return {
      venues,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const venueService = new VenueService();

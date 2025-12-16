import {
  PrismaClient,
  Organization,
  OrganizationType,
  OrganizationStatus,
  Prisma,
} from '@prisma/client';
import { ApiError } from '@utils/ApiError';

const prisma = new PrismaClient();

interface CreateOrganizationInput {
  name: string;
  slug: string;
  type: OrganizationType;
}

interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  status?: OrganizationStatus;
  stripeAccountId?: string;
}

interface ListOrganizationsParams {
  page?: number;
  limit?: number;
  type?: OrganizationType;
  status?: OrganizationStatus;
}

interface PaginatedOrganizations {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class OrganizationService {
  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationInput): Promise<Organization> {
    // Check if slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existingOrg) {
      throw ApiError.conflict('Organization with this slug already exists');
    }

    // Create organization
    return await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        status: 'PENDING',
      },
    });
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    return await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        _count: {
          select: {
            events: true,
            venues: true,
          },
        },
      },
    });
  }

  /**
   * Update organization
   */
  async updateOrganization(id: string, data: UpdateOrganizationInput): Promise<Organization> {
    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw ApiError.notFound('Organization not found');
    }

    // If updating slug, check if new slug is available
    if (data.slug && data.slug !== existingOrg.slug) {
      const slugExists = await prisma.organization.findUnique({
        where: { slug: data.slug },
      });

      if (slugExists) {
        throw ApiError.conflict('Organization with this slug already exists');
      }
    }

    // Update organization
    return await prisma.organization.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete organization
   */
  async deleteOrganization(id: string): Promise<void> {
    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw ApiError.notFound('Organization not found');
    }

    // Check if organization has any events or venues
    const orgWithCounts = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            events: true,
            venues: true,
          },
        },
      },
    });

    if (orgWithCounts && (orgWithCounts._count.events > 0 || orgWithCounts._count.venues > 0)) {
      throw ApiError.badRequest('Cannot delete organization with existing events or venues');
    }

    // Delete organization
    await prisma.organization.delete({
      where: { id },
    });
  }

  /**
   * List organizations with pagination and filters
   */
  async listOrganizations(params: ListOrganizationsParams): Promise<PaginatedOrganizations> {
    const { page = 1, limit = 20, type: orgType, status: orgStatus } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OrganizationWhereInput = {};
    if (orgType) {
      where.type = orgType;
    }
    if (orgStatus) {
      where.status = orgStatus;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              events: true,
              venues: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add member to organization
   */
  async addMember(orgId: string, userId: string): Promise<void> {
    // Check if organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Check if user is already a member
    if (user.organizationId === orgId) {
      throw ApiError.badRequest('User is already a member of this organization');
    }

    // Add user to organization
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: orgId,
      },
    });
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    // Check if organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }

    // Check if user exists and is a member
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.organizationId !== orgId) {
      throw ApiError.badRequest('User is not a member of this organization');
    }

    // Remove user from organization
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
    });
  }
}

export const organizationService = new OrganizationService();

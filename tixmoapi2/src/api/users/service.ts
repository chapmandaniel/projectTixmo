import { PrismaClient, User, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const prisma = new PrismaClient();

type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: 'ADMIN' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER';
}

interface PaginatedUsers {
  users: SafeUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<SafeUser | null> {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        organizationId: true,
        emailVerified: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: false,
        twoFactorSecret: false,
      },
    });
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, data: UpdateUserInput): Promise<SafeUser> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw ApiError.notFound('User not found');
    }

    // Update user
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        organizationId: true,
        emailVerified: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: false,
        twoFactorSecret: false,
      },
    });
  }

  /**
   * Soft delete user (anonymize email)
   */
  async deleteUser(id: string): Promise<void> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw ApiError.notFound('User not found');
    }

    // Soft delete by anonymizing email
    await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${id}@deleted.com`,
        firstName: 'Deleted',
        lastName: 'User',
        phone: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(params: ListUsersParams): Promise<PaginatedUsers> {
    const { page = 1, limit = 20, role } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};
    if (role) {
      where.role = role;
    }

    // Exclude soft-deleted users (those with deleted_ email prefix)
    where.email = {
      not: {
        startsWith: 'deleted_',
      },
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          organizationId: true,
          emailVerified: true,
          twoFactorEnabled: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: false,
          twoFactorSecret: false,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const userService = new UserService();

import { User, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { config } from '../../config/environment';
import { transporter, emailFrom } from '../../config/email';
import { userInvitationEmail } from '../../utils/emailTemplates';

import prisma from '../../config/prisma';

type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';
  organizationId?: string;
  title?: string;
  permissions?: Record<string, boolean>;
  password?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: 'OWNER' | 'ADMIN' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';
  organizationId?: string;
}

// ... existing interfaces ...

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
   * Create a new user
   */
  async createUser(data: CreateUserInput): Promise<SafeUser> {
    const { email, password, ...rest } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password (or generate random if not provided)
    const passwordToHash = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(passwordToHash, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        ...rest,
        permissions: rest.permissions as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        title: true,
        permissions: true,
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

    // Send invitation email
    try {
      const loginUrl = `${config.clientUrl}/login`;
      const emailContent = userInvitationEmail({
        name: user.firstName,
        email: user.email,
        password: passwordToHash,
        loginUrl,
      });

      await transporter.sendMail({
        from: `"${emailFrom.name}" <${emailFrom.address}>`,
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      logger.info(`Invitation email sent to ${user.email}`);
    } catch (error) {
      logger.error(`Failed to send invitation email to ${user.email}: ${(error as Error).message}`);
      // meaningful error logging but don't fail the request
    }

    return user;
  }

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
        title: true,
        permissions: true,
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

  // ... existing methods ...


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
        title: true,
        permissions: true,
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
    const { page = 1, limit = 20, role, organizationId } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};
    if (role) {
      where.role = role;
    }

    if (organizationId) {
      where.organizationId = organizationId;
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
          title: true,
          permissions: true,
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

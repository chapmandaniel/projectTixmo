import { User, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { config } from '../../config/environment';
import { transporter, emailFrom } from '../../config/email';
import { userInvitationEmail } from '../../utils/emailTemplates';

import prisma from '../../config/prisma';
import { hasValidStaffScope } from '../../utils/accountSession';

type SafeUser = Omit<
  User,
  'passwordHash' | 'twoFactorSecret' | 'disabledAt' | 'sessionVersion' | 'isPlatformAdmin'
> & { invitationPending?: boolean; invitationDelivered?: boolean };

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';
  organizationId?: string;
  title?: string;
  permissions?: Record<string, boolean>;
  password?: string;
}

export interface CreateUserOptions {
  clientOrigin?: string;
  inviterId?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  title?: string | null;
  role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';
  organizationId?: string | null;
  permissions?: Record<string, boolean> | null;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';
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
  private buildLoginUrl(clientOrigin?: string): string {
    const baseUrl = clientOrigin || config.clientUrl;
    return new URL('/login', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserInput, options: CreateUserOptions = {}): Promise<SafeUser> {
    const { password, ...restWithEmail } = data;
    const email = data.email.trim().toLowerCase();
    const { email: _email, ...rest } = restWithEmail;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    if (rest.role === 'ADMIN' && !rest.organizationId) {
      throw ApiError.badRequest('Administrator accounts require a business membership');
    }
    // Hash password (or generate random if not provided)
    const invitationToken = !password ? crypto.randomBytes(32).toString('hex') : null;
    if (invitationToken && !options.inviterId) {
      throw ApiError.forbidden('An authorized inviter is required');
    }
    const passwordToHash = password || crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(passwordToHash, 10);

    // Create user
    const user = await prisma.$transaction(async (tx) => {
      if (invitationToken) {
        const issuer = await tx.user.findUnique({ where: { id: options.inviterId! } });
        this.assertInvitationAuthority(issuer, rest);
      }
      const created = await tx.user.create({
        data: {
          email: email.trim().toLowerCase(),
          passwordHash,
          disabledAt: invitationToken ? new Date() : null,
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
      if (invitationToken) {
        await tx.staffInvitation.create({
          data: {
            userId: created.id,
            issuerId: options.inviterId!,
            tokenHash: crypto.createHash('sha256').update(invitationToken).digest('hex'),
            sessionVersion: 0,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        });
      }
      return created;
    });

    const invitationDelivered = await this.sendInvitationEmail(
      user,
      invitationToken,
      options.clientOrigin
    );
    return { ...user, invitationPending: Boolean(invitationToken), invitationDelivered };
  }

  private async sendInvitationEmail(
    user: { email: string; firstName: string },
    invitationToken: string | null,
    clientOrigin?: string
  ): Promise<boolean> {
    try {
      const loginUrl = invitationToken
        ? new URL(`/invite#${invitationToken}`, clientOrigin || config.clientUrl).toString()
        : this.buildLoginUrl(clientOrigin);
      const emailContent = userInvitationEmail({
        name: user.firstName,
        email: user.email,
        // Passwords are never sent by email; passwordless invites expire after 48 hours.
        password: undefined,
        loginUrl,
      });

      await transporter.sendMail({
        from: `"${emailFrom.name}" <${emailFrom.address}>`,
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      return true;
    } catch (error) {
      logger.error('Failed to deliver staff invitation email');
      return false;
    }
  }

  async resendInvitation(id: string, options: CreateUserOptions) {
    const token = crypto.randomBytes(32).toString('hex');
    const target = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${options.inviterId!} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
      const [user, issuer] = await Promise.all([
        tx.user.findUnique({ where: { id } }),
        tx.user.findUnique({ where: { id: options.inviterId! } }),
      ]);
      if (!user) throw ApiError.notFound('User not found');
      this.assertInvitationAuthority(issuer, user);
      const pending = await tx.staffInvitation.findFirst({
        where: { userId: id, acceptedAt: null },
      });
      if (!user.disabledAt || /^deleted_.+@deleted\.com$/i.test(user.email) || !pending) {
        throw ApiError.badRequest('This account has no pending invitation');
      }
      const updated = await tx.user.update({
        where: { id },
        data: { sessionVersion: { increment: 1 } },
      });
      await tx.staffInvitation.updateMany({
        where: { userId: id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      await tx.staffInvitation.create({
        data: {
          userId: id,
          issuerId: options.inviterId!,
          tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          sessionVersion: updated.sessionVersion,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      return { email: user.email, firstName: user.firstName };
    });
    if (!(await this.sendInvitationEmail(target, token, options.clientOrigin))) {
      throw ApiError.internal(
        'Invitation email could not be sent. Please retry Resend invitation.'
      );
    }
    return { invitationPending: true, invitationDelivered: true };
  }

  private assertInvitationAuthority(
    issuer: User | null,
    target: { role: string; organizationId?: string | null }
  ) {
    const levels: Record<string, number> = {
      OWNER: 5,
      ADMIN: 4,
      MANAGER: 3,
      PROMOTER: 2,
      TEAM_MEMBER: 1,
      SCANNER: 1,
      CUSTOMER: 0,
    };
    if (
      !issuer ||
      issuer.disabledAt ||
      !hasValidStaffScope(issuer) ||
      /^deleted_.+@deleted\.com$/i.test(issuer.email) ||
      !['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(issuer.role) ||
      (issuer.role !== 'OWNER' && levels[target.role] >= levels[issuer.role]) ||
      (issuer.organizationId && target.organizationId !== issuer.organizationId) ||
      (!issuer.organizationId && ['MANAGER', 'PROMOTER'].includes(issuer.role))
    ) {
      throw ApiError.forbidden('Invitation is no longer authorized');
    }
  }

  async acceptInvitation(token: string, password: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.$transaction(async (tx) => {
      const invite = await tx.staffInvitation.findUnique({
        where: { tokenHash },
        include: { user: true, issuer: true },
      });
      if (
        !invite ||
        invite.acceptedAt ||
        invite.expiresAt <= new Date() ||
        invite.user.sessionVersion !== invite.sessionVersion ||
        !invite.user.disabledAt ||
        /^deleted_.+@deleted\.com$/i.test(invite.user.email)
      ) {
        throw ApiError.unauthorized('Invitation is invalid or expired');
      }
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${invite.issuerId} FOR UPDATE`;
      const issuer = await tx.user.findUnique({ where: { id: invite.issuerId } });
      this.assertInvitationAuthority(issuer, invite.user);
      // Claim and activate in the same transaction; racing or replayed links cannot both succeed.
      const claimed = await tx.staffInvitation.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw ApiError.unauthorized('Invitation is invalid or expired');
      const activated = await tx.user.updateMany({
        where: {
          id: invite.userId,
          sessionVersion: invite.sessionVersion,
          disabledAt: { not: null },
        },
        data: {
          passwordHash,
          disabledAt: null,
          emailVerified: true,
          sessionVersion: { increment: 1 },
        },
      });
      if (activated.count !== 1) throw ApiError.unauthorized('Invitation is invalid or expired');
      const user = await tx.user.findUniqueOrThrow({ where: { id: invite.userId } });
      const {
        passwordHash: _hash,
        twoFactorSecret: _secret,
        disabledAt: _disabled,
        isPlatformAdmin: _platform,
        ...safeUser
      } = user;
      return safeUser;
    });
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

    const authorityChanged =
      (data.role !== undefined && data.role !== existingUser.role) ||
      (data.organizationId !== undefined && data.organizationId !== existingUser.organizationId) ||
      data.permissions !== undefined;
    // Losing organization membership must never manufacture global staff authority.
    const role =
      data.organizationId === null && existingUser.organizationId
        ? ('CUSTOMER' as const)
        : data.role;

    // Update user
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(role ? { role } : {}),
        ...(authorityChanged ? { sessionVersion: { increment: 1 }, isPlatformAdmin: false } : {}),
        permissions: data.permissions as Prisma.InputJsonValue | undefined,
        ...(role === 'CUSTOMER' ? { organizationId: null, permissions: Prisma.JsonNull } : {}),
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
        title: null,
        role: 'CUSTOMER',
        isPlatformAdmin: false,
        organizationId: null,
        permissions: Prisma.JsonNull,
        disabledAt: new Date(),
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        sessionVersion: { increment: 1 },
        emailVerified: false,
        twoFactorEnabled: false,
        twoFactorSecret: null,
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
          invitationsReceived: { where: { acceptedAt: null }, take: 1, select: { id: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(({ invitationsReceived, ...user }) => ({
        ...user,
        invitationPending: invitationsReceived.length > 0,
      })),
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

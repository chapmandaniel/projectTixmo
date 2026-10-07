import prisma from '../../config/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateTokens } from '../../utils/jwt';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '@prisma/client';
import { notificationService } from '../../utils/notificationService';
import { logger } from '../../config/logger';
import {
  isDisabledAccount,
  hasValidStaffScope,
  resolveAccountSession,
} from '../../utils/accountSession';
import { getRedisClient } from '../../config/redis';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
}

interface LoginData {
  email: string;
  password: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const refreshRevokedBeforeKey = (userId: string) => `auth:refresh-revoked-before:${userId}`;

export class AuthService {
  async register(data: RegisterData) {
    const normalizedEmail = normalizeEmail(data.email);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);
    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: UserRole.CUSTOMER,
        organizationId: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        emailVerified: true,
        sessionVersion: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
      sessionVersion: user.sessionVersion,
    });

    // Send welcome email (async, don't wait)
    notificationService
      .sendWelcomeEmail({
        to: user.email,
        name: user.firstName,
      })
      .catch((error) => logger.error('Failed to send welcome email:', error));

    return {
      user,
      ...tokens,
    };
  }

  async login(data: LoginData) {
    const normalizedEmail = normalizeEmail(data.email);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || isDisabledAccount(user) || !hasValidStaffScope(user)) {
      // Dummy comparison to prevent timing attacks
      await comparePassword(
        data.password,
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      );
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
      sessionVersion: user.sessionVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
        sessionVersion: user.sessionVersion,
        lastLogin: new Date(),
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    // Import here to avoid circular dependency
    const { verifyRefreshToken } = await import('../../utils/jwt');

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    const revokedBefore = await this.getRefreshRevokedBefore(decoded.userId);
    if (revokedBefore && decoded.iat && decoded.iat < revokedBefore) {
      throw ApiError.unauthorized('Refresh token has been revoked');
    }

    const user = await resolveAccountSession(decoded);

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
      sessionVersion: user.sessionVersion,
    });

    return tokens;
  }

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  private async getRefreshRevokedBefore(userId: string): Promise<number | null> {
    try {
      const value = await getRedisClient().get(refreshRevokedBeforeKey(userId));
      return value ? Number(value) : null;
    } catch (error) {
      logger.error(`Failed to read refresh token revocation state: ${(error as Error).message}`);
      throw ApiError.internal('Unable to validate refresh token state');
    }
  }

  async acceptInvitation(token: string, password: string) {
    const { userService } = await import('../users/service');
    const user = await userService.acceptInvitation(token, password);
    return {
      user,
      ...generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        emailVerified: user.emailVerified,
        sessionVersion: user.sessionVersion,
      }),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();

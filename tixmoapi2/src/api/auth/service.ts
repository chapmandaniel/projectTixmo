import prisma from '../../config/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateTokens } from '../../utils/jwt';
import { ApiError } from '../../utils/ApiError';
import { OrganizationStatus, OrganizationType, UserRole } from '@prisma/client';
import { notificationService } from '../../utils/notificationService';
import { logger } from '../../config/logger';
import { resolveTenantOrganizationSeed } from './tenantOrganization';

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

interface RegisterContext {
  requestHost?: string | null;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const canonicalizeOrganizationKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export class AuthService {
  private async resolveTenantOrganization(context?: RegisterContext) {
    const seed = resolveTenantOrganizationSeed({
      requestHost: context?.requestHost,
      serviceDashUrl: process.env.RAILWAY_SERVICE_DASH_URL,
      projectName: process.env.RAILWAY_PROJECT_NAME,
    });

    if (!seed) {
      return null;
    }

    const existingOrganizations = await prisma.organization.findMany({
      where: {
        NOT: { slug: 'tixmo-hq' },
      },
      select: { id: true, name: true, slug: true },
    });

    const seedKey = canonicalizeOrganizationKey(seed.slug);
    const matchedOrganization = existingOrganizations.find((organization) => {
      const slugKey = canonicalizeOrganizationKey(organization.slug);
      const nameKey = canonicalizeOrganizationKey(organization.name);
      return slugKey === seedKey || nameKey === seedKey;
    });

    if (matchedOrganization) {
      const organizationId = matchedOrganization.id;
      const memberCount = await prisma.user.count({ where: { organizationId } });
      return { organizationId, memberCount };
    }

    let organizationSlug = seed.slug;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug: organizationSlug } })) {
      suffix += 1;
      organizationSlug = `${seed.slug}-${suffix}`;
    }

    const organization = await prisma.organization.create({
      data: {
        name: seed.name,
        slug: organizationSlug,
        type: OrganizationType.PROMOTER,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });

    return { organizationId: organization.id, memberCount: 0 };
  }

  async register(data: RegisterData, context?: RegisterContext) {
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
    const tenantOrganization = await this.resolveTenantOrganization(context);
    const role = tenantOrganization
      ? tenantOrganization.memberCount === 0
        ? UserRole.OWNER
        : UserRole.TEAM_MEMBER
      : UserRole.CUSTOMER;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role,
        organizationId: tenantOrganization?.organizationId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: null,
      emailVerified: user.emailVerified,
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

    if (!user) {
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

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      emailVerified: user.emailVerified,
    });

    return tokens;
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

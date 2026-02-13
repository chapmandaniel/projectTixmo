import { AuthService } from '../../src/api/auth/service';
import prisma from '../../src/config/prisma';
import { notificationService } from '../../src/utils/notificationService';
import { logger } from '../../src/config/logger';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendWelcomeEmail: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock password utils
jest.mock('../../src/utils/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

// Mock jwt utils
jest.mock('../../src/utils/jwt', () => ({
  generateTokens: jest.fn().mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' }),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // We can instantiate the class directly since we mocked its dependencies
    service = new AuthService();
  });

  it('should log error when sending welcome email fails', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.CUSTOMER,
      emailVerified: false,
      createdAt: new Date(),
    };

    // Setup mocks
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

    // Mock notificationService to return a rejected promise
    // Note: notificationService.sendWelcomeEmail normally returns Promise<boolean>,
    // but here we want to test the .catch() block attached to it in AuthService.register
    const error = new Error('Email failed');
    (notificationService.sendWelcomeEmail as jest.Mock).mockRejectedValue(error);

    // Execute
    await service.register({
      email: 'test@example.com',
      password: 'password',
      firstName: 'Test',
      lastName: 'User',
    });

    // Wait for async promise chain (the .catch block)
    await new Promise((resolve) => setImmediate(resolve));

    // Verify
    expect(logger.error).toHaveBeenCalledWith('Failed to send welcome email:', error);
  });
});

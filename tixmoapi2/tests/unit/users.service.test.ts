import { UserService } from '../../src/api/users/service';
import prisma from '../../src/config/prisma';
import { transporter } from '../../src/config/email';
import { userInvitationEmail } from '../../src/utils/emailTemplates';

// Mock Prisma
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock Email Transporter
jest.mock('../../src/config/email', () => ({
  transporter: {
    sendMail: jest.fn(),
  },
  emailFrom: {
    name: 'TixMo',
    address: 'noreply@tixmo.co',
  },
}));

// Mock Logger
jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

// Mock Config
jest.mock('../../src/config/environment', () => ({
  config: {
    clientUrl: 'http://localhost:3000',
  },
}));

// Mock Email Templates
jest.mock('../../src/utils/emailTemplates', () => ({
  userInvitationEmail: jest
    .fn()
    .mockReturnValue({ subject: 'Test Subject', html: 'Test HTML', text: 'Test Text' }),
}));

describe('UserService Security', () => {
  let userService: UserService;
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    randomSpy = jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  it('should use secure random generator for default password', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'CUSTOMER',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
    (transporter.sendMail as jest.Mock).mockResolvedValue({});

    await userService.createUser({
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'CUSTOMER',
    } as any);

    // Verify password was NOT generated using Math.random
    expect(randomSpy).not.toHaveBeenCalled();

    // Verify userInvitationEmail was called with a secure password
    expect(userInvitationEmail).toHaveBeenCalled();
    const callArgs = (userInvitationEmail as jest.Mock).mock.calls[0][0];
    const generatedPassword = callArgs.password;

    // We expect a secure hex string (16 chars for 8 bytes)
    // The previous implementation used Math.random().toString(36).slice(-8) -> length 8 alphanumeric
    // The current implementation (vulnerable) will fail this check because it uses Math.random
    expect(generatedPassword).toMatch(/^[0-9a-f]{16}$/);
  });
});

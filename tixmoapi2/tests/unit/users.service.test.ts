import { UserService } from '../../src/api/users/service';
import prisma from '../../src/config/prisma';
import { transporter } from '../../src/config/email';
import { userInvitationEmail } from '../../src/utils/emailTemplates';

// Mock Prisma
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    staffInvitation: { create: jest.fn() },
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  },
}));

// Mock Email Transporter
jest.mock('../../src/config/email', () => ({
  transporter: {
    sendMail: jest.fn(),
  },
  emailFrom: {
    name: 'Tixmo',
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
    (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
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

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null).mockResolvedValue({
      id: 'owner-1',
      role: 'OWNER',
      organizationId: null,
      email: 'owner@example.com',
      disabledAt: null,
    });
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
    (transporter.sendMail as jest.Mock).mockResolvedValue({});

    await userService.createUser(
      {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'CUSTOMER',
      } as any,
      { inviterId: 'owner-1' }
    );

    // Verify password was NOT generated using Math.random
    expect(randomSpy).not.toHaveBeenCalled();

    expect(userInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ password: undefined })
    );
    const callArgs = (userInvitationEmail as jest.Mock).mock.calls[0][0];
    expect(callArgs.loginUrl).toMatch(/\/invite#[a-f0-9]{64}$/);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ disabledAt: expect.any(Date) }),
      })
    );
    expect(prisma.staffInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issuerId: 'owner-1',
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
  });

  it('should build invitation login links from the trusted request origin when provided', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'TEAM_MEMBER',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null).mockResolvedValue({
      id: 'owner-1',
      role: 'OWNER',
      organizationId: null,
      email: 'owner@example.com',
      disabledAt: null,
    });
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
    (transporter.sendMail as jest.Mock).mockResolvedValue({});

    await userService.createUser(
      {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'TEAM_MEMBER',
      } as any,
      {
        clientOrigin: 'https://mightyquinton.tixmo.co',
        inviterId: 'owner-1',
      }
    );

    expect(userInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        loginUrl: expect.stringMatching(
          /^https:\/\/mightyquinton\.tixmo\.co\/invite#[a-f0-9]{64}$/
        ),
      })
    );
  });
});

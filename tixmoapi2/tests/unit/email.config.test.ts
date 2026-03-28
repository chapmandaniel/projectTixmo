describe('email transport configuration', () => {
  const createTransport = jest.fn();
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const loadEmailModule = (configOverrides: Record<string, unknown> = {}) => {
    jest.resetModules();
    createTransport.mockReset();
    logger.info.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();

    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: { createTransport },
      createTransport,
    }));

    jest.doMock('../../src/config/logger', () => ({ logger }));

    jest.doMock('../../src/config/environment', () => ({
      config: {
        nodeEnv: 'production',
        postmarkServerToken: '',
        postmarkMessageStream: '',
        fromEmail: 'info@tixmo.co',
        fromName: 'TixMo',
        emailHost: 'smtp.gmail.com',
        emailPort: 587,
        emailUser: '',
        emailPassword: '',
        emailFrom: 'info@tixmo.co',
        ...configOverrides,
      },
    }));

    return require('../../src/config/email');
  };

  afterEach(() => {
    jest.dontMock('nodemailer');
    jest.dontMock('../../src/config/logger');
    jest.dontMock('../../src/config/environment');
    jest.clearAllMocks();
  });

  it('selects the Postmark API transport when POSTMARK_SERVER_TOKEN is configured', () => {
    const emailModule = loadEmailModule({
      postmarkServerToken: 'pm-server-token',
      postmarkMessageStream: 'outbound',
    });

    expect(createTransport).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Email transport using Postmark API derived from POSTMARK_SERVER_TOKEN'
    );
    expect(emailModule.emailFrom).toEqual({
      name: 'TixMo',
      address: 'info@tixmo.co',
    });
    expect(typeof emailModule.transporter.sendMail).toBe('function');
    expect(typeof emailModule.transporter.verify).toBe('function');
  });

  it('uses explicit SMTP credentials when no Postmark token is configured', () => {
    const smtpVerify = jest.fn().mockResolvedValue(true);
    createTransport.mockReturnValue({ verify: smtpVerify });

    loadEmailModule({
      emailHost: 'smtp.example.com',
      emailPort: 2525,
      emailUser: 'smtp-user',
      emailPassword: 'smtp-pass',
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 2525,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
  });
});

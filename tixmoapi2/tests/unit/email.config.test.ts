describe('email transport configuration', () => {
  const createTransport = jest.fn();
  const verify = jest.fn();

  const loadEmailModule = (configOverrides: Record<string, unknown> = {}) => {
    jest.resetModules();
    createTransport.mockReset();
    verify.mockReset().mockResolvedValue(true);
    createTransport.mockReturnValue({ verify });

    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: { createTransport },
      createTransport,
    }));

    jest.doMock('../../src/config/logger', () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    }));

    jest.doMock('../../src/config/environment', () => ({
      config: {
        nodeEnv: 'production',
        postmarkServerToken: '',
        postmarkMessageStream: '',
        fromEmail: 'noreply@tixmo.com',
        fromName: 'TixMo',
        emailHost: 'smtp.gmail.com',
        emailPort: 587,
        emailUser: '',
        emailPassword: '',
        emailFrom: 'noreply@tixmo.com',
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

  it('uses Postmark SMTP when POSTMARK_SERVER_TOKEN is configured', async () => {
    const emailModule = loadEmailModule({
      postmarkServerToken: 'pm-server-token',
      postmarkMessageStream: 'outbound',
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    const [transport, defaults] = createTransport.mock.calls[0];
    expect(transport).toMatchObject({
      host: 'smtp.postmarkapp.com',
      port: 587,
      secure: false,
      auth: {
        user: 'pm-server-token',
        pass: 'pm-server-token',
      },
    });
    expect(defaults).toEqual({
      headers: {
        'X-PM-Message-Stream': 'outbound',
      },
    });
    expect(emailModule.emailFrom).toEqual({
      name: 'TixMo',
      address: 'noreply@tixmo.com',
    });

    await expect(emailModule.verifyEmailConnection()).resolves.toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('prefers explicit SMTP credentials over the Postmark token shortcut', () => {
    loadEmailModule({
      postmarkServerToken: 'pm-server-token',
      emailHost: 'smtp.example.com',
      emailPort: 2525,
      emailUser: 'smtp-user',
      emailPassword: 'smtp-pass',
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    const [transport, defaults] = createTransport.mock.calls[0];
    expect(transport).toMatchObject({
      host: 'smtp.example.com',
      port: 2525,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
    expect(defaults).toBeUndefined();
  });
});

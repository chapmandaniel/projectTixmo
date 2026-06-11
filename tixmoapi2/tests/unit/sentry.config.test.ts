describe('Sentry configuration', () => {
  const init = jest.fn();
  const setTags = jest.fn();
  const setContext = jest.fn();
  const requestHandler = jest.fn();
  const tracingHandler = jest.fn();
  const errorHandler = jest.fn();

  const loadSentryModule = (configOverrides: Record<string, unknown> = {}) => {
    jest.resetModules();
    init.mockReset();
    setTags.mockReset();
    setContext.mockReset();

    jest.doMock('@sentry/node', () => ({
      init,
      setTags,
      setContext,
      Integrations: {
        Http: jest.fn().mockImplementation((options) => ({ name: 'Http', options })),
      },
      Handlers: {
        requestHandler,
        tracingHandler,
        errorHandler,
      },
    }));

    jest.doMock('../../src/config/environment', () => ({
      config: {
        sentryDsn: 'https://public@example.com/1',
        nodeEnv: 'production',
        deploymentEnvironment: 'staging',
        sentryTracesSampleRate: 0.1,
        release: 'api@abc123',
        serviceName: 'tixmo-api',
        sentryAlertRoute: 'launch-on-call',
        ...configOverrides,
      },
    }));

    return require('../../src/config/sentry');
  };

  afterEach(() => {
    jest.dontMock('@sentry/node');
    jest.dontMock('../../src/config/environment');
    jest.clearAllMocks();
  });

  it('initializes Sentry with release tags and alert routing context', () => {
    const { initSentry } = loadSentryModule();

    initSentry();

    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://public@example.com/1',
      environment: 'staging',
      release: 'api@abc123',
      tracesSampleRate: 0.1,
    }));
    expect(setTags).toHaveBeenCalledWith({
      service: 'tixmo-api',
      deployment_environment: 'staging',
      alert_route: 'launch-on-call',
      release: 'api@abc123',
    });
    expect(setContext).toHaveBeenCalledWith('deployment', {
      service: 'tixmo-api',
      environment: 'staging',
      release: 'api@abc123',
      alertRoute: 'launch-on-call',
    });
  });

  it('adds routing tags in beforeSend while scrubbing passwords', () => {
    const { initSentry } = loadSentryModule();

    initSentry();

    const beforeSend = init.mock.calls[0][0].beforeSend as (event: Record<string, any>) => Record<string, any>;
    const event = beforeSend({
      tags: { existing: 'tag' },
      request: {
        data: {
          email: 'buyer@example.com',
          password: 'do-not-send',
        },
      },
    });

    expect(event.tags).toMatchObject({
      existing: 'tag',
      service: 'tixmo-api',
      deployment_environment: 'staging',
      alert_route: 'launch-on-call',
      release: 'api@abc123',
    });
    expect(event.release).toBe('api@abc123');
    expect(event.request.data).toEqual({ email: 'buyer@example.com' });
  });

  it('skips placeholder or malformed DSNs', () => {
    const { initSentry } = loadSentryModule({ sentryDsn: 'your_sentry_dsn' });

    initSentry();

    expect(init).not.toHaveBeenCalled();
    expect(setTags).not.toHaveBeenCalled();
  });
});

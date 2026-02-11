describe('Environment Security', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    consoleSpy.mockRestore();
  });

  it('should not log sensitive information on startup', () => {
    try {
      require('../../src/config/environment');
    } catch (e) {
      console.error(e);
    }

    const calls = consoleSpy.mock.calls.map((c) => c.join(' '));

    // Expect NO logs containing sensitive info
    expect(calls.some((c) => c.includes('DEBUG: REDIS_URL exists:'))).toBe(false);
    expect(calls.some((c) => c.includes('DEBUG: DATABASE_URL exists:'))).toBe(false);
    expect(calls.some((c) => c.includes('DEBUG: Loading Environment'))).toBe(false);
  });
});

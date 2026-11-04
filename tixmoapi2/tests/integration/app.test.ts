import request from 'supertest';
import app from '../../src/app';
import { config } from '../../src/config/environment';
import { formatHealthRelease } from '../../src/config/healthRelease';

const FULL_SHA = '0123456789abcdef0123456789abcdef01234567';

const withRelease = async (release: string, run: () => Promise<void>) => {
  const previous = config.release;
  (config as { release?: string }).release = release;
  try {
    await run();
  } finally {
    (config as { release?: string }).release = previous;
  }
};

describe('Health Check', () => {
  it('should return 200 OK for /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('release', formatHealthRelease(config.release));
    expect(Object.keys(response.body).sort()).toEqual([
      'environment',
      'release',
      'status',
      'timestamp',
      'uptime',
    ]);
  });

  it('should return the short release SHA from /health', async () => {
    await withRelease(FULL_SHA, async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.release).toBe('0123456');
      expect(JSON.stringify(response.body)).not.toContain(FULL_SHA);
    });
  });

  it('should return 200 OK for /api/v1/health', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('version', 'v1');
    expect(response.body).toHaveProperty('release', formatHealthRelease(config.release));
    expect(Object.keys(response.body).sort()).toEqual([
      'message',
      'release',
      'success',
      'timestamp',
      'version',
    ]);
  });

  it('should return the same short release SHA from /api/v1/health', async () => {
    await withRelease(FULL_SHA, async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.release).toBe('0123456');
      expect(JSON.stringify(response.body)).not.toContain(FULL_SHA);
    });
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('not found');
  });
});

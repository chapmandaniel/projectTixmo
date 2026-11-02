import request from 'supertest';
import app from '../../src/app';

describe('Health Check', () => {
  it('should return 200 OK for /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('release');
  });

  it('returns RELEASE, then RAILWAY_GIT_COMMIT_SHA, from /health', async () => {
    const previousRelease = process.env.RELEASE;
    const previousRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.RELEASE = 'abc123fixture';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
    const preferred = await request(app).get('/health');
    expect(preferred.status).toBe(200);
    expect(preferred.body.release).toBe('abc123fixture');
    delete process.env.RELEASE;
    const railway = await request(app).get('/health');
    expect(railway.body.release).toBe('railway-sha');
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    const empty = await request(app).get('/health');
    expect(empty.body.release).toBeNull();
    if (previousRelease === undefined) delete process.env.RELEASE;
    else process.env.RELEASE = previousRelease;
    if (previousRailway === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previousRailway;
  });

  it('should return 200 OK for /api/v1/health', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('version', 'v1');
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

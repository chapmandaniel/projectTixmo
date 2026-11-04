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
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('railwayEnvironment');
    expect(response.body).toHaveProperty('branch');
    expect(Object.keys(response.body).sort()).toEqual([
      'branch',
      'environment',
      'railwayEnvironment',
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

  it('reports the Railway environment and branch beside release', async () => {
    const previousName = process.env.RAILWAY_ENVIRONMENT_NAME;
    const previousGit = process.env.RAILWAY_GIT_BRANCH;
    const previousLabs = process.env.APP_LABS_BRANCH;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_GIT_BRANCH;
    delete process.env.APP_LABS_BRANCH;
    const empty = await request(app).get('/health');
    expect(empty.body.environment).toBeTruthy();
    expect(empty.body.railwayEnvironment).toBeNull();
    expect(empty.body.branch).toBeNull();
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    process.env.APP_LABS_BRANCH = 'labs-manual';
    const labs = await request(app).get('/health');
    expect(labs.body.railwayEnvironment).toBe('labs');
    expect(labs.body.branch).toBe('labs-manual');
    expect(labs.body).toHaveProperty('release');
    process.env.RAILWAY_GIT_BRANCH = 'main';
    const pinned = await request(app).get('/health');
    expect(pinned.body.branch).toBe('labs-manual');
    delete process.env.APP_LABS_BRANCH;
    const git = await request(app).get('/health');
    expect(git.body.branch).toBe('main');
    if (previousName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = previousName;
    if (previousGit === undefined) delete process.env.RAILWAY_GIT_BRANCH;
    else process.env.RAILWAY_GIT_BRANCH = previousGit;
    if (previousLabs === undefined) delete process.env.APP_LABS_BRANCH;
    else process.env.APP_LABS_BRANCH = previousLabs;
  });

  it('serves a blocking robots file outside production and leaves production unchanged', async () => {
    const previousNode = process.env.NODE_ENV;
    const previousName = process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    process.env.NODE_ENV = 'production';
    const production = await request(app).get('/robots.txt');
    expect(production.status).toBe(404);
    expect(production.headers['x-robots-tag']).toBeUndefined();
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'labs';
    const labs = await request(app).get('/health');
    expect(labs.headers['x-robots-tag']).toBe('noindex, nofollow');
    const robots = await request(app).get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.text).toBe('User-agent: *\nDisallow: /\n');
    expect(robots.headers['x-robots-tag']).toBe('noindex, nofollow');
    process.env.NODE_ENV = previousNode;
    if (previousName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = previousName;
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

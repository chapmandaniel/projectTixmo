import {
  blocksSearchIndexing,
  healthBranch,
  healthRailwayEnvironment,
  ROBOTS_TXT,
} from '../../src/services/search-indexing';
import { assertSandboxDatabaseHosts } from '../../src/services/sandbox-host-guard';

describe('search indexing', () => {
  it('blocks every non-production environment and leaves production indexable', () => {
    expect(blocksSearchIndexing({ NODE_ENV: 'production' })).toBe(false);
    expect(
      blocksSearchIndexing({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' })
    ).toBe(false);
    expect(blocksSearchIndexing({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'labs' })).toBe(
      true
    );
    expect(blocksSearchIndexing({ NODE_ENV: 'development' })).toBe(true);
    expect(blocksSearchIndexing({ NODE_ENV: 'test' })).toBe(true);
    expect(ROBOTS_TXT).toBe('User-agent: *\nDisallow: /\n');
  });

  it('reports the Railway environment and branch without dropping a missing value', () => {
    expect(healthRailwayEnvironment({})).toBeNull();
    expect(healthRailwayEnvironment({ RAILWAY_ENVIRONMENT_NAME: ' labs ' })).toBe('labs');
    expect(healthBranch({})).toBeNull();
    expect(healthBranch({ RAILWAY_GIT_BRANCH: 'cursor/vendor-import-showpass-5658' })).toBe(
      'cursor/vendor-import-showpass-5658'
    );
    expect(healthBranch({ APP_LABS_BRANCH: 'labs-manual' })).toBe('labs-manual');
    expect(
      healthBranch({
        RAILWAY_GIT_BRANCH: 'from-git',
        APP_LABS_BRANCH: 'from-app',
      })
    ).toBe('from-app');
  });
});

describe('sandbox database host guard', () => {
  const internal = {
    DATABASE_URL: 'postgresql://tixmo:secret@postgres.railway.internal:5432/tixmo',
    REDIS_URL: 'redis://default:secret@redis.railway.internal:6379',
  };
  const publicHosts = {
    DATABASE_URL: 'postgresql://tixmo:secret@db.example.com:5432/tixmo',
    REDIS_URL: 'redis://default:secret@redis.example.com:6379',
  };

  it('requires private hosts only for labs, vendor-sandbox, and sandbox', () => {
    expect(() =>
      assertSandboxDatabaseHosts({ ...internal, RAILWAY_ENVIRONMENT_NAME: 'labs' })
    ).not.toThrow();
    expect(() =>
      assertSandboxDatabaseHosts({ ...publicHosts, RAILWAY_ENVIRONMENT_NAME: 'vendor-sandbox' })
    ).toThrow(/\.railway\.internal/);
    expect(() =>
      assertSandboxDatabaseHosts({ ...publicHosts, RAILWAY_ENVIRONMENT_NAME: 'sandbox' })
    ).toThrow(/\.railway\.internal/);
    expect(() =>
      assertSandboxDatabaseHosts({ ...publicHosts, RAILWAY_ENVIRONMENT_NAME: 'production' })
    ).not.toThrow();
    expect(() => assertSandboxDatabaseHosts({ ...publicHosts })).not.toThrow();
    expect(() =>
      assertSandboxDatabaseHosts({
        ...publicHosts,
        RAILWAY_ENVIRONMENT_NAME: 'labs',
        NODE_ENV: 'test',
      })
    ).not.toThrow();
    expect(() =>
      assertSandboxDatabaseHosts({
        ...publicHosts,
        RAILWAY_ENVIRONMENT_NAME: 'labs',
        GITHUB_ACTIONS: 'true',
      })
    ).not.toThrow();
  });

  it('does not include connection strings in the refusal', () => {
    expect(() =>
      assertSandboxDatabaseHosts({ ...publicHosts, RAILWAY_ENVIRONMENT_NAME: 'labs' })
    ).toThrow(/^(?!.*example\.com).*\.railway\.internal/);
  });
});

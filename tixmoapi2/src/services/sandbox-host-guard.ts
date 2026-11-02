const SANDBOX_RAILWAY_NAMES = new Set(['labs', 'vendor-sandbox', 'sandbox']);

const hostname = (raw: string | undefined): string => {
  const value = raw?.trim() || '';
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

const usesRailwayInternal = (raw: string | undefined): boolean =>
  hostname(raw).endsWith('.railway.internal');

/**
 * Labs and sandbox Railway processes must talk to the private network.
 * Production, local runs with no Railway name, tests, and GitHub Actions are unchanged.
 * The image sets CI=true for install scripts; that flag does not skip this check.
 */
export const assertSandboxDatabaseHosts = (env: NodeJS.ProcessEnv = process.env): void => {
  if (env.NODE_ENV === 'test' || env.GITHUB_ACTIONS === 'true') return;
  const name = env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase() || '';
  if (!SANDBOX_RAILWAY_NAMES.has(name)) return;
  if (usesRailwayInternal(env.DATABASE_URL) && usesRailwayInternal(env.REDIS_URL)) return;
  throw new Error(
    'Refusing to start: this Railway environment requires DATABASE_URL and REDIS_URL hosts ending in .railway.internal'
  );
};

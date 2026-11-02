import { config } from '../config/environment';

// Dev servers only. These are not added when NODE_ENV is production, even if
// CORS_ORIGIN or CLIENT_URL names them. The scanner harness proves this module
// snapshots config at load and may import only the environment module.
const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }

    return url.origin;
  } catch (_error) {
    return undefined;
  }
};

const configuredOrigins = (() => {
  const origins = new Set<string>();

  for (const candidate of config.corsOrigin) {
    const origin = normalizeOrigin(candidate.trim());
    if (origin) {
      origins.add(origin);
    }
  }

  const clientOrigin = normalizeOrigin(config.clientUrl.trim());
  if (clientOrigin) {
    origins.add(clientOrigin);
  }

  return origins;
})();

const isLocalDevOrigin = (origin: string) => LOCAL_DEV_ORIGINS.has(origin);

const productionDeploy = () =>
  config.nodeEnv === 'production' || config.corsProductionDeploy === true;

export const isTrustedClientOrigin = (value: string) => {
  const origin = normalizeOrigin(value);
  if (!origin) {
    return false;
  }

  if (productionDeploy() && isLocalDevOrigin(origin)) {
    return false;
  }

  if (configuredOrigins.has(origin)) {
    return true;
  }

  return !productionDeploy() && isLocalDevOrigin(origin);
};

export const resolveTrustedClientOrigin = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const origin = normalizeOrigin(candidate.trim());
    if (origin && isTrustedClientOrigin(origin)) {
      return origin;
    }
  }

  return undefined;
};

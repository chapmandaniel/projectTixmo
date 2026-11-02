import { config } from '../config/environment';

// Dev servers only. Railway deploys and NODE_ENV=production do not receive
// these. The scanner harness proves this module snapshots config at load and
// may import only the environment module.
const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const isLoopbackHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) return false;
  return octets[0] === 127;
};

// Request and Referer values. A path is stripped so a referer can still name
// its origin. Configured entries are rejected at startup when they have a path.
const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    if (url.username || url.password) return undefined;
    return url.origin;
  } catch (_error) {
    return undefined;
  }
};

const insecureBrowserOriginsBlocked = () =>
  config.nodeEnv === 'production' || config.corsRailwayProduction === true;

const configuredOrigins = (() => {
  const origins = new Set<string>();

  for (const candidate of config.corsOrigin) {
    const origin = normalizeOrigin(candidate.trim());
    if (origin) origins.add(origin);
  }

  // Local scanner and dev servers snapshot CLIENT_URL. Deployed environments
  // trust only CORS_ORIGIN, so CLIENT_URL cannot widen that list.
  const includeClientUrl =
    config.trustClientUrlForCors !== false && config.nodeEnv !== 'production';
  if (includeClientUrl) {
    const clientOrigin = normalizeOrigin(config.clientUrl.trim());
    if (clientOrigin) origins.add(clientOrigin);
  }

  return origins;
})();

export const isTrustedClientOrigin = (value: string) => {
  const origin = normalizeOrigin(value);
  if (!origin) return false;

  if (insecureBrowserOriginsBlocked()) {
    let hostname = '';
    try {
      hostname = new URL(origin).hostname;
    } catch (_error) {
      return false;
    }
    if (origin.startsWith('http:') || isLoopbackHostname(hostname)) return false;
  }

  if (configuredOrigins.has(origin)) return true;

  return (
    !insecureBrowserOriginsBlocked() &&
    config.allowLocalDevOrigins !== false &&
    LOCAL_DEV_ORIGINS.has(origin)
  );
};

export const resolveTrustedClientOrigin = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const origin = normalizeOrigin(candidate.trim());
    if (origin && isTrustedClientOrigin(origin)) return origin;
  }
  return undefined;
};

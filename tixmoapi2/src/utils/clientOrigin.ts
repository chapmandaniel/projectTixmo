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

const parseHttpUrl = (value: string): URL | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    return url;
  } catch (_error) {
    return undefined;
  }
};

// Origin header. Scheme, host, and a non-default port only. Case and the
// default :80/:443 are canonicalized by URL. A path, query, fragment,
// userinfo, wildcard, or the literal "null" is not an origin.
const strictRequestOrigin = (value: string): string | undefined => {
  const url = parseHttpUrl(value);
  if (!url) return undefined;
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return undefined;
  return url.origin;
};

// Referer and other page URLs. The path is removed, then the origin is checked.
const originOfUrl = (value: string): string | undefined => {
  const url = parseHttpUrl(value);
  if (!url) return undefined;
  return url.origin;
};

const insecureBrowserOriginsBlocked = () =>
  config.nodeEnv === 'production' || config.corsRailwayProduction === true;

const configuredOrigins = (() => {
  const origins = new Set<string>();

  for (const candidate of config.corsOrigin) {
    const origin = strictRequestOrigin(candidate.trim());
    if (origin) origins.add(origin);
  }

  // Local scanner and dev servers snapshot CLIENT_URL. Deployed environments
  // trust only CORS_ORIGIN, so CLIENT_URL cannot widen that list.
  const includeClientUrl =
    config.trustClientUrlForCors !== false && config.nodeEnv !== 'production';
  if (includeClientUrl) {
    const clientOrigin = strictRequestOrigin(config.clientUrl.trim());
    if (clientOrigin) origins.add(clientOrigin);
  }

  return origins;
})();

export const isTrustedClientOrigin = (value: string) => {
  const origin = strictRequestOrigin(value);
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
    const origin = originOfUrl(candidate.trim());
    if (origin && isTrustedClientOrigin(origin)) return origin;
  }
  return undefined;
};

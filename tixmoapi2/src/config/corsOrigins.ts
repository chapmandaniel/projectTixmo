// Exact browser origins. Entries are canonicalized (lowercase scheme and host,
// default :80/:443 removed, one trailing slash removed). A path, query,
// fragment, wildcard, or credential is one startup error and nothing else.

// Verified production dashboard origins. demo.tixmo.co is the custom domain.
// dash-production-7487 is the production dashboard service domain (target port 80).
// frontend-dash-production.up.railway.app is not included: the 2026-10-21
// snapshot had no target port and the 2026-10-04 probe was HTTP 502.
// api-production-fbaf.up.railway.app is the API, not a browser origin.
export const PRODUCTION_CORS_ORIGINS = [
  'https://dash-production-7487.up.railway.app',
  'https://demo.tixmo.co',
] as const;

// Invite and approval links use this only when Railway itself says production
// and CLIENT_URL is unset. No other environment may fall back to it.
export const PRODUCTION_LINK_ORIGIN = 'https://demo.tixmo.co';

// Railway environment name from the staging API /health railwayEnvironment
// field and docs/team/RAILWAY_PIPELINE_REVIEW_225.md. The only verified
// staging frontend origin is the dashboard service domain. Its customDomains
// list was empty. The staging API hostname is not a browser origin.
export const STAGING_AUDIT_ENVIRONMENT_NAME = 'staging-audit-20261005';
export const STAGING_CORS_ORIGINS = [
  'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app',
] as const;

// docs/labs.md. The API hosts labs-api.tixmo.co and labs-api-labs.up.railway.app
// are not browser origins.
export const LABS_ENVIRONMENT_NAME = 'labs';
export const LABS_CORS_ORIGINS = [
  'https://labs.tixmo.co',
  'https://labs-dash-labs.up.railway.app',
] as const;

export class OriginConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OriginConfigError';
    // Boot should print this sentence, not a stack trace.
    this.stack = message;
  }
}

export type CorsDeploymentMode =
  | { kind: 'local' }
  | { kind: 'railway-production' }
  | { kind: 'railway-other'; name: string }
  | { kind: 'production-without-railway' };

export const corsDeploymentMode = (
  nodeEnv: string,
  railwayEnvironmentName: string
): CorsDeploymentMode => {
  if (railwayEnvironmentName === 'production') return { kind: 'railway-production' };
  if (railwayEnvironmentName) return { kind: 'railway-other', name: railwayEnvironmentName };
  if (nodeEnv === 'production') return { kind: 'production-without-railway' };
  return { kind: 'local' };
};

export const productionCorsFallbackWarning = (): string =>
  `CORS_ORIGIN is unset. RAILWAY_ENVIRONMENT_NAME is production, so the hardcoded production allowlist is ${PRODUCTION_CORS_ORIGINS.join(', ')}. ` +
  'Set CORS_ORIGIN to that same comma-separated list. An explicit CORS_ORIGIN replaces this fallback.';

export const namedCorsFallbackWarning = (name: string, origins: readonly string[]): string =>
  `CORS_ORIGIN is unset. RAILWAY_ENVIRONMENT_NAME is ${name}, so the hardcoded allowlist is ${origins.join(', ')}. ` +
  'Set CORS_ORIGIN to that same comma-separated list. An explicit CORS_ORIGIN replaces this fallback.';

const fallbackFor = (
  mode: CorsDeploymentMode
): { origins: readonly string[]; warning: string } | undefined => {
  if (mode.kind === 'railway-production') {
    return {
      origins: PRODUCTION_CORS_ORIGINS,
      warning: productionCorsFallbackWarning(),
    };
  }
  if (mode.kind === 'railway-other' && mode.name === STAGING_AUDIT_ENVIRONMENT_NAME) {
    return {
      origins: STAGING_CORS_ORIGINS,
      warning: namedCorsFallbackWarning(mode.name, STAGING_CORS_ORIGINS),
    };
  }
  if (mode.kind === 'railway-other' && mode.name === LABS_ENVIRONMENT_NAME) {
    return {
      origins: LABS_CORS_ORIGINS,
      warning: namedCorsFallbackWarning(mode.name, LABS_CORS_ORIGINS),
    };
  }
  return undefined;
};

const fail = (message: string): never => {
  throw new OriginConfigError(message);
};

export const isLoopbackHostname = (hostname: string): boolean => {
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

export const canonicalizeConfiguredOrigin = (label: string, entry: string): string => {
  const trimmed = entry.trim();
  if (!trimmed) {
    fail(`${label} contains an empty entry. List full origins separated by commas.`);
  }
  if (trimmed.includes('*')) {
    fail(`${label} entry "${trimmed}" is invalid: wildcards are not allowed.`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return fail(
      `${label} entry "${trimmed}" is invalid: it is not a full origin. Use scheme, host, and optional port only.`
    );
  }

  if (url.username || url.password) {
    fail(`${label} entry "${trimmed}" is invalid: credentials are not allowed.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`${label} entry "${trimmed}" is invalid: only http and https origins are allowed.`);
  }
  // URL pathname is "/" for an origin and for one trailing slash. Anything else is a path.
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    fail(`${label} entry "${trimmed}" is invalid: paths, queries, and fragments are not allowed.`);
  }

  return url.origin;
};

export const assertDeployedBrowserOrigin = (label: string, origin: string): void => {
  const url = new URL(origin);
  if (url.protocol !== 'https:') {
    fail(`${label} entry "${origin}" is invalid: deployed environments only allow https origins.`);
  }
  if (isLoopbackHostname(url.hostname)) {
    fail(
      `${label} entry "${origin}" is invalid: loopback and localhost origins are not allowed on a deployed environment.`
    );
  }
};

const parseOriginList = (label: string, raw: string, deployed: boolean): string[] => {
  const origins: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    if (part.trim() === '') continue;
    const origin = canonicalizeConfiguredOrigin(label, part);
    if (deployed) assertDeployedBrowserOrigin(label, origin);
    if (seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }
  if (origins.length === 0) {
    fail(`${label} entry "${raw.trim()}" is invalid: it does not contain an origin.`);
  }
  return origins;
};

export const resolveConfiguredCorsOrigins = (mode: CorsDeploymentMode): readonly string[] => {
  const raw = process.env.CORS_ORIGIN;
  const unset = raw === undefined || raw.trim() === '';

  if (mode.kind === 'railway-other' && unset && !fallbackFor(mode)) {
    fail(
      `CORS_ORIGIN is unset. Set CORS_ORIGIN to the comma-separated https origins for Railway environment "${mode.name}" before starting.`
    );
  }

  if (mode.kind === 'production-without-railway') {
    console.error(
      'RAILWAY_ENVIRONMENT_NAME is unset while NODE_ENV is production. No browser origins are allowed. Set RAILWAY_ENVIRONMENT_NAME and CORS_ORIGIN for a deployed environment.'
    );
    if (!unset) parseOriginList('CORS_ORIGIN', raw, false);
    return [];
  }

  if (unset) {
    const fallback = fallbackFor(mode);
    if (fallback) {
      console.warn(fallback.warning);
      return [...fallback.origins];
    }
    return [];
  }

  return parseOriginList('CORS_ORIGIN', raw, mode.kind !== 'local');
};

const LOCAL_CLIENT_URL = 'http://localhost:3001';

export const resolveClientUrl = (mode: CorsDeploymentMode): string => {
  const raw = process.env.CLIENT_URL;
  const unset = raw === undefined || raw.trim() === '';
  if (unset) {
    if (mode.kind === 'railway-production') {
      console.warn(
        `CLIENT_URL is unset. Using ${PRODUCTION_LINK_ORIGIN} for invite and approval links because RAILWAY_ENVIRONMENT_NAME is production.`
      );
      return PRODUCTION_LINK_ORIGIN;
    }
    // Never substitute the production dashboard outside Railway production.
    // No warning here: the Showpass seed treats stderr that names a Railway
    // environment as a refusal. Unset CLIENT_URL stays the local link origin
    // and is not added to deployed CORS.
    return LOCAL_CLIENT_URL;
  }

  const origin = canonicalizeConfiguredOrigin('CLIENT_URL', raw);
  if (mode.kind === 'railway-production' || mode.kind === 'railway-other') {
    assertDeployedBrowserOrigin('CLIENT_URL', origin);
  }
  return origin;
};

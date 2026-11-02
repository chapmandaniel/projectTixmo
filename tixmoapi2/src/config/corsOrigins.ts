// Exact browser origins only. A path, query, hash, or wildcard is a startup error.

export const PRODUCTION_CORS_ORIGINS = ['https://demo.tixmo.co'] as const;

export const productionCorsFallbackWarning = (): string =>
  `CORS_ORIGIN is unset. Using the hardcoded production allowlist (${PRODUCTION_CORS_ORIGINS.join(', ')}). ` +
  'Set CORS_ORIGIN to the explicit comma-separated origins for this environment. ' +
  'The fallback keeps a production deploy that has not received the variable from refusing the current production dashboard. ' +
  'An explicit CORS_ORIGIN replaces this list entirely.';

const originError = (entry: string, reason: string): Error =>
  new Error(`CORS_ORIGIN entry "${entry}" is invalid: ${reason}`);

export const parseCorsOriginEntry = (entry: string): string => {
  const trimmed = entry.trim();
  if (!trimmed) {
    throw new Error(
      'CORS_ORIGIN contains an empty entry. List full origins separated by commas, or unset it.'
    );
  }
  if (trimmed.includes('*')) {
    throw originError(
      trimmed,
      'wildcards are not allowed. List each full origin (scheme, host, and optional port) exactly.'
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw originError(
      trimmed,
      'it is not a full origin. Use scheme, host, and optional port only, for example https://demo.tixmo.co.'
    );
  }

  if (url.username || url.password) {
    throw originError(trimmed, 'credentials are not allowed.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw originError(trimmed, 'only http and https origins are allowed.');
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw originError(
      trimmed,
      'paths are not allowed. List the origin only, for example https://demo.tixmo.co.'
    );
  }
  if (trimmed !== url.origin) {
    throw originError(trimmed, `it must exactly equal the origin ${url.origin}.`);
  }

  return url.origin;
};

// Blank segments from a trailing comma are ignored. A value that is only commas is empty.
export const parseCorsOriginList = (raw: string): string[] => {
  const origins: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(',')) {
    if (part.trim() === '') continue;
    const origin = parseCorsOriginEntry(part);
    if (seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }

  return origins;
};

export const resolveConfiguredCorsOrigins = (productionDeploy: boolean): readonly string[] => {
  const raw = process.env.CORS_ORIGIN;
  if (raw === undefined || raw.trim() === '') {
    if (productionDeploy) {
      console.warn(productionCorsFallbackWarning());
      return [...PRODUCTION_CORS_ORIGINS];
    }
    return [];
  }

  const origins = parseCorsOriginList(raw);
  if (origins.length === 0) {
    throw new Error(
      'CORS_ORIGIN is set but does not contain any origins. List full origins separated by commas, or unset it.'
    );
  }
  return origins;
};

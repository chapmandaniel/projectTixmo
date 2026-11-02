import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isLoopbackHost } from './text.js';
import type { Logger } from './types.js';

export type CheckerConfig = {
  apiUrl: string;
  checkerToken: string;
  watchlistPath: string;
  fixtures: boolean;
  xBearerToken?: string;
  redditClientId?: string;
  redditClientSecret?: string;
  redditContact?: string;
  contactUrl: string;
  publicPageIntervalMs: number;
  crtshCachePath: string;
  lookalikeSearchApiUrl?: string;
  lookalikeSearchApiKey?: string;
  reportPath: string;
};

const requireOrigin = (raw: string | undefined): string => {
  if (!raw?.trim()) throw new Error('TIXMO_API_URL is required');
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('TIXMO_API_URL is not a URL');
  }
  const loopback = isLoopbackHost(url.hostname);
  if (url.protocol === 'http:' && !loopback) {
    throw new Error('TIXMO_API_URL must use https except on localhost');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('TIXMO_API_URL must use http or https');
  }
  if (url.username || url.password) throw new Error('TIXMO_API_URL must not include credentials');
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('TIXMO_API_URL must be the API origin, without a path');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
};

const optionalHttps = (raw: string | undefined, name: string): string | undefined => {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  const loopback = isLoopbackHost(url.hostname);
  if (url.protocol === 'http:' && !loopback) throw new Error(`${name} must use https except on localhost`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`${name} must use http or https`);
  return url.toString();
};

export const loadConfig = (argv: string[], env: NodeJS.ProcessEnv): CheckerConfig => {
  const fixtures = argv.includes('--fixtures');
  const apiUrl = requireOrigin(env.TIXMO_API_URL);
  if (fixtures && !isLoopbackHost(new URL(apiUrl).hostname)) {
    throw new Error(
      '--fixtures refuses a TIXMO_API_URL that is not loopback (127.0.0.1, ::1, or localhost)'
    );
  }
  const token = env.TIXMO_CHECKER_TOKEN?.trim() ?? '';
  if (!/^gwc_[A-Za-z0-9_-]{16,}$/.test(token)) {
    throw new Error('TIXMO_CHECKER_TOKEN must be a gwc_ checker token');
  }
  const contactFallback = fixtures ? 'http://127.0.0.1:5173/brand-protection' : '';
  const contactUrl = optionalHttps(env.CHECKER_CONTACT_URL?.trim() || contactFallback, 'CHECKER_CONTACT_URL');
  if (!contactUrl) throw new Error('CHECKER_CONTACT_URL is required');
  const intervalRaw = env.PUBLIC_PAGE_INTERVAL_MS?.trim();
  let publicPageIntervalMs = fixtures ? 0 : 15_000;
  if (intervalRaw) {
    if (!/^\d+$/.test(intervalRaw)) throw new Error('PUBLIC_PAGE_INTERVAL_MS must be a non-negative integer');
    publicPageIntervalMs = Number(intervalRaw);
  }
  return {
    apiUrl,
    checkerToken: token,
    watchlistPath: env.TIXMO_WATCHLIST_PATH?.trim() || '.local/watchlist.json',
    fixtures,
    xBearerToken: env.X_BEARER_TOKEN?.trim() || undefined,
    redditClientId: env.REDDIT_CLIENT_ID?.trim() || undefined,
    redditClientSecret: env.REDDIT_CLIENT_SECRET?.trim() || undefined,
    redditContact: env.REDDIT_CONTACT?.trim() || undefined,
    contactUrl,
    publicPageIntervalMs,
    crtshCachePath: env.CRTSH_CACHE_PATH?.trim() || '.cache/crtsh.json',
    lookalikeSearchApiUrl: optionalHttps(env.LOOKALIKE_SEARCH_API_URL, 'LOOKALIKE_SEARCH_API_URL'),
    lookalikeSearchApiKey: env.LOOKALIKE_SEARCH_API_KEY?.trim() || undefined,
    reportPath: env.BRAND_CHECKER_REPORT?.trim() || '.local/last-run.json',
  };
};

export type RunReport = {
  ok: boolean;
  status?: number;
  matches?: number;
  verifications?: number;
  at: string;
};

export const writeReport = (path: string, report: RunReport, logger: Logger): void => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(report)}\n`, { mode: 0o600 });
  } catch (error) {
    const message = error instanceof Error ? error.name : 'Error';
    logger.info(`brand-checker: unable to write the run report (${message})`);
  }
};

export const readCacheFile = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

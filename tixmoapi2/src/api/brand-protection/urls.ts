import { ApiError } from '../../utils/ApiError';

export const assertNoControlChars = (value: string, field: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      throw ApiError.badRequest(`${field} contains unsupported control characters`);
    }
  }
};

const PLATFORM_HOSTS: Record<string, readonly string[]> = {
  X: ['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'],
  REDDIT: ['reddit.com', 'old.reddit.com', 'new.reddit.com'],
  FACEBOOK: ['facebook.com', 'fb.com', 'm.facebook.com', 'web.facebook.com'],
  INSTAGRAM: ['instagram.com'],
};

const TRACKING_PARAM =
  /^(?:utm_[a-z0-9_]+|fbclid|gclid|gclsrc|dclid|msclkid|twclid|igshid|igsh|mc_cid|mc_eid|ref_src|ref_url|si)$/i;

export const canonicalSocialHost = (hostname: string): string => {
  let host = hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.startsWith('m.')) host = host.slice(2);
  if (host === 'twitter.com' || host === 'mobile.twitter.com' || host === 'mobile.x.com') {
    return 'x.com';
  }
  if (host === 'old.reddit.com' || host === 'new.reddit.com') return 'reddit.com';
  if (host === 'web.facebook.com' || host === 'fb.com') return 'facebook.com';
  return host;
};

export const hostAllowedForPlatform = (platform: string, hostname: string): boolean => {
  const allowed = PLATFORM_HOSTS[platform];
  if (!allowed) return false;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const withoutWww = host.startsWith('www.') ? host.slice(4) : host;
  return allowed.includes(host) || allowed.includes(withoutWww);
};

const marketplaceHost = (url: URL): boolean => {
  const host = url.hostname.toLowerCase();
  if (host === 'kijiji.ca' || host.endsWith('.kijiji.ca')) return true;
  if (
    host === 'craigslist.org' ||
    host.endsWith('.craigslist.org') ||
    host.includes('craigslist.')
  ) {
    return true;
  }
  if (
    (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com') &&
    url.pathname.toLowerCase().includes('/marketplace')
  ) {
    return true;
  }
  return false;
};

/** https URL on that platform's allow-listed hosts. Credentials, fragments, and marketplace URLs are rejected. */
export const normalizeSocialUrl = (raw: string, field: string, platform: string): string => {
  assertNoControlChars(raw, field);
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw ApiError.badRequest(`${field} must be an https URL`);
  }
  if (url.protocol !== 'https:') throw ApiError.badRequest(`${field} must use https`);
  if (url.username || url.password)
    throw ApiError.badRequest(`${field} must not include credentials`);
  if (marketplaceHost(url)) {
    throw ApiError.badRequest('Marketplace listings are not a supported source');
  }
  if (!hostAllowedForPlatform(platform, url.hostname)) {
    throw ApiError.badRequest(`${field} is not on an allowed host for ${platform}`);
  }
  url.hash = '';
  url.hostname = canonicalSocialHost(url.hostname);
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  const normalized = url.toString().replace(/\/$/, '');
  if (normalized.length > 500) throw ApiError.badRequest(`${field} is too long`);
  return normalized;
};

/** Hostname only. Paths, queries, and page content are discarded. */
export const normalizeDomain = (raw: string): string => {
  assertNoControlChars(raw, 'sourceUrl');
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) throw ApiError.badRequest('sourceUrl must be a domain');
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw ApiError.badRequest('sourceUrl must be a domain');
  }
  if (url.username || url.password) {
    throw ApiError.badRequest('sourceUrl must not include credentials');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !host.includes('.') ||
    host.length > 253 ||
    !/^[a-z0-9.-]+$/.test(host) ||
    host.startsWith('.') ||
    host.endsWith('.') ||
    host.includes('..') ||
    host === 'localhost' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  ) {
    throw ApiError.badRequest('sourceUrl must be a domain');
  }
  return host;
};

export const displayHandle = (raw: string): string => {
  const handle = raw.trim().replace(/^@+/, '');
  assertNoControlChars(handle, 'handle');
  if (!handle || handle.length > 100) throw ApiError.badRequest('handle must be 1-100 characters');
  return handle;
};

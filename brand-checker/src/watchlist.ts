import { readFileSync } from 'node:fs';
import type { OrganizationTarget, SocialPlatform, Watchlist } from './types.js';

const PLATFORMS = new Set<SocialPlatform>(['X', 'REDDIT', 'FACEBOOK', 'INSTAGRAM']);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const asString = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};

const parseAccount = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const platform = asString(row.platform, 32);
  if (!PLATFORMS.has(platform as SocialPlatform)) return null;
  const platformAccountId = asString(row.platformAccountId, 200);
  const handle = asString(row.handle, 100).replace(/^@+/, '');
  if (!platformAccountId || !handle) return null;
  const profileUrl = asString(row.profileUrl, 500);
  const displayName = asString(row.displayName, 200);
  return {
    platform: platform as SocialPlatform,
    platformAccountId,
    handle,
    ...(profileUrl ? { profileUrl } : {}),
    ...(displayName ? { displayName } : {}),
  };
};

const parseOrg = (value: unknown): OrganizationTarget | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const organizationId = asString(row.organizationId, 36);
  if (!GUID.test(organizationId)) return null;
  const names = Array.isArray(row.names)
    ? row.names.map((item) => asString(item, 200)).filter((item) => item.length >= 4)
    : [];
  const domains = Array.isArray(row.domains)
    ? row.domains.map((item) => asString(item, 253).toLowerCase()).filter((item) => item.includes('.'))
    : [];
  const accounts = Array.isArray(row.accounts)
    ? row.accounts.map(parseAccount).filter((item): item is NonNullable<typeof item> => item !== null)
    : [];
  if (!names.length && !accounts.length) return null;
  const eventId = asString(row.eventId, 36);
  return {
    organizationId,
    ...(eventId && GUID.test(eventId) ? { eventId } : {}),
    names,
    domains,
    accounts,
  };
};

export const parseWatchlist = (raw: unknown): Watchlist => {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { organizations?: unknown }).organizations)) {
    throw new Error('Watchlist must be an object with an organizations array');
  }
  const organizations = (raw as { organizations: unknown[] }).organizations
    .map(parseOrg)
    .filter((item): item is OrganizationTarget => item !== null);
  if (!organizations.length) throw new Error('Watchlist has no organizations');
  return { organizations: organizations.slice(0, 25) };
};

export const loadWatchlist = (path: string): Watchlist => {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseWatchlist(parsed);
};

export const brandSlugs = (org: OrganizationTarget): string[] => {
  const slugs = new Set<string>();
  for (const name of org.names) {
    const value = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (value.length >= 5) slugs.add(value);
  }
  for (const account of org.accounts) {
    const handle = account.handle.toLowerCase().replace(/[^a-z0-9_]+/g, '');
    if (handle.length >= 3) slugs.add(handle);
  }
  for (const domain of org.domains) {
    const label = domain.split('.')[0]?.replace(/[^a-z0-9]+/g, '') ?? '';
    if (label.length >= 5) slugs.add(label);
  }
  return [...slugs];
};

import { fetchWithBackoff, type CrtshCache, FRESH_MS } from '../net.js';
import { readJson } from '../http.js';
import { isRejectedSource, safeDetectedAt } from '../text.js';
import type { Finding, HttpClient, OrganizationTarget, SourceResult } from '../types.js';

const SEARCH_ENGINES = new Set([
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
  'search.yahoo.com',
  'search.brave.com',
]);

export const assertOfficialSearchApi = (raw: string): URL => {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (SEARCH_ENGINES.has(host) || host.endsWith('.google.com') || host.endsWith('.bing.com')) {
    throw new Error('LOOKALIKE_SEARCH_API_URL must be an official API, not a search engine');
  }
  return url;
};

const brandTokens = (org: OrganizationTarget): string[] => {
  const tokens = new Set<string>();
  for (const name of org.names) {
    const token = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (token.length >= 5) tokens.add(token);
  }
  for (const domain of org.domains) {
    const label = domain.split('.')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';
    if (label.length >= 5) tokens.add(label);
  }
  return [...tokens];
};

const officialHost = (host: string, domains: string[]): boolean =>
  domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

export const hostnamesFromCertificate = (nameValue: string): string[] =>
  nameValue
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase().replace(/\.$/, ''))
    .filter((item) => item && !item.includes('*') && item.includes('.'));

const consider = (
  org: OrganizationTarget,
  host: string,
  matchedRule: string,
  now: Date
): Finding | null => {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(normalized) || normalized.includes('..')) return null;
  if (officialHost(normalized, org.domains.map((domain) => domain.toLowerCase()))) return null;
  if (isRejectedSource(normalized)) return null;
  const tokens = brandTokens(org);
  const labels = normalized.split('.');
  if (!tokens.some((token) => labels.some((label) => label.includes(token)))) return null;
  return {
    organizationId: org.organizationId,
    ...(org.eventId ? { eventId: org.eventId } : {}),
    platform: 'LOOKALIKE_DOMAIN',
    category: 'LOOKALIKE_DOMAIN',
    sourceUrl: normalized,
    matchedRule,
    detectedAt: safeDetectedAt(undefined, now),
  };
};

const domainsFromSearch = (body: string): string[] => {
  const parsed = readJson(body);
  if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
  if (!parsed || typeof parsed !== 'object') return [];
  const record = parsed as { domains?: unknown; results?: unknown };
  if (Array.isArray(record.domains)) return record.domains.filter((item): item is string => typeof item === 'string');
  if (Array.isArray(record.results)) {
    return record.results
      .map((item) => (item && typeof item === 'object' ? (item as { domain?: unknown }).domain : ''))
      .filter((item): item is string => typeof item === 'string');
  }
  return [];
};

export const collectLookalikes = async (
  orgs: OrganizationTarget[],
  http: HttpClient,
  cache: CrtshCache,
  userAgent: string,
  sleep: (ms: number) => Promise<void>,
  searchApiUrl?: string,
  searchApiKey?: string,
  now = new Date()
): Promise<SourceResult> => {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  let crtFailed = false;
  const push = (finding: Finding | null) => {
    if (!finding) return;
    const key = `${finding.organizationId}:${finding.sourceUrl}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
  };
  for (const org of orgs) {
    for (const token of brandTokens(org)) {
      const cacheKey = token;
      const cached = cache.get(cacheKey);
      let body = cached && now.getTime() - cached.storedAt < FRESH_MS ? cached.body : '';
      if (!body) {
        const url = `https://crt.sh/?q=${encodeURIComponent(`%${token}%`)}&output=json`;
        const response = await fetchWithBackoff(http, url, { Accept: 'application/json', 'User-Agent': userAgent }, sleep);
        if (response.status === 429 || response.status === 403) {
          return {
            findings,
            verifications: [],
            stop: { state: 'BLOCKED', detail: `crt.sh http ${response.status}` },
          };
        }
        if (response.status !== 200) {
          crtFailed = true;
          body = cached?.body ?? '';
        } else {
          body = response.body;
          cache.set(cacheKey, body);
        }
      }
      const rows = readJson(body);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const nameValue =
            row && typeof row === 'object' && typeof (row as { name_value?: unknown }).name_value === 'string'
              ? (row as { name_value: string }).name_value
              : '';
          for (const host of hostnamesFromCertificate(nameValue)) push(consider(org, host, 'lookalike-certificate', now));
        }
      }
    }
  }
  if (searchApiUrl) {
    const endpoint = assertOfficialSearchApi(searchApiUrl);
    for (const org of orgs) {
      for (const token of brandTokens(org)) {
        const url = new URL(endpoint.toString());
        url.searchParams.set('q', token);
        const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': userAgent };
        if (searchApiKey) headers.Authorization = `Bearer ${searchApiKey}`;
        const response = await http.request(url.toString(), { headers });
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          return {
            findings,
            verifications: [],
            stop: { state: 'BLOCKED', detail: `search api http ${response.status}` },
          };
        }
        if (response.status >= 400) continue;
        for (const domain of domainsFromSearch(response.body)) {
          let host = domain.split('/')[0] ?? '';
          if (domain.includes('://')) {
            try {
              host = new URL(domain).hostname;
            } catch {
              continue;
            }
          }
          if (!host) continue;
          push(consider(org, host, 'lookalike-search-api', now));
        }
      }
    }
  }
  if (crtFailed && findings.length === 0) {
    return { findings, verifications: [], stop: { state: 'BLOCKED', detail: 'crt.sh unavailable' } };
  }
  return { findings: findings.slice(0, 20), verifications: [] };
};

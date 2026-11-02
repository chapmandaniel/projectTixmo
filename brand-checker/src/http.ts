import { lookup as defaultLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { HttpClient, HttpRequest, HttpResponse } from './types.js';

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

type ResolvedAddress = { address: string; family: number };

type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<ResolvedAddress[]>;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const ipv4Value = (address: string): number | null => {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
};

const ipv4InCidr = (address: string, base: string, bits: number): boolean => {
  const ip = ipv4Value(address);
  const network = ipv4Value(base);
  if (ip === null || network === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (network & mask);
};

const ipv4Mapped = (address: string): string | null => {
  const normalized = address.toLowerCase();
  const prefix = '::ffff:';
  if (!normalized.startsWith(prefix)) return null;
  const rest = normalized.slice(prefix.length);
  return ipv4Value(rest) === null ? null : rest;
};

/** Private, loopback, and link-local addresses, including IPv4-mapped IPv6. */
export const isBlockedAddress = (address: string): boolean => {
  const trimmed = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = ipv4Mapped(trimmed);
  const v4 = mapped ?? trimmed;
  if (ipv4Value(v4) !== null) {
    return (
      ipv4InCidr(v4, '0.0.0.0', 8) ||
      ipv4InCidr(v4, '10.0.0.0', 8) ||
      ipv4InCidr(v4, '127.0.0.0', 8) ||
      ipv4InCidr(v4, '169.254.0.0', 16) ||
      ipv4InCidr(v4, '172.16.0.0', 12) ||
      ipv4InCidr(v4, '192.168.0.0', 16)
    );
  }
  if (trimmed === '::1' || trimmed === '::') return true;
  if (trimmed.startsWith('fe8') || trimmed.startsWith('fe9') || trimmed.startsWith('fea') || trimmed.startsWith('feb')) {
    return true;
  }
  return trimmed.startsWith('fc') || trimmed.startsWith('fd');
};

const siteHost = (hostname: string): string => hostname.toLowerCase().replace(/^(?:www|m)\./, '');

export const sameSiteHttps = (current: URL, next: URL): boolean =>
  next.protocol === 'https:' && siteHost(current.hostname) === siteHost(next.hostname);

export const assertPublicHttpsUrl = async (raw: string, resolveHost: LookupFn = defaultLookup): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('url is not absolute');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('public fetches require https');
  if (url.username || url.password) throw new UnsafeUrlError('url must not include credentials');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new UnsafeUrlError('public fetches cannot use a local hostname');
  }
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('public fetches cannot use a private address');
    return url;
  }
  let records: ResolvedAddress[];
  try {
    records = await resolveHost(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('public hostname did not resolve');
  }
  if (!records.length) throw new UnsafeUrlError('public hostname did not resolve');
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new UnsafeUrlError('public hostname resolved to a private address');
    }
  }
  return url;
};

const readCapped = async (response: Response): Promise<string> => {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new UnsafeUrlError('response exceeds 2MB');
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new UnsafeUrlError('response exceeds 2MB');
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    size += step.value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new UnsafeUrlError('response exceeds 2MB');
    }
    chunks.push(step.value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const headerGet = (response: Response, name: string): string | null => response.headers.get(name);

/** Public-source client. Same-site https redirects only, after address checks. */
export const createFetchClient = (options?: {
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  lookup?: LookupFn;
}): HttpClient => {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const resolveHost = options?.lookup ?? defaultLookup;
  return {
    async request(url: string, init?: HttpRequest): Promise<HttpResponse> {
      let current = await assertPublicHttpsUrl(url, resolveHost);
      for (let hop = 0; hop <= 3; hop += 1) {
        const response = await fetchImpl(current.toString(), {
          method: init?.method ?? 'GET',
          headers: init?.headers,
          body: init?.body,
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status >= 300 && response.status < 400) {
          const location = headerGet(response, 'location');
          if (!location || hop === 3) throw new UnsafeUrlError('redirect was not followed');
          const next = new URL(location, current);
          if (!sameSiteHttps(current, next)) throw new UnsafeUrlError('redirect left the https site');
          current = await assertPublicHttpsUrl(next.toString(), resolveHost);
          continue;
        }
        return {
          status: response.status,
          url: response.url || current.toString(),
          body: await readCapped(response),
        };
      }
      throw new UnsafeUrlError('redirect was not followed');
    },
  };
};

/** Tixmo API client. Redirects are errors. Loopback is allowed for the local demo. */
export const createApiFetchClient = (options?: { timeoutMs?: number; fetchImpl?: FetchLike }): HttpClient => {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const fetchImpl = options?.fetchImpl ?? fetch;
  return {
    async request(url: string, init?: HttpRequest): Promise<HttpResponse> {
      const response = await fetchImpl(url, {
        method: init?.method ?? 'GET',
        headers: init?.headers,
        body: init?.body,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return {
        status: response.status,
        url: response.url || url,
        body: await readCapped(response),
      };
    },
  };
};

export const readJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

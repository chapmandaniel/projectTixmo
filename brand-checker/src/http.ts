import { lookup as defaultLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Agent, type Dispatcher } from 'undici';
import type { HttpClient, HttpRequest, HttpResponse } from './types.js';

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

type ResolvedAddress = { address: string; family: number };
type AddressFamily = 4 | 6;

type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<ResolvedAddress[]>;

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number
) => void;

type FetchInit = RequestInit & { dispatcher?: Dispatcher };
type FetchLike = (url: string, init: FetchInit) => Promise<Response>;

type PublicTarget = { url: URL; address: string; family: AddressFamily };

export type PinnedAgent = Agent & {
  connectLookup: (hostname: string, options: { all?: boolean }, callback: LookupCallback) => void;
};

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 96],
  ['64:ff9b::', 96],
  ['2001::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

const expandIpv6 = (address: string): number[] | null => {
  let value = address;
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) return null;
    const octets = value.slice(lastColon + 1).split('.');
    if (octets.length !== 4) return null;
    const bytes: number[] = [];
    for (const octet of octets) {
      if (!/^\d{1,3}$/.test(octet)) return null;
      const parsed = Number(octet);
      if (parsed > 255) return null;
      bytes.push(parsed);
    }
    const high = ((bytes[0] << 8) | bytes[1]).toString(16);
    const low = ((bytes[2] << 8) | bytes[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const parse = (side: string): number[] | null => {
    if (side === '') return [];
    const groups = side.split(':');
    const parsed: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      parsed.push(Number.parseInt(group, 16));
    }
    return parsed;
  };
  const left = parse(halves[0] ?? '');
  if (!left) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const right = parse(halves[1] ?? '');
  if (!right || left.length + right.length > 7) return null;
  return [...left, ...Array<number>(8 - left.length - right.length).fill(0), ...right];
};

/** IPv4 embedded in ::ffff:0:0/96, including hex groups such as ::ffff:7f00:1. */
const unwrapIpv4Mapped = (address: string): string | null => {
  const groups = expandIpv6(address);
  if (!groups) return null;
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!mapped) return null;
  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
};

const normalizeIp = (address: string): string =>
  address.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';

/**
 * Loopback, private, link-local (including 169.254.169.254), CGNAT, benchmarking,
 * IETF protocol assignments, reserved 240/4, multicast, unique-local, NAT64,
 * 6to4, and Teredo, including mapped forms.
 */
export const isBlockedAddress = (address: string): boolean => {
  const trimmed = normalizeIp(address);
  const family = isIP(trimmed);
  if (family === 4) return blocked.check(trimmed, 'ipv4');
  if (family !== 6) return false;
  const embedded = unwrapIpv4Mapped(trimmed);
  if (embedded && blocked.check(embedded, 'ipv4')) return true;
  return blocked.check(trimmed, 'ipv6');
};

const siteHost = (hostname: string): string => hostname.toLowerCase().replace(/^(?:www|m)\./, '');

export const sameSiteHttps = (current: URL, next: URL): boolean =>
  next.protocol === 'https:' && siteHost(current.hostname) === siteHost(next.hostname);

const addressFamily = (address: string): AddressFamily => (isIP(address) === 6 ? 6 : 4);

/** Lookup that ignores the hostname and returns only the address already checked. */
export const pinnedLookup =
  (address: string, family: AddressFamily) =>
  (_hostname: string, options: { all?: boolean }, callback: LookupCallback): void => {
    if (options?.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };

export const createPinnedAgent = (address: string, family: AddressFamily): PinnedAgent => {
  const connectLookup = pinnedLookup(address, family);
  const agent = new Agent({ connect: { lookup: connectLookup } });
  return Object.assign(agent, { connectLookup });
};

const resolvePublicTarget = async (raw: string, resolveHost: LookupFn): Promise<PublicTarget> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('url is not absolute');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('public fetches require https');
  if (url.username || url.password) throw new UnsafeUrlError('url must not include credentials');
  const host = normalizeIp(url.hostname);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new UnsafeUrlError('public fetches cannot use a local hostname');
  }
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('public fetches cannot use a private address');
    return { url, address: host, family: addressFamily(host) };
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
  const first = records[0];
  return { url, address: first.address, family: addressFamily(first.address) };
};

export const assertPublicHttpsUrl = async (raw: string, resolveHost: LookupFn = defaultLookup): Promise<URL> =>
  (await resolvePublicTarget(raw, resolveHost)).url;

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

/** Drop an unread body so the next hop is not stuck until the request timeout. */
const releaseUnreadBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // A body that is already closed is not a failed fetch.
  }
};

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
      let current = await resolvePublicTarget(url, resolveHost);
      for (let hop = 0; hop <= 3; hop += 1) {
        const dispatcher = createPinnedAgent(current.address, current.family);
        try {
          const response = await fetchImpl(current.url.toString(), {
            method: init?.method ?? 'GET',
            headers: init?.headers,
            body: init?.body,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            dispatcher,
          });
          if (response.status >= 300 && response.status < 400) {
            try {
              const location = headerGet(response, 'location');
              if (!location || hop === 3) throw new UnsafeUrlError('redirect was not followed');
              const next = new URL(location, current.url);
              if (!sameSiteHttps(current.url, next)) throw new UnsafeUrlError('redirect left the https site');
              current = await resolvePublicTarget(next.toString(), resolveHost);
            } finally {
              await releaseUnreadBody(response);
            }
            continue;
          }
          let body: string;
          try {
            body = await readCapped(response);
          } catch (error) {
            await releaseUnreadBody(response);
            throw error;
          }
          return {
            status: response.status,
            url: response.url || current.url.toString(),
            body,
          };
        } finally {
          await dispatcher.close();
        }
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

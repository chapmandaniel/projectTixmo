import { planSandboxGraphRequest } from './graph-guard';
import { emitSocialLog, type SocialLogger } from './log';
import { SocialTokenError } from './token-crypto';

export interface GraphFetchResult {
  status: number;
  json: unknown;
  headers: Record<string, string>;
  path: string;
  host: string;
}

export type GraphFetcher = (
  href: string,
  init: { method: string; headers: Record<string, string> }
) => Promise<{ status: number; json: unknown; headers: Record<string, string> }>;

const defaultFetcher: GraphFetcher = async (href, init) => {
  const response = await fetch(href, {
    method: init.method,
    headers: init.headers,
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json, headers };
};

/** Outbound Graph calls. Host must be the sandbox allowlist. Token is never logged. */
export const sandboxGraphGet = async (input: {
  baseUrl: string;
  path: string;
  accessToken: string;
  query?: Record<string, string | number | undefined>;
  teamAccessKey?: string | null;
  fetcher?: GraphFetcher;
  logger?: SocialLogger;
  organizationId?: string;
  connectionId?: string;
}): Promise<GraphFetchResult> => {
  if (!input.accessToken?.trim()) throw new SocialTokenError('Sandbox token missing.');
  const root = planSandboxGraphRequest(input.baseUrl);
  const url = new URL(input.path.replace(/^\//, ''), `${root.href.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  // access_token is query-style for Graph; never put it in logs.
  url.searchParams.set('access_token', input.accessToken.trim());
  const planned = planSandboxGraphRequest(url.origin);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Sandbox': 'true',
  };
  if (input.teamAccessKey?.trim()) {
    headers['X-Team-Access-Key'] = input.teamAccessKey.trim();
  }
  const fetcher = input.fetcher || defaultFetcher;
  const result = await fetcher(url.toString(), { method: 'GET', headers });
  emitSocialLog(input.logger, 'info', 'graph.outbound', {
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    host: planned.host,
    path: url.pathname,
    method: 'GET',
    status: result.status,
  });
  return {
    status: result.status,
    json: result.json,
    headers: result.headers,
    path: url.pathname,
    host: planned.host,
  };
};

export const graphErrorCode = (json: unknown): string | null => {
  if (!json || typeof json !== 'object') return null;
  const error = (json as { error?: { code?: number | string; error_subcode?: number | string } })
    .error;
  if (!error) return null;
  if (error.code !== undefined) return String(error.code);
  return null;
};

export interface SandboxPageSummary {
  id: string;
  name: string;
  linkedInstagramId?: string | null;
  linkedInstagramUsername?: string | null;
}

export const parseAccountsList = (json: unknown): SandboxPageSummary[] => {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const item = row as {
        id?: string;
        name?: string;
        instagram_business_account?: { id?: string; username?: string };
      };
      if (!item.id || !item.name) return null;
      return {
        id: item.id,
        name: item.name,
        linkedInstagramId: item.instagram_business_account?.id || null,
        linkedInstagramUsername: item.instagram_business_account?.username || null,
      };
    })
    .filter(Boolean) as SandboxPageSummary[];
};

const SECRET_KEY =
  /^(?:access[_-]?token|token|authorization|x-team-access-key|tokenciphertext|refreshciphertext|ciphertext|lookuphmac|social_token_encryption_key|social_sandbox_team_access_key)$/i;

const GRAPH_HOST = /(?:^|\.)(?:facebook|instagram|fbcdn)\./i;

export const socialRequestLogPath = (raw: string): string | null => {
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw, 'https://redaction.invalid');
  } catch {
    parsed = null;
  }
  const query = parsed ? parsed.search.slice(1) : '';
  const pathOnly = parsed?.pathname || raw.split('?')[0];
  const social = pathOnly.toLowerCase().includes('/social');
  const sensitive = /(?:^|&)(?:access_token|token|authorization)=/i.test(query);
  const host = parsed?.hostname || '';
  const graph = GRAPH_HOST.test(host) && host !== 'redaction.invalid';
  if (!social && !sensitive && !graph) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return pathOnly || '/';
  const queryIndex = raw.indexOf('?');
  return queryIndex === -1 ? raw : raw.slice(0, queryIndex);
};

export const redactSocialRecord = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) redactSocialRecord(item, seen);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SECRET_KEY.test(key)) {
      delete record[key];
      continue;
    }
    redactSocialRecord(record[key], seen);
  }
  return value;
};

type TelemetryRequest = {
  url?: string;
  data?: unknown;
  query_string?: unknown;
  headers?: unknown;
  cookies?: unknown;
};

export const scrubSocialTelemetry = <T extends { request?: TelemetryRequest; message?: unknown }>(
  event: T
): T => {
  const request = event.request;
  if (request?.url) {
    const safe = socialRequestLogPath(request.url);
    if (safe !== null) {
      request.url = safe;
      delete request.data;
      delete request.query_string;
      delete request.headers;
      delete request.cookies;
    }
  }
  redactSocialRecord(event);
  return event;
};

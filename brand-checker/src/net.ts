import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HttpClient, HttpResponse } from './types.js';

export type CacheEntry = { storedAt: number; body: string };

export type CrtshCache = {
  get(key: string): CacheEntry | null;
  set(key: string, body: string): void;
};

export const createFileCache = (path: string, now = () => Date.now()): CrtshCache => {
  const load = (): Record<string, CacheEntry> => {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { entries?: Record<string, CacheEntry> };
      return parsed.entries ?? {};
    } catch {
      return {};
    }
  };
  return {
    get(key) {
      return load()[key] ?? null;
    },
    set(key, body) {
      const entries = load();
      entries[key] = { storedAt: now(), body };
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ entries }), { mode: 0o600 });
    },
  };
};

export const FRESH_MS = 20 * 60 * 60 * 1000;

export const fetchWithBackoff = async (
  http: HttpClient,
  url: string,
  headers: Record<string, string>,
  sleep: (ms: number) => Promise<void>,
  attempts = 3
): Promise<HttpResponse> => {
  let wait = 1000;
  let last: HttpResponse = { status: 599, url, body: '' };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await http.request(url, { headers });
    if (last.status !== 429 && last.status < 500) return last;
    if (attempt === attempts - 1) break;
    await sleep(wait);
    wait *= 2;
  }
  return last;
};

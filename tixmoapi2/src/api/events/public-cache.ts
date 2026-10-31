import { config } from '../../config/environment';

type Entry = { value: unknown; expiresAt: number };

/**
 * One process, one map. Other replicas do not see an invalidation; they drop
 * the entry when the TTL expires. That is the bound on a multi-replica onsale.
 */
const values = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const idToSlug = new Map<string, string>();

export function publicEventCacheTtlMs(): number {
  const seconds = config.publicEventCacheTtlSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
}

export function publicCacheControlHeader(): string {
  const ttlMs = publicEventCacheTtlMs();
  if (ttlMs <= 0) return 'no-store';
  const ttlSeconds = Math.floor(ttlMs / 1000);
  return `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`;
}

function indexCached(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const record = value as { id?: unknown; slug?: unknown; events?: unknown };
  if (typeof record.id === 'string' && typeof record.slug === 'string') {
    idToSlug.set(record.id, record.slug);
  }
  if (!Array.isArray(record.events)) return;
  for (const event of record.events) {
    if (!event || typeof event !== 'object') continue;
    const row = event as { id?: unknown; slug?: unknown };
    if (typeof row.id === 'string' && typeof row.slug === 'string') idToSlug.set(row.id, row.slug);
  }
}

/**
 * Concurrent misses for one key share a single load. A rejected load is not stored.
 */
export async function cachedPublicRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const ttlMs = publicEventCacheTtlMs();
  if (ttlMs <= 0) return load();
  const cached = values.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const flight = load()
    .then((value) => {
      values.set(key, { value, expiresAt: Date.now() + ttlMs });
      indexCached(value);
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === flight) inflight.delete(key);
    });
  inflight.set(key, flight);
  return flight;
}

/**
 * Staff edits on this process. Order holds do not call this: availability may
 * stay stale until the TTL, and POST /orders rechecks inventory under a lock.
 */
export function invalidatePublicEvent(target: { id?: string; slug?: string | null }): void {
  if (target.slug) values.delete(publicEventCacheKey(target.slug));
  const mapped = target.id ? idToSlug.get(target.id) : undefined;
  if (mapped) values.delete(publicEventCacheKey(mapped));
  if (target.id && !target.slug && !mapped) {
    for (const key of [...values.keys()]) {
      if (key.startsWith('slug:')) values.delete(key);
    }
  }
  for (const key of [...values.keys()]) {
    if (key.startsWith('list:')) values.delete(key);
  }
  if (target.id) idToSlug.delete(target.id);
}

export function publicEventCacheKey(slug: string): string {
  return `slug:${slug}`;
}

export function publicEventListCacheKey(query: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): string {
  return `list:${query.page ?? 1}:${query.limit ?? 20}:${query.category ?? ''}:${query.search ?? ''}`;
}

export function clearPublicEventCacheForTests(): void {
  values.clear();
  inflight.clear();
  idToSlug.clear();
}

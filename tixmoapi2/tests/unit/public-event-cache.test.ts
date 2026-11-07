jest.mock('../../src/config/environment', () => ({
  config: { publicEventCacheTtlSeconds: 4 },
}));
jest.mock('../../src/api/events/service', () => ({
  eventService: {
    getPublicEventBySlug: jest.fn(),
    listPublicEvents: jest.fn(),
  },
}));

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { eventService } from '../../src/api/events/service';
import publicEventRoutes from '../../src/api/events/public.routes';
import { ApiError } from '../../src/utils/ApiError';
import {
  cachedPublicRead,
  clearPublicEventCacheForTests,
  invalidatePublicEvent,
  publicEventCacheKey,
} from '../../src/api/events/public-cache';

const event = {
  id: 'event-1',
  slug: 'onsale',
  name: 'On sale',
  ticketTypes: [{ id: 'ga', quantityAvailable: 10 }],
};
const app = express();
app.use(express.json());
app.use('/events/public', publicEventRoutes);
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
);

const STAGING_DASH = 'https://tixmo-dashboard-candidate-staging-audit-20261005.up.railway.app';

const varyTokens = (value: string | string[] | undefined): string[] => {
  const raw = Array.isArray(value) ? value.join(',') : value || '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

const routedApp = () => {
  const routed = express();
  routed.set('etag', 'weak');
  routed.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin !== undefined && origin !== STAGING_DASH) {
      res.status(403).json({ success: false, message: 'denied' });
      return;
    }
    next();
  });
  routed.use(
    cors({
      origin: (origin, callback) => {
        if (origin === undefined || origin === STAGING_DASH) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  routed.use(compression());
  routed.use('/api/v1/events/public', publicEventRoutes);
  routed.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ApiError) {
        res.status(err.statusCode).json({ success: false, message: err.message });
        return;
      }
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  );
  return routed;
};

describe('public event cache', () => {
  beforeEach(() => {
    clearPublicEventCacheForTests();
    jest.mocked(eventService.getPublicEventBySlug).mockReset();
    jest.mocked(eventService.listPublicEvents).mockReset();
    jest.mocked(eventService.getPublicEventBySlug).mockResolvedValue(event as never);
    jest.mocked(eventService.listPublicEvents).mockResolvedValue({
      events: [event],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);
  });

  it('serves a miss then a hit and coalesces concurrent misses', async () => {
    let release: (value: typeof event) => void = () => undefined;
    let started: () => void = () => undefined;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.mocked(eventService.getPublicEventBySlug).mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      }) as never;
    });
    const done = Promise.all([
      request(app).get('/events/public/onsale'),
      request(app).get('/events/public/onsale'),
    ]);
    await startedPromise;
    await new Promise((resolve) => setImmediate(resolve));
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(1);
    release(event);
    const [a, b] = await done;
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(a.headers['cache-control']).toBe('public, max-age=4, stale-while-revalidate=4');
    expect(a.headers.vary).toBe('Authorization');
    jest.mocked(eventService.getPublicEventBySlug).mockResolvedValue(event as never);
    const hit = await request(app).get('/events/public/onsale');
    expect(hit.status).toBe(200);
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(1);
  });

  it('does not cache an authenticated or staff request', async () => {
    const anon = await request(app).get('/events/public/onsale');
    expect(anon.headers['cache-control']).toContain('public');
    const authed = await request(app)
      .get('/events/public/onsale')
      .set('Authorization', 'Bearer staff');
    expect(authed.status).toBe(200);
    expect(authed.headers['cache-control']).toBe('private, no-store');
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(2);
    const again = await request(app)
      .get('/events/public/onsale')
      .set('Authorization', 'Bearer staff');
    expect(again.headers['cache-control']).toBe('private, no-store');
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(3);
  });

  it('expires a cached slug and does not store a miss', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(1_000);
      const load = jest.fn().mockResolvedValue(event);
      await cachedPublicRead(publicEventCacheKey('onsale'), load);
      jest.setSystemTime(1_000 + 3_999);
      await cachedPublicRead(publicEventCacheKey('onsale'), load);
      expect(load).toHaveBeenCalledTimes(1);
      jest.setSystemTime(1_000 + 4_000);
      await cachedPublicRead(publicEventCacheKey('onsale'), load);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }

    clearPublicEventCacheForTests();
    jest.mocked(eventService.getPublicEventBySlug).mockResolvedValue(null);
    expect((await request(app).get('/events/public/missing')).status).toBe(404);
    expect((await request(app).get('/events/public/missing')).status).toBe(404);
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(2);
  });

  it('drops a cached event after a staff invalidation and caches the public list', async () => {
    await cachedPublicRead(publicEventCacheKey('onsale'), async () => event);
    invalidatePublicEvent({ id: 'event-1' });
    const load = jest.fn().mockResolvedValue(event);
    await cachedPublicRead(publicEventCacheKey('onsale'), load);
    expect(load).toHaveBeenCalledTimes(1);

    const first = await request(app).get('/events/public');
    const second = await request(app).get('/events/public');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toContain('public');
    expect(second.body.data.events).toHaveLength(1);
    expect(eventService.listPublicEvents).toHaveBeenCalledTimes(1);
  });

  it('keeps CORS Origin on the public event and list responses that also vary on Authorization', async () => {
    const routed = routedApp();
    const miss = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Origin', STAGING_DASH)
      .set('Accept-Encoding', 'gzip');

    expect(miss.status).toBe(200);
    expect(miss.headers['access-control-allow-origin']).toBe(STAGING_DASH);
    expect(miss.headers['access-control-allow-credentials']).toBe('true');
    expect(miss.headers['cache-control']).toBe('public, max-age=4, stale-while-revalidate=4');
    expect(varyTokens(miss.headers.vary)).toEqual(
      expect.arrayContaining(['Origin', 'Authorization', 'Accept-Encoding'])
    );

    const hit = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Origin', STAGING_DASH)
      .set('Accept-Encoding', 'gzip');
    expect(hit.status).toBe(200);
    expect(hit.body).toEqual(miss.body);
    expect(eventService.getPublicEventBySlug).toHaveBeenCalledTimes(1);
    expect(varyTokens(hit.headers.vary)).toEqual(
      expect.arrayContaining(['Origin', 'Authorization', 'Accept-Encoding'])
    );

    const etag = miss.headers.etag;
    expect(typeof etag).toBe('string');
    const conditional = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Origin', STAGING_DASH)
      .set('Accept-Encoding', 'gzip')
      .set('If-None-Match', String(etag));
    expect(conditional.status).toBe(304);
    // Express drops Content-Type on 304, so compression does not append
    // Accept-Encoding. Origin and Authorization still select the variant.
    expect(varyTokens(conditional.headers.vary)).toEqual(
      expect.arrayContaining(['Origin', 'Authorization'])
    );
    expect(conditional.headers['access-control-allow-origin']).toBe(STAGING_DASH);

    const list = await request(routed)
      .get('/api/v1/events/public')
      .set('Origin', STAGING_DASH)
      .set('Accept-Encoding', 'gzip');
    expect(list.status).toBe(200);
    expect(varyTokens(list.headers.vary)).toEqual(
      expect.arrayContaining(['Origin', 'Authorization', 'Accept-Encoding'])
    );

    const noOrigin = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Accept-Encoding', 'gzip');
    expect(noOrigin.status).toBe(200);
    expect(noOrigin.headers['access-control-allow-origin']).toBeUndefined();
    expect(varyTokens(noOrigin.headers.vary)).toEqual(
      expect.arrayContaining(['Origin', 'Authorization', 'Accept-Encoding'])
    );

    const authed = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Origin', STAGING_DASH)
      .set('Authorization', 'Bearer staff')
      .set('Accept-Encoding', 'gzip');
    expect(authed.headers['cache-control']).toBe('private, no-store');
    expect(varyTokens(authed.headers.vary)).toContain('Origin');
    expect(varyTokens(authed.headers.vary)).not.toEqual(['Authorization']);

    const denied = await request(routed)
      .get('/api/v1/events/public/onsale')
      .set('Origin', 'https://demo.tixmo.co')
      .set('Accept-Encoding', 'gzip');
    expect(denied.status).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

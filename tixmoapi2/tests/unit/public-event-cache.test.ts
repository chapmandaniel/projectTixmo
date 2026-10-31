jest.mock('../../src/config/environment', () => ({
  config: { publicEventCacheTtlSeconds: 4 },
}));
jest.mock('../../src/api/events/service', () => ({
  eventService: {
    getPublicEventBySlug: jest.fn(),
    listPublicEvents: jest.fn(),
  },
}));

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
});

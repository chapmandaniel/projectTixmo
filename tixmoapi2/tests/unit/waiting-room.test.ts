import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { waitingRoom } from '../../src/middleware/waitingRoom';
import { getRedisClient } from '../../src/config/redis';
jest.mock('../../src/config/redis', () => ({ getRedisClient: jest.fn() }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/config/environment', () => ({ config: { waitingRoomMaxConcurrentRequests: 17 } }));

describe('Waiting room request leases', () => {
  let client: any, req: any, res: any, next: jest.Mock;
  beforeEach(() => {
    client = {
      isReady: true,
      eval: jest.fn().mockResolvedValue(1),
      zRem: jest.fn().mockResolvedValue(1),
    };
    jest.mocked(getRedisClient).mockReturnValue(client);
    req = Object.assign(new EventEmitter(), { path: '/orders', aborted: false });
    res = Object.assign(new EventEmitter(), {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    });
    next = jest.fn();
  });
  afterEach(async () => {
    res.emit('finish');
    await Promise.resolve();
    jest.restoreAllMocks();
    jest.useRealTimers();
    jest.clearAllMocks();
  });
  const enter = () => waitingRoom(req as Request, res as Response, next as NextFunction);
  it('admits requests and releases once across finish and close', async () => {
    await enter();
    expect(next).toHaveBeenCalledTimes(1);
    res.emit('finish');
    res.emit('close');
    res.emit('finish');
    expect(client.zRem).toHaveBeenCalledTimes(1);
  });
  it('releases a close-only request', async () => {
    await enter();
    res.emit('close');
    expect(client.zRem).toHaveBeenCalledTimes(1);
  });
  it('handles aborts while acquisition is unresolved without entering a closed request', async () => {
    let acknowledge!: (value: number) => void;
    client.eval.mockReturnValueOnce(
      new Promise((resolve) => {
        acknowledge = resolve;
      })
    );
    const pending = enter();
    res.emit('close');
    req.emit('aborted');
    acknowledge(1);
    await pending;
    expect(next).not.toHaveBeenCalled();
    expect(client.zRem).toHaveBeenCalledTimes(1);
  });
  it('preserves overload responses without allocating capacity', async () => {
    client.eval.mockResolvedValueOnce(0);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await enter();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      code: 'WAITING_ROOM_ACTIVE',
      message: 'High traffic volume. Please try again in a moment.',
      retryAfter: 5,
    });
    expect(next).not.toHaveBeenCalled();
    expect(client.zRem).not.toHaveBeenCalled();
  });
  it('fails open on acquisition errors and bounds uncertain ownership by token', async () => {
    client.eval.mockRejectedValueOnce(new Error('Redis unavailable'));
    client.zRem.mockRejectedValueOnce(new Error('Release unavailable'));
    await enter();
    expect(next).toHaveBeenCalledTimes(1);
    expect(client.zRem).toHaveBeenCalledTimes(1);
  });
  it('avoids queued acquisition when Redis is known to be unready', async () => {
    client.isReady = false;
    await enter();
    expect(next).toHaveBeenCalledTimes(1);
    expect(client.eval).not.toHaveBeenCalled();
  });
  it.each([[0, 5], [0.5, 6], [0.999999, 7]])('marks rejection with matching jitter at %s', async (random, delay) => {
    jest.spyOn(Math, 'random').mockReturnValue(random);
    client.eval.mockResolvedValueOnce(0);
    await enter();
    expect(res.set).toHaveBeenCalledWith('Retry-After', String(delay));
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WAITING_ROOM_ACTIVE', retryAfter: delay }));
    expect(client.zRem).not.toHaveBeenCalled();
  });
  it.each(['finish', 'close', 'aborted'])('renews configured leases and clears timer on %s', async (event) => {
    jest.useFakeTimers();
    await enter();
    expect(client.eval.mock.calls[0][1].arguments).toEqual([expect.any(String), '17', '120000']);
    await jest.advanceTimersByTimeAsync(30000);
    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(client.eval.mock.calls[1][1].arguments).toEqual([client.eval.mock.calls[0][1].arguments[0], '120000']);
    (event === 'aborted' ? req : res).emit(event);
    await jest.advanceTimersByTimeAsync(90000);
    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(client.zRem).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('preserves health and metrics bypasses', async () => {
    for (const path of ['/health', '/ready', '/metrics']) {
      req.path = path;
      await enter();
    }
    expect(next).toHaveBeenCalledTimes(3);
    expect(client.eval).not.toHaveBeenCalled();
  });
});

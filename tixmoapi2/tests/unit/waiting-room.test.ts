import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { waitingRoom } from '../../src/middleware/waitingRoom';
import { getRedisClient } from '../../src/config/redis';
jest.mock('../../src/config/redis', () => ({ getRedisClient: jest.fn() }));

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
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    });
    next = jest.fn();
  });
  afterEach(async () => {
    res.emit('finish');
    await Promise.resolve();
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
    await enter();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
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
  it('preserves health and metrics bypasses', async () => {
    for (const path of ['/health', '/metrics']) {
      req.path = path;
      await enter();
    }
    expect(next).toHaveBeenCalledTimes(2);
    expect(client.eval).not.toHaveBeenCalled();
  });
});

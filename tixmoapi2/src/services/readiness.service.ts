import prisma from '../config/prisma';
import { getRedisClient } from '../config/redis';

type Checks = { database: boolean | null; redis: boolean | null };
let active: { checks: Checks; finished: Promise<void> } | undefined;
let cached: { checks: Checks; at: number } | undefined;

/** Bound the response time and share probes so a stalled dependency cannot accumulate checks. */
export async function checkReadiness(): Promise<Checks> {
  if (cached && Date.now() - cached.at < 1000) return { ...cached.checks };
  if (!active) {
    const checks: Checks = { database: null, redis: null };
    const database = Promise.resolve().then(() => prisma.$queryRaw`SELECT 1`);
    const redis = Promise.resolve().then(async () => {
      const client = getRedisClient();
      // Never enqueue a health command on a disconnected Redis client.
      if (client.isReady !== true) return false;
      return (await client.ping()) === 'PONG';
    });
    const finish = Promise.all([
      database.then(
        () => {
          checks.database = true;
        },
        () => {
          checks.database = false;
        }
      ),
      redis.then(
        (ready) => {
          checks.redis = ready;
        },
        () => {
          checks.redis = false;
        }
      ),
    ]).then(() => {
      cached = { checks: { ...checks }, at: Date.now() };
      active = undefined;
    });
    active = { checks, finished: finish };
  }
  const probe = active;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe.finished,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 2000);
        timer.unref();
      }),
    ]);
    return { ...probe.checks };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

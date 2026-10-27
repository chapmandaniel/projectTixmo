import { getRedisClient } from '../config/redis';
import { queryReadinessDatabase, warmReadinessDatabase } from './readiness-db';

type Checks = { database: boolean | null; redis: boolean | null };
let active: { checks: Checks; finished: Promise<void> } | undefined;
let cached: { checks: Checks; at: number } | undefined;

const PROBE_BUDGET_MS = 2000;
const RESULT_CACHE_MS = 1000;

/** A dead dependency is not ready. A timed-out probe is not ready either. */
export function readinessHttpStatus(checks: Checks): 200 | 503 {
  return checks.database === true && checks.redis === true ? 200 : 503;
}

/**
 * Bound the response time and share one probe so a stalled dependency cannot
 * accumulate checks. The database probe uses its own one-connection client,
 * not the application pool checkout is holding.
 */
export async function checkReadiness(): Promise<Checks> {
  if (cached && Date.now() - cached.at < RESULT_CACHE_MS) return { ...cached.checks };
  if (!active) {
    const checks: Checks = { database: null, redis: null };
    const database = Promise.resolve().then(() => queryReadinessDatabase());
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
        timer = setTimeout(resolve, PROBE_BUDGET_MS);
        timer.unref();
      }),
    ]);
    return { ...probe.checks };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

warmReadinessDatabase();

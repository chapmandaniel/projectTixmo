import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;
let statementTimeoutApplied = false;

/**
 * A second Prisma pool of one connection. Readiness must not wait behind
 * checkout transactions sitting in the application pool. This does not change
 * that pool's size or any Railway variable.
 */
export function readinessDatabaseUrl(raw: string): string {
  if (/[?&]connection_limit=/.test(raw)) {
    return raw.replace(/([?&])connection_limit=[^&]*/, '$1connection_limit=1');
  }
  return `${raw}${raw.includes('?') ? '&' : '?'}connection_limit=1`;
}

function readinessClient(): PrismaClient {
  if (client) return client;
  const raw = process.env.DATABASE_URL || '';
  if (!raw) throw new Error('DATABASE_URL is not set');
  client = new PrismaClient({
    datasources: { db: { url: readinessDatabaseUrl(raw) } },
    log: ['error'],
  });
  return client;
}

export async function queryReadinessDatabase(): Promise<unknown> {
  const db = readinessClient();
  if (!statementTimeoutApplied) {
    // Session-scoped on this one connection. A wedged SELECT 1 cannot sit past it.
    await db.$queryRaw`SELECT set_config('statement_timeout', '1500', false)`;
    statementTimeoutApplied = true;
  }
  return db.$queryRaw`SELECT 1`;
}

export function warmReadinessDatabase(): void {
  if (!process.env.DATABASE_URL) return;
  void queryReadinessDatabase().catch(() => undefined);
}

export async function disconnectReadinessDatabase(): Promise<void> {
  const current = client;
  client = undefined;
  statementTimeoutApplied = false;
  if (current) await current.$disconnect();
}

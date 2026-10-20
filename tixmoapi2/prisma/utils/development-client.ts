import { PrismaClient } from '@prisma/client';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const allowedParameters = new Set([
  'schema',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
]);
const developmentClients = new WeakSet<PrismaClient>();

export function assertDevelopmentTarget(
  env: NodeJS.ProcessEnv = process.env,
  authorization = 'TIXMO_ALLOW_DEV_DATA'
): string {
  if (
    !['development', 'test'].includes(env.NODE_ENV || '') ||
    env[authorization] !== 'true' ||
    !env.TIXMO_DEV_DATABASE_URL
  ) {
    throw new Error(
      `Local database operations require NODE_ENV=development or test, ${authorization}=true and an explicit TIXMO_DEV_DATABASE_URL.`
    );
  }
  let target: URL;
  try {
    target = new URL(env.TIXMO_DEV_DATABASE_URL);
  } catch {
    throw new Error('Invalid local development database target.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !loopbackHosts.has(target.hostname) ||
    !/^\/(?:tixmoapi|tixmo_(?:dev|test)(?:_[a-zA-Z0-9_]+)?)$/.test(target.pathname) ||
    target.hash ||
    [...target.searchParams.keys()].some((key) => !allowedParameters.has(key)) ||
    (env.DATABASE_URL && env.DATABASE_URL !== env.TIXMO_DEV_DATABASE_URL)
  ) {
    throw new Error(
      'Refusing local database operation: select a matching loopback tixmoapi, tixmo_dev or tixmo_test database explicitly. Remote or inherited application targets are not allowed.'
    );
  }
  return target.toString();
}

export function createDevelopmentClient(): PrismaClient {
  const url = assertDevelopmentTarget();
  const client = new PrismaClient({ datasources: { db: { url } } });
  developmentClients.add(client);
  return client;
}

export function assertDevelopmentClient(client: PrismaClient): void {
  if (!developmentClients.has(client)) {
    throw new Error(
      'Fixture writes require a client created for an explicitly authorized local development target.'
    );
  }
}

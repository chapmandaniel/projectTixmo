import { createHash, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const PREFIX = 'gwc_';

/**
 * Issues one checker token and prints it once. The database stores only the
 * sha256 hash. Refuses any database that is not a loopback disposable database.
 * Do not point this at production. Put the printed token in the checker
 * service's Railway variables. It is not written to the repo.
 */
function assertDisposableDatabase(raw: string | undefined): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to issue a checker token when NODE_ENV is production');
  }
  if (!raw) throw new Error('DATABASE_URL is required');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a postgres URL');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Refusing to issue a checker token against a non-loopback database');
  }
  if (!/^\/tixmo_disposable_[a-z0-9_]+$/.test(url.pathname)) {
    throw new Error(
      'Refusing to issue a checker token unless the database name starts with tixmo_disposable_'
    );
  }
  const lowered = raw.toLowerCase();
  if (
    lowered.includes('railway') ||
    lowered.includes('amazonaws') ||
    lowered.includes('neon.tech')
  ) {
    throw new Error('Refusing to issue a checker token against a hosted database');
  }
}

async function main() {
  assertDisposableDatabase(process.env.DATABASE_URL);
  const label = (process.argv[2] || 'checker').trim().slice(0, 80) || 'checker';
  const token = `${PREFIX}${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const prisma = new PrismaClient();
  try {
    const row = await prisma.giveawayCheckerToken.create({
      data: { tokenHash, label },
    });
    process.stdout.write(`${token}\n`);
    process.stderr.write(
      `Stored token ${row.id}. The secret was printed once and is not recoverable.\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Token issue failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export { assertDisposableDatabase };

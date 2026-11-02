import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEMO_EMAIL = 'harbourfest.owner@localhost.test';
const DEMO_PASSWORD = 'LocalHarbour-1!';
const ORG_NAME = 'Harbour Fest';
const ORG_SLUG = 'harbour-fest';
const TOKEN_LABEL = 'local-brand-check';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLOCKED = ['railway', 'amazonaws', 'neon.tech', 'supabase.co', 'render.com', 'azure.com'];

function assertLocalDatabase(raw) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed brand protection when NODE_ENV is production');
  }
  if (!raw) throw new Error('DATABASE_URL is required');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a URL');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Refusing to seed brand protection against a non-loopback database');
  }
  if (!/^\/tixmo_disposable_[a-z0-9_]+$/.test(url.pathname)) {
    throw new Error('Refusing to seed unless the database name starts with tixmo_disposable_');
  }
  const lowered = raw.toLowerCase();
  for (const marker of BLOCKED) {
    if (lowered.includes(marker)) {
      throw new Error('Refusing to seed brand protection against a hosted database');
    }
  }
}

function assertInside(path, root, label) {
  const resolved = resolve(path);
  const resolvedRoot = resolve(root);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`${label} must stay inside ${resolvedRoot}`);
  }
  return resolved;
}

function verificationCode() {
  const bytes = randomBytes(8);
  let raw = '';
  for (let index = 0; index < bytes.length; index += 1) {
    raw += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function main() {
  assertLocalDatabase(process.env.DATABASE_URL);
  const repoRoot = resolve(process.env.BRAND_REPO_ROOT || new URL('../..', import.meta.url).pathname);
  const watchlistPath = assertInside(
    process.env.BRAND_WATCHLIST_PATH || resolve(repoRoot, 'brand-checker/.local/watchlist.json'),
    resolve(repoRoot, 'brand-checker/.local'),
    'Watchlist path'
  );
  const tokenPath = assertInside(
    process.env.BRAND_TOKEN_FILE || resolve(repoRoot, 'brand-checker/.local/checker-token'),
    resolve(repoRoot, 'brand-checker/.local'),
    'Token file'
  );
  const prisma = new PrismaClient();
  try {
    const organization = await prisma.organization.upsert({
      where: { slug: ORG_SLUG },
      update: { name: ORG_NAME, status: 'ACTIVE', type: 'PROMOTER' },
      create: { name: ORG_NAME, slug: ORG_SLUG, type: 'PROMOTER', status: 'ACTIVE' },
    });
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        passwordHash,
        firstName: 'Harbour',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId: organization.id,
        emailVerified: true,
        disabledAt: null,
        isPlatformAdmin: false,
      },
      create: {
        email: DEMO_EMAIL,
        passwordHash,
        firstName: 'Harbour',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId: organization.id,
        emailVerified: true,
      },
    });
    const existingAccount = await prisma.officialAccount.findFirst({
      where: {
        organizationId: organization.id,
        platform: 'X',
        platformAccountId: '1000000001',
      },
    });
    if (!existingAccount) {
      const code = verificationCode();
      await prisma.officialAccount.create({
        data: {
          organizationId: organization.id,
          platform: 'X',
          platformAccountId: '1000000001',
          handle: 'harbourfest',
          profileUrl: 'https://x.com/harbourfest',
          displayName: 'Harbour Fest',
          status: 'PENDING',
          verificationMethod: 'ONE_TIME_CODE',
          verificationCode: code,
          verificationCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          createdBy: user.id,
        },
      });
    }
    await prisma.giveawayCheckerToken.updateMany({
      where: { label: TOKEN_LABEL, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const token = `gwc_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.giveawayCheckerToken.create({
      data: {
        tokenHash,
        label: TOKEN_LABEL,
        scopes: ['ingest:write', 'targets:read'],
      },
    });
    const watchlist = {
      organizations: [
        {
          organizationId: organization.id,
          names: [ORG_NAME],
          domains: ['harbourfest.example'],
          accounts: [
            {
              platform: 'X',
              platformAccountId: '1000000001',
              handle: 'harbourfest',
              profileUrl: 'https://x.com/harbourfest',
              displayName: 'Harbour Fest',
            },
          ],
        },
      ],
    };
    mkdirSync(dirname(watchlistPath), { recursive: true });
    writeFileSync(watchlistPath, `${JSON.stringify(watchlist, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
    process.stdout.write(
      [
        'Local brand-protection seed (this database only)',
        `Demo login: ${DEMO_EMAIL}`,
        `Demo password: ${DEMO_PASSWORD}`,
        `Organization: ${ORG_NAME} (${organization.id})`,
        'Official account: X @harbourfest id 1000000001 status PENDING',
        `Checker token (local database only, shown once): ${token}`,
        '',
      ].join('\n')
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Seed failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

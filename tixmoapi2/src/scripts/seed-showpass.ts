/**
 * One-step Showpass fixture seed for the API image.
 * Run after migrate and, on Railway, after db:bootstrap.
 * Prints file paths for the scanner key, webhook secret, and password. Never prints those secrets.
 */
import './seed-showpass-guard';
import { randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import prisma from '../config/prisma';
import { connectRedis, disconnectRedis } from '../config/redis';
import { scannerService } from '../api/scanners/service';
import { computedFixtureShiftDays, FIXTURE_RUNTIME_ID } from '../services/vendors/fixture-runtime';
import { vendorImportService } from '../services/vendors/import-service';
import { FixtureShowpassAdapter } from '../services/vendors/showpass-fixture';
import { hashPassword } from '../utils/password';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'] as const;
const DEMO_KEY = 'sp_demo_valid_key';
const VENUE_ID = 'fixture';
const COLLIDING_SLUG = 'halloween-at-the-polygon-gallery';
const LOCAL_EMAIL = 'organizer@example.test';
const LOCAL_ORG_SLUG = 'fixture-festival';
const RAILWAY_SANDBOX_NAMES = new Set(['sandbox', 'development', 'dev', 'vendor-sandbox', 'labs']);
const SCANNER_NAME = 'Showpass QA scanner';
const IMPORT_IDS = ['1545631', '1563243', '1530323'];

const secretPath = (envName: string, filename: string): string => {
  const configured = process.env[envName]?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'tmp', filename));
};

const writeSecret = (file: string, value: string): void => {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${value}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
};

const readOrCreateSecret = (file: string): string => {
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim();
    if (existing.length >= 16) return existing;
  }
  const created = randomBytes(32).toString('hex');
  writeSecret(file, created);
  return created;
};

type SeedMode = 'fresh-org' | 'connected';

const seedMode = (): SeedMode | null => {
  const argv = process.argv.slice(2);
  if (argv.includes('--connected')) return 'connected';
  if (argv.includes('--fresh-org')) return 'fresh-org';
  const configured = process.env.SHOWPASS_SEED_MODE?.trim().toLowerCase();
  if (!configured || configured === 'fresh-org') return 'fresh-org';
  if (configured === 'connected') return 'connected';
  // eslint-disable-next-line no-console
  console.error('SHOWPASS_SEED_MODE must be fresh-org or connected');
  return null;
};

const assertSeedAllowed = (): boolean => {
  if (process.env.SHOWPASS_SEED_ALLOW !== 'sandbox') {
    console.error('Showpass fixture seed requires SHOWPASS_SEED_ALLOW=sandbox');
    return false;
  }
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    console.error('Showpass fixture seed refuses to run when NODE_ENV or APP_ENV is production');
    return false;
  }
  const railway = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
  if (railway && !RAILWAY_SANDBOX_NAMES.has(railway)) {
    console.error(
      'Showpass fixture seed refuses this Railway environment. Allowed names: sandbox, development, dev, vendor-sandbox, labs'
    );
    return false;
  }
  return true;
};

const resolvePassword = (file: string): { password: string; passwordFile: string | null } => {
  const fromEnv = process.env.SHOWPASS_SEED_PASSWORD;
  if (fromEnv !== undefined && fromEnv !== '') {
    if (fromEnv.length < 12) {
      throw new Error('SHOWPASS_SEED_PASSWORD must be at least 12 characters');
    }
    return { password: fromEnv, passwordFile: null };
  }
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim();
    if (existing.length >= 12) {
      chmodSync(file, 0o600);
      return { password: existing, passwordFile: file };
    }
  }
  const created = randomBytes(24).toString('base64url');
  writeSecret(file, created);
  return { password: created, passwordFile: file };
};

const requireEnv = (): boolean => {
  const missing: string[] = REQUIRED.filter((name) => !process.env[name]?.trim());
  const key = process.env.VENDOR_CREDENTIAL_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/.test(key)) missing.push('VENDOR_CREDENTIAL_KEY (64 hex characters)');
  if (process.env.SHOWPASS_ADAPTER === 'live') missing.push('SHOWPASS_ADAPTER must not be live');
  if (missing.length) {
    console.error(`Showpass fixture seed is missing: ${[...new Set(missing)].join(', ')}`);
    return false;
  }
  return true;
};

async function main(): Promise<void> {
  if (!assertSeedAllowed() || !requireEnv()) {
    process.exitCode = 1;
    return;
  }
  const mode = seedMode();
  if (!mode) {
    process.exitCode = 1;
    return;
  }
  process.env.SHOWPASS_ADAPTER = 'fixture';
  delete process.env.SHOWPASS_FIXTURE_REVISION;
  const webhookSecretFile = secretPath(
    'SHOWPASS_QA_WEBHOOK_SECRET_FILE',
    'showpass-qa-webhook-secret'
  );
  const scannerKeyFile = secretPath('SHOWPASS_QA_SCANNER_KEY_FILE', 'showpass-qa-scanner.key');
  const passwordFile = secretPath('SHOWPASS_QA_PASSWORD_FILE', 'showpass-qa-organizer.password');
  const webhookSecret = readOrCreateSecret(webhookSecretFile);
  try {
    const organization = await prisma.organization.upsert({
      where: { slug: LOCAL_ORG_SLUG },
      update: { status: 'ACTIVE' },
      create: {
        name: 'Fixture Festival',
        slug: LOCAL_ORG_SLUG,
        type: 'PROMOTER',
        status: 'ACTIVE',
      },
    });
    const organizationId = organization.id;
    const organizationSlug = organization.slug;
    const existingUser = await prisma.user.findUnique({ where: { email: LOCAL_EMAIL } });
    if (existingUser && existingUser.organizationId !== organizationId) {
      throw new Error('QA login email is already on another organization');
    }
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER', disabledAt: null, NOT: { email: LOCAL_EMAIL } },
    });
    const { password, passwordFile: writtenPasswordFile } = resolvePassword(passwordFile);
    const passwordHash = await hashPassword(password);
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { passwordHash },
        })
      : await prisma.user.create({
          data: {
            email: LOCAL_EMAIL,
            passwordHash,
            firstName: 'Fixture',
            lastName: 'Organizer',
            role: owner ? 'ADMIN' : 'OWNER',
            organizationId,
            emailVerified: true,
          },
        });
    const userId = user.id;
    const email = LOCAL_EMAIL;

    const collision = await prisma.event.findUnique({ where: { slug: COLLIDING_SLUG } });
    const collider = collision
      ? collision
      : await prisma.event.create({
          data: {
            organizationId,
            name: 'Existing Tixmo page',
            slug: COLLIDING_SLUG,
            timezone: 'America/St_Johns',
            status: 'DRAFT',
            ticketingMode: 'TIXMO',
          },
        });

    const shiftDays = computedFixtureShiftDays();
    await prisma.vendorFixtureRuntime.upsert({
      where: { id: FIXTURE_RUNTIME_ID },
      create: { id: FIXTURE_RUNTIME_ID, revision: 'baseline', revokedKeys: [], shiftDays },
      update: { revision: 'baseline', revokedKeys: [], shiftDays },
    });

    if (mode === 'fresh-org') {
      await prisma.vendorWebhookInbox.deleteMany({ where: { organizationId } });
      await prisma.vendorFestivalConfig.deleteMany({ where: { organizationId } });
      await prisma.vendorConnection.deleteMany({
        where: { organizationId, provider: 'SHOWPASS' },
      });
    } else {
      await vendorImportService.connect(organizationId, {
        apiKey: DEMO_KEY,
        vendorVenueId: VENUE_ID,
        webhookSecret,
      });
      await vendorImportService.importEvents(organizationId, VENUE_ID, IMPORT_IDS);
      await connectRedis();
      await vendorImportService.syncOrganization(organizationId);
    }
    const preview =
      mode === 'connected'
        ? await vendorImportService.preview(organizationId, VENUE_ID)
        : { events: [] };
    const counts =
      mode === 'connected' ? await vendorImportService.listSoldCounts(organizationId) : [];
    const dublin =
      mode === 'connected'
        ? await prisma.event.findFirst({
            where: { organizationId, vendorEventLink: { externalItemId: '1545631' } },
          })
        : null;
    const existingScanner = await prisma.scanner.findFirst({
      where: { organizationId, name: SCANNER_NAME, eventId: null },
    });
    const scanner = existingScanner
      ? existingScanner
      : await scannerService.registerScanner({
          name: SCANNER_NAME,
          organizationId,
          createdBy: userId,
        });
    writeSecret(scannerKeyFile, scanner.apiKey);

    const catalog = new FixtureShowpassAdapter(DEMO_KEY, VENUE_ID, '');
    const catalogEvents = await catalog.listEvents();
    const fixtures = [];
    for (const event of catalogEvents) {
      const sold = await catalog.getSoldCounts(event.externalItemId);
      const soldByType = new Map(sold.map((row) => [row.externalTicketTypeId, row.soldCount]));
      fixtures.push({
        fixtureId: event.fixtureId,
        externalItemId: event.externalItemId,
        currency: event.currency,
        timezone: event.timezone,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        counts: event.ticketTypes.map((ticket) => ({
          externalTicketTypeId: ticket.externalId,
          soldCount: soldByType.get(ticket.externalId) ?? null,
        })),
      });
    }

    const seeded = preview.events.map((event) => ({
      fixtureId: event.fixtureId,
      status: event.status,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      timezone: event.timezone,
      counts: counts
        .filter((row) => row.fixtureId === event.fixtureId)
        .map((row) => ({
          externalTicketTypeId: row.externalTicketTypeId,
          soldCount: row.soldCount,
        })),
    }));

    // The seed report is the operator's only stdout. Secrets are not in this object.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        organizationId,
        organizationSlug,
        email,
        mode,
        connected: mode === 'connected',
        venueId: VENUE_ID,
        revision: 'baseline',
        shiftDays,
        collider: { id: collider.id, slug: collider.slug },
        dublin: dublin
          ? {
              id: dublin.id,
              slug: dublin.slug,
              fixture: 'fixtures/showpass/events/pumpkins-dublin.json',
              startsOn: dublin.startDatetime,
              endsOn: dublin.endDatetime,
            }
          : null,
        fixtures,
        events: seeded,
        scannerKeyFile,
        webhookSecretFile,
        passwordFile: writtenPasswordFile,
        passwordSource: writtenPasswordFile ? 'file' : 'env',
        scanQrData: dublin
          ? `TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:${dublin.id}`
          : null,
      })
    );
  } finally {
    try {
      await disconnectRedis();
    } catch {
      process.exitCode = 1;
    }
    try {
      await prisma.$disconnect();
    } catch {
      process.exitCode = 1;
    }
  }
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Showpass fixture seed failed';
    // eslint-disable-next-line no-console
    console.error(message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<redacted>'));
    process.exitCode = 1;
  })
  .finally(() => {
    const code = process.exitCode;
    process.exit(typeof code === 'number' && code !== 0 ? code : 0);
  });

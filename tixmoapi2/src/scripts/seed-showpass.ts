/**
 * One-step Showpass fixture seed for the API image.
 * Run after migrate and, on Railway, after db:bootstrap.
 * Prints file paths for the scanner key and webhook secret. Never prints those secrets.
 */
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import prisma from '../config/prisma';
import { scannerService } from '../api/scanners/service';
import { computedFixtureShiftDays, FIXTURE_RUNTIME_ID } from '../services/vendors/fixture-runtime';
import { vendorImportService } from '../services/vendors/import-service';
import { hashPassword } from '../utils/password';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'] as const;
const DEMO_KEY = 'sp_demo_valid_key';
const VENUE_ID = 'fixture';
const COLLIDING_SLUG = 'halloween-at-the-polygon-gallery';
const LOCAL_EMAIL = 'organizer@example.test';
const LOCAL_PASSWORD = 'FixtureOrganizer1!';
const LOCAL_ORG_SLUG = 'fixture-festival';
const SCANNER_NAME = 'Showpass QA scanner';
const IMPORT_IDS = ['1545631', '1563243', '1530323'];

const secretPath = (envName: string, filename: string): string => {
  const configured = process.env[envName]?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'tmp', filename));
};

const writeSecret = (file: string, value: string): void => {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${value}\n`, { mode: 0o600 });
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
  if (!requireEnv()) {
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
  const webhookSecret = readOrCreateSecret(webhookSecretFile);
  try {
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER', disabledAt: null },
      orderBy: { createdAt: 'asc' },
    });
    let organizationId = owner?.organizationId || '';
    let userId = owner?.id || '';
    let email = owner?.email || LOCAL_EMAIL;
    let organizationSlug = '';
    if (!owner) {
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
      organizationId = organization.id;
      organizationSlug = organization.slug;
      const existingUser = await prisma.user.findUnique({ where: { email: LOCAL_EMAIL } });
      if (!existingUser) {
        const created = await prisma.user.create({
          data: {
            email: LOCAL_EMAIL,
            passwordHash: await hashPassword(LOCAL_PASSWORD),
            firstName: 'Fixture',
            lastName: 'Organizer',
            role: 'OWNER',
            organizationId,
            emailVerified: true,
          },
        });
        userId = created.id;
      } else {
        userId = existingUser.id;
      }
      email = LOCAL_EMAIL;
    } else {
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      });
      organizationSlug = organization.slug;
    }

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

    await vendorImportService.connect(organizationId, {
      apiKey: DEMO_KEY,
      vendorVenueId: VENUE_ID,
      webhookSecret,
    });
    await vendorImportService.importEvents(organizationId, VENUE_ID, IMPORT_IDS);
    await vendorImportService.syncOrganization(organizationId);
    const preview = await vendorImportService.preview(organizationId, VENUE_ID);
    const counts = await vendorImportService.listSoldCounts(organizationId);
    const dublin = await prisma.event.findFirst({
      where: { organizationId, vendorEventLink: { externalItemId: '1545631' } },
    });
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
        events: seeded,
        scannerKeyFile,
        webhookSecretFile,
        scanQrData: dublin
          ? `TICKET:00000000-0000-4000-8000-000000000000:MADE-UP:${dublin.id}`
          : null,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Showpass fixture seed failed';
  // eslint-disable-next-line no-console
  console.error(message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<redacted>'));
  process.exitCode = 1;
});

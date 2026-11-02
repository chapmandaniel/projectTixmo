import { createHash, randomBytes } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { logger } from '../../src/config/logger';
import { purgeExpiredScamMatches } from '../../src/api/brand-protection/service';
import { runGiveawayRetention } from '../../src/jobs/giveaway-retention.job';
import {
  cleanupTestData,
  createEvent,
  createOrganization,
  createVenue,
  prisma,
  registerUser,
} from '../utils/testUtils';

const phone = '+17095550199';
const email = 'claim-desk@example.test';
const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const logged = () =>
  JSON.stringify([
    (logger.warn as jest.Mock).mock.calls,
    (logger.error as jest.Mock).mock.calls,
    (logger.info as jest.Mock).mock.calls,
    (logger.http as jest.Mock).mock.calls,
  ]);

async function issueToken(label = 'test') {
  const token = `gwc_${randomBytes(32).toString('base64url')}`;
  const row = await prisma.giveawayCheckerToken.create({
    data: { tokenHash: createHash('sha256').update(token).digest('hex'), label },
  });
  return { token, id: row.id };
}

describe('Brand protection', () => {
  const previousFlag = process.env.FEATURE_GIVEAWAY_PROTECTION;
  let ownerToken = '';
  let otherToken = '';
  let adminToken = '';
  let orgAdminToken = '';
  let organizationId = '';
  let otherOrganizationId = '';
  let eventId = '';
  let checker: { token: string; id: string };

  beforeAll(async () => {
    process.env.FEATURE_GIVEAWAY_PROTECTION = 'true';
    await cleanupTestData();
    const owner = await registerUser(app, { email: 'brand-owner-a@example.com', role: 'OWNER' });
    ownerToken = owner.accessToken;
    const org = await createOrganization(app, ownerToken, {
      name: 'Harbour Org',
      slug: 'harbour-org',
    });
    organizationId = org.id;
    const venue = await createVenue(app, ownerToken, { organizationId });
    const event = await createEvent(app, ownerToken, {
      organizationId,
      venueId: venue.id,
      title: 'Harbour Show',
    });
    eventId = event.id;

    const other = await registerUser(app, { email: 'brand-owner-b@example.com', role: 'OWNER' });
    otherToken = other.accessToken;
    const otherOrg = await createOrganization(app, otherToken, {
      name: 'Other Org',
      slug: 'other-org',
    });
    otherOrganizationId = otherOrg.id;

    const admin = await registerUser(app, {
      email: 'brand-platform-admin@example.com',
      role: 'ADMIN',
    });
    adminToken = admin.accessToken;
    const orgAdmin = await registerUser(app, {
      email: 'brand-org-admin@example.com',
      role: 'ADMIN',
    });
    orgAdminToken = orgAdmin.accessToken;
    await prisma.user.update({
      where: { id: orgAdmin.user.id },
      data: { organizationId, isPlatformAdmin: false },
    });
    checker = await issueToken();
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FEATURE_GIVEAWAY_PROTECTION;
    else process.env.FEATURE_GIVEAWAY_PROTECTION = previousFlag;
    await prisma.$disconnect();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const ingest = (token: string, match: Record<string, unknown>) =>
    request(app)
      .post('/api/v1/brand-protection/ingest/matches')
      .set(auth(token))
      .send({ matches: [match] });

  it('returns 404 for user and checker routes when the flag is off', async () => {
    process.env.FEATURE_GIVEAWAY_PROTECTION = 'false';
    try {
      const hidden = await request(app)
        .get('/api/v1/brand-protection/matches')
        .set(auth(ownerToken));
      const ingestHidden = await request(app)
        .post('/api/v1/brand-protection/ingest/matches')
        .set(auth(checker.token))
        .send({
          matches: [
            {
              organizationId,
              platform: 'X',
              category: 'FAKE_CONTEST',
              sourceUrl: 'https://x.com/a/status/1',
              matchedRule: 'rule',
              detectedAt: future(0),
            },
          ],
        });
      const otherRoute = await request(app).get('/api/v1/events').set(auth(checker.token));
      expect(hidden.status).toBe(404);
      expect(ingestHidden.status).toBe(404);
      expect(otherRoute.status).toBe(403);
    } finally {
      process.env.FEATURE_GIVEAWAY_PROTECTION = 'true';
    }
  });

  it('rejects a checker token on reads and on other routes', async () => {
    const reads = await Promise.all([
      request(app).get('/api/v1/brand-protection/matches').set(auth(checker.token)),
      request(app).get('/api/v1/brand-protection/checker-status').set(auth(checker.token)),
      request(app).get('/api/v1/brand-protection/ingest/matches').set(auth(checker.token)),
      request(app).get('/api/v1/events').set(auth(checker.token)),
      request(app).post('/api/v1/orders').set(auth(checker.token)).send({}),
      request(app).get('/api/v1/health').set(auth(checker.token)),
    ]);
    for (const res of reads) expect([401, 403]).toContain(res.status);
    const userIngest = await ingest(ownerToken, {
      organizationId,
      platform: 'X',
      category: 'FAKE_CONTEST',
      sourceUrl: 'https://x.com/user-session/status/1',
      matchedRule: 'rule',
      detectedAt: future(0),
    });
    expect(userIngest.status).toBe(401);
  });

  it('rejects a revoked token, a missing organization, and an unknown organization', async () => {
    await prisma.giveawayCheckerToken.update({
      where: { id: checker.id },
      data: { revokedAt: new Date() },
    });
    const revoked = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'FAKE_CONTEST',
      sourceUrl: 'https://x.com/revoked/status/1',
      matchedRule: 'rule',
      detectedAt: future(0),
    });
    checker = await issueToken('replacement');
    expect(revoked.status).toBe(401);

    const missing = await request(app)
      .post('/api/v1/brand-protection/ingest/matches')
      .set(auth(checker.token))
      .send({
        matches: [
          {
            platform: 'X',
            category: 'FAKE_CONTEST',
            sourceUrl: 'https://x.com/missing/status/1',
            matchedRule: 'rule',
            detectedAt: future(0),
          },
        ],
      });
    expect(missing.status).toBe(400);

    const unknown = await ingest(checker.token, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      platform: 'X',
      category: 'FAKE_CONTEST',
      sourceUrl: 'https://x.com/unknown-org/status/1',
      matchedRule: 'rule',
      detectedAt: future(0),
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/organizationId/);
  });

  it('rejects marketplace platforms and marketplace URLs', async () => {
    for (const platform of [
      'KIJIJI',
      'CRAIGSLIST',
      'FACEBOOK_MARKETPLACE',
      'MARKETPLACE',
      'TIKTOK',
    ]) {
      const res = await ingest(checker.token, {
        organizationId,
        platform,
        category: 'FAKE_CONTEST',
        sourceUrl: 'https://example.com/post',
        matchedRule: 'rule',
        detectedAt: future(0),
      });
      expect(res.status).toBe(400);
    }
    const marketplace = await ingest(checker.token, {
      organizationId,
      platform: 'FACEBOOK',
      category: 'FAKE_CONTEST',
      sourceUrl: 'https://www.facebook.com/marketplace/item/1',
      platformAccountId: 'page-1',
      matchedRule: 'rule',
      detectedAt: future(0),
    });
    expect(marketplace.status).toBe(400);
  });

  it('stores a lookalike domain without page content and upserts it', async () => {
    const rejected = await ingest(checker.token, {
      organizationId,
      platform: 'LOOKALIKE_DOMAIN',
      category: 'LOOKALIKE_DOMAIN',
      sourceUrl: 'https://evil-lookalike.example/phish',
      matchedText: 'page content',
      matchedRule: 'lookalike',
      detectedAt: future(0),
    });
    expect(rejected.status).toBe(400);

    const created = await ingest(checker.token, {
      organizationId,
      platform: 'LOOKALIKE_DOMAIN',
      category: 'LOOKALIKE_DOMAIN',
      sourceUrl: 'https://evil-lookalike.example/phish?id=1',
      matchedRule: 'lookalike',
      detectedAt: future(0),
    });
    expect(created.status).toBe(200);
    expect(created.body.data.results[0].created).toBe(true);
    const again = await ingest(checker.token, {
      organizationId,
      platform: 'LOOKALIKE_DOMAIN',
      category: 'LOOKALIKE_DOMAIN',
      sourceUrl: 'evil-lookalike.example',
      matchedRule: 'lookalike',
      detectedAt: future(0),
    });
    expect(again.body.data.results[0]).toMatchObject({
      id: created.body.data.results[0].id,
      created: false,
    });
    const listed = await request(app)
      .get('/api/v1/brand-protection/matches')
      .set(auth(ownerToken))
      .query({ platform: 'LOOKALIKE_DOMAIN' });
    expect(listed.body.data.matches[0].sourceUrl).toBe('evil-lookalike.example');
    expect(listed.body.data.matches[0].matchedText).toBeNull();
  });

  it('keeps evidence inside the owning organization and out of logs', async () => {
    (logger.warn as jest.Mock).mockClear();
    (logger.error as jest.Mock).mockClear();
    (logger.info as jest.Mock).mockClear();
    (logger.http as jest.Mock).mockClear();
    const created = await ingest(checker.token, {
      organizationId,
      eventId,
      platform: 'X',
      category: 'FALSE_ASSOCIATION',
      sourceUrl: 'https://x.com/evidence/status/1',
      platformAccountId: 'suspect-evidence',
      accountHandle: 'not-official',
      suspectDisplayName: 'Harbour Fest',
      matchedText: '<script>alert(1)</script>',
      matchedRule: 'false-association',
      detectedAt: future(0),
      evidencePhones: [phone],
      evidenceEmails: [email],
    });
    expect(created.status).toBe(200);
    expect(JSON.stringify(created.body)).not.toContain(phone);
    expect(JSON.stringify(created.body)).not.toContain(email);
    expect(logged()).not.toContain(phone);
    expect(logged()).not.toContain(email);

    const own = await request(app).get('/api/v1/brand-protection/matches').set(auth(ownerToken));
    const row = own.body.data.matches.find(
      (match: { sourceUrl: string }) => match.sourceUrl === 'https://x.com/evidence/status/1'
    );
    expect(row.evidencePhones).toEqual([phone]);
    expect(row.evidenceEmails).toEqual([email]);
    expect(row.matchedText).toContain('<script>');

    const other = await request(app).get('/api/v1/brand-protection/matches').set(auth(otherToken));
    expect(JSON.stringify(other.body)).not.toContain(phone);
    expect(JSON.stringify(other.body)).not.toContain(email);
    const otherGet = await request(app)
      .get(`/api/v1/brand-protection/matches/${row.id}`)
      .set(auth(otherToken));
    expect(otherGet.status).toBe(404);
    expect(JSON.stringify(otherGet.body)).not.toContain(phone);

    const cross = await request(app)
      .get('/api/v1/brand-protection/matches')
      .set(auth(otherToken))
      .query({ organizationId });
    expect(cross.status).toBe(403);
    expect(JSON.stringify(cross.body)).not.toContain(phone);

    const admin = await request(app)
      .get('/api/v1/brand-protection/matches')
      .set(auth(adminToken))
      .query({ organizationId });
    expect(admin.status).toBe(200);
    const adminRow = admin.body.data.matches.find((match: { id: string }) => match.id === row.id);
    expect(adminRow).not.toHaveProperty('evidencePhones');
    expect(adminRow).not.toHaveProperty('evidenceEmails');
    expect(JSON.stringify(admin.body)).not.toContain(phone);
    expect(JSON.stringify(admin.body)).not.toContain(email);
  });

  it('does not auto-mark from an unverified account, a handle, or an imitated id', async () => {
    const pending = await request(app)
      .post('/api/v1/brand-protection/accounts')
      .set(auth(ownerToken))
      .send({
        platform: 'X',
        platformAccountId: 'pending-account',
        handle: 'harbourfest',
        profileUrl: 'https://x.com/harbourfest',
        displayName: 'Harbour Fest',
      });
    expect(pending.status).toBe(201);
    expect(pending.body.data.status).toBe('PENDING');
    expect(pending.body.data.verificationCode).toEqual(expect.any(String));

    const adminAccounts = await request(app)
      .get('/api/v1/brand-protection/accounts')
      .set(auth(adminToken))
      .query({ organizationId });
    expect(JSON.stringify(adminAccounts.body)).not.toContain(pending.body.data.verificationCode);

    const unverified = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://x.com/pending/status/1',
      platformAccountId: 'pending-account',
      accountHandle: 'harbourfest',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(unverified.body.data.results[0].status).toBe('NEW');

    const confirmed = await request(app)
      .post('/api/v1/brand-protection/ingest/verifications')
      .set(auth(checker.token))
      .send({
        platform: 'X',
        platformAccountId: 'pending-account',
        code: pending.body.data.verificationCode,
      });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('VERIFIED');

    const handleOnly = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://x.com/handle-only/status/1',
      accountHandle: 'harbourfest',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(handleOnly.body.data.results[0].status).toBe('NEW');

    const imitated = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://x.com/imitated/status/1',
      platformAccountId: 'someone-else',
      accountHandle: 'harbourfest',
      imitatedPlatformAccountId: 'pending-account',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(imitated.body.data.results[0].status).toBe('NEW');

    const sameId = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://x.com/same-id/status/1',
      platformAccountId: 'pending-account',
      accountHandle: 'old-handle',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(sameId.body.data.results[0].status).toBe('OFFICIAL');

    const renamed = await request(app)
      .put(`/api/v1/brand-protection/accounts/${pending.body.data.id}`)
      .set(auth(ownerToken))
      .send({ handle: 'harbourfest-renamed' });
    expect(renamed.status).toBe(200);
    const still = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://x.com/renamed/status/1',
      platformAccountId: 'pending-account',
      accountHandle: 'harbourfest-renamed',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(still.body.data.results[0].status).toBe('OFFICIAL');
  });

  it('marks a duplicate claim disputed until a platform admin resolves it', async () => {
    const first = await request(app)
      .post('/api/v1/brand-protection/accounts')
      .set(auth(ownerToken))
      .send({
        platform: 'INSTAGRAM',
        platformAccountId: 'ig-shared',
        handle: 'harbourfest',
        profileUrl: 'https://www.instagram.com/harbourfest',
      });
    expect(first.status).toBe(201);
    const verified = await request(app)
      .post('/api/v1/brand-protection/ingest/verifications')
      .set(auth(checker.token))
      .send({
        platform: 'INSTAGRAM',
        platformAccountId: 'ig-shared',
        code: first.body.data.verificationCode,
      });
    expect(verified.body.data.status).toBe('VERIFIED');

    const second = await request(app)
      .post('/api/v1/brand-protection/accounts')
      .set(auth(otherToken))
      .send({
        platform: 'INSTAGRAM',
        platformAccountId: 'ig-shared',
        handle: 'harbourfest',
        profileUrl: 'https://www.instagram.com/harbourfest',
      });
    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe('DISPUTED');
    const firstAfter = await prisma.officialAccount.findUnique({
      where: { id: first.body.data.id },
    });
    expect(firstAfter?.status).toBe('DISPUTED');

    const paused = await ingest(checker.token, {
      organizationId,
      platform: 'INSTAGRAM',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://www.instagram.com/p/paused',
      platformAccountId: 'ig-shared',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(paused.body.data.results[0].status).toBe('NEW');
    const otherSide = await ingest(checker.token, {
      organizationId: otherOrganizationId,
      platform: 'INSTAGRAM',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://www.instagram.com/p/other-paused',
      platformAccountId: 'ig-shared',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(otherSide.body.data.results[0].status).toBe('NEW');

    const ownerResolve = await request(app)
      .post('/api/v1/brand-protection/admin/disputes/resolve')
      .set(auth(ownerToken))
      .send({ winnerAccountId: first.body.data.id });
    const orgAdminResolve = await request(app)
      .post('/api/v1/brand-protection/admin/disputes/resolve')
      .set(auth(orgAdminToken))
      .send({ winnerAccountId: first.body.data.id });
    expect(ownerResolve.status).toBe(403);
    expect(orgAdminResolve.status).toBe(403);

    const resolved = await request(app)
      .post('/api/v1/brand-protection/admin/disputes/resolve')
      .set(auth(adminToken))
      .send({ winnerAccountId: first.body.data.id });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('VERIFIED');
    expect(resolved.body.data).not.toHaveProperty('verificationCode');
    const loser = await prisma.officialAccount.findUnique({ where: { id: second.body.data.id } });
    expect(loser?.status).toBe('REVOKED');

    const restored = await ingest(checker.token, {
      organizationId,
      platform: 'INSTAGRAM',
      category: 'IMPERSONATION_PROFILE',
      sourceUrl: 'https://www.instagram.com/p/restored',
      platformAccountId: 'ig-shared',
      matchedRule: 'name',
      detectedAt: future(0),
    });
    expect(restored.body.data.results[0].status).toBe('OFFICIAL');
    const audits = await prisma.staffActionAudit.findMany({
      where: { subjectId: { in: [first.body.data.id, second.body.data.id] } },
    });
    expect(audits.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'OFFICIAL_ACCOUNT_VERIFY',
        'OFFICIAL_ACCOUNT_DISPUTE',
        'OFFICIAL_ACCOUNT_RESOLVE',
      ])
    );
    expect(JSON.stringify(audits)).not.toContain(first.body.data.verificationCode);
  });

  it('auto-marks an official post URL, upserts without moving detectedAt, and reviews', async () => {
    const postUrl = 'https://x.com/harbourfest/status/official-post';
    const giveaway = await request(app)
      .post('/api/v1/brand-protection/giveaways')
      .set(auth(ownerToken))
      .send({
        title: 'Win two tickets',
        platform: 'X',
        officialPostUrl: postUrl,
        accountHandle: 'harbourfest',
        startsAt: future(1),
        endsAt: future(8),
        eventId,
        notes: 'Real contest',
      });
    expect(giveaway.status).toBe(201);
    const official = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'FAKE_CONTEST',
      sourceUrl: postUrl,
      accountHandle: 'harbourfest',
      matchedText: 'win tickets',
      matchedRule: 'contest',
      detectedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(official.body.data.results[0].status).toBe('OFFICIAL');
    const repeat = await ingest(checker.token, {
      organizationId,
      platform: 'X',
      category: 'FAKE_CONTEST',
      sourceUrl: `${postUrl}/`,
      matchedText: 'changed',
      matchedRule: 'contest',
      detectedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(repeat.body.data.results[0]).toMatchObject({
      id: official.body.data.results[0].id,
      status: 'OFFICIAL',
      created: false,
    });
    const stored = await prisma.scamMatch.findUnique({
      where: { id: official.body.data.results[0].id },
    });
    expect(stored?.detectedAt.toISOString()).toBe('2026-11-01T00:00:00.000Z');

    const fresh = await ingest(checker.token, {
      organizationId,
      eventId,
      platform: 'REDDIT',
      category: 'FAKE_CONTEST',
      sourceUrl: 'https://www.reddit.com/r/example/comments/fake',
      platformAccountId: 'reddit-user',
      matchedText: 'fake contest',
      matchedRule: 'contest',
      detectedAt: future(0),
    });
    const id = fresh.body.data.results[0].id;
    expect(fresh.body.data.results[0].status).toBe('NEW');
    for (const status of ['CONFIRMED_SCAM', 'FALSE_POSITIVE', 'OFFICIAL']) {
      const reviewed = await request(app)
        .post(`/api/v1/brand-protection/matches/${id}/review`)
        .set(auth(ownerToken))
        .send({ status });
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.data.status).toBe(status);
      expect(reviewed.body.data.reviewedBy).toEqual(expect.any(String));
    }
    const counted = await request(app)
      .get('/api/v1/brand-protection/matches')
      .set(auth(ownerToken))
      .query({ eventId, status: 'OFFICIAL' });
    expect(counted.status).toBe(200);
    expect(counted.body.data.newCount).toEqual(expect.any(Number));

    const statusReport = await request(app)
      .post('/api/v1/brand-protection/ingest/status')
      .set(auth(checker.token))
      .send({ platform: 'REDDIT', state: 'LOGIN_PROMPT', detail: 'login wall' });
    expect(statusReport.status).toBe(200);
    const visible = await request(app)
      .get('/api/v1/brand-protection/checker-status')
      .set(auth(ownerToken));
    expect(visible.body.data.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: 'REDDIT', state: 'LOGIN_PROMPT' }),
      ])
    );
  });

  it('deletes matches older than 30 days, including evidence, and is idempotent', async () => {
    const oldId = (
      await prisma.scamMatch.create({
        data: {
          organizationId,
          platform: 'X',
          category: 'FAKE_CONTEST',
          sourceUrl: 'https://x.com/old/status/1',
          matchedRule: 'old',
          detectedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
          evidencePhones: [phone],
          evidenceEmails: [email],
        },
      })
    ).id;
    const young = await prisma.scamMatch.create({
      data: {
        organizationId,
        platform: 'X',
        category: 'FAKE_CONTEST',
        sourceUrl: 'https://x.com/young/status/1',
        matchedRule: 'young',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        evidencePhones: [phone],
      },
    });
    expect(await purgeExpiredScamMatches()).toBeGreaterThanOrEqual(1);
    expect(await prisma.scamMatch.findUnique({ where: { id: oldId } })).toBeNull();
    expect(
      (await prisma.scamMatch.findUnique({ where: { id: young.id } }))?.evidencePhones
    ).toEqual([phone]);
    expect(await runGiveawayRetention()).toBe(0);
    expect(await prisma.scamMatch.findUnique({ where: { id: young.id } })).not.toBeNull();
  });

  it('issues a hashed token once and revokes it through the admin path', async () => {
    const denied = await request(app)
      .post('/api/v1/brand-protection/admin/checker-tokens')
      .set(auth(ownerToken))
      .send({ label: 'nope' });
    expect(denied.status).toBe(403);
    const issued = await request(app)
      .post('/api/v1/brand-protection/admin/checker-tokens')
      .set(auth(adminToken))
      .send({ label: 'nightly' });
    expect(issued.status).toBe(201);
    const secret = issued.body.data.token as string;
    const row = await prisma.giveawayCheckerToken.findUniqueOrThrow({
      where: { id: issued.body.data.id },
    });
    expect(row.tokenHash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(secret);
    const used = await ingest(secret, {
      organizationId,
      platform: 'FACEBOOK',
      category: 'FALSE_ASSOCIATION',
      sourceUrl: 'https://www.facebook.com/groups/example/posts/1',
      platformAccountId: 'fb-page',
      matchedRule: 'association',
      detectedAt: future(0),
    });
    expect(used.status).toBe(200);
    const touched = await prisma.giveawayCheckerToken.findUniqueOrThrow({ where: { id: row.id } });
    expect(touched.lastUsedAt).not.toBeNull();
    const revoked = await request(app)
      .post(`/api/v1/brand-protection/admin/checker-tokens/${row.id}/revoke`)
      .set(auth(adminToken));
    expect(revoked.status).toBe(200);
    const after = await ingest(secret, {
      organizationId,
      platform: 'FACEBOOK',
      category: 'FALSE_ASSOCIATION',
      sourceUrl: 'https://www.facebook.com/groups/example/posts/2',
      platformAccountId: 'fb-page',
      matchedRule: 'association',
      detectedAt: future(0),
    });
    expect(after.status).toBe(401);
  });

  it('rejects platform OAuth until that extension is built', async () => {
    const res = await request(app)
      .post('/api/v1/brand-protection/ingest/verifications')
      .set(auth(checker.token))
      .send({
        platform: 'X',
        platformAccountId: 'pending-account',
        code: 'ABCD-EFGH',
        verificationMethod: 'PLATFORM_OAUTH',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/OAuth/);
  });
});
